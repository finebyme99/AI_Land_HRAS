import { getActiveFieldMap } from './bitable/field-map-reader';
import { mapFeishuRecord } from './bitable/field-map';
import { collectFieldDescriptions } from './bitable/metrics';
import { syncFieldMapFromFeishu } from './bitable/sync-field-map';
import { getTenantAccessToken } from './feishu';
import { getSupabaseAdmin } from './supabase-admin';
import {
  buildCompetitionSnapshotUpsertRow,
  type CompetitionSnapshotIdentityRow,
  getCanonicalCompetitionSnapshotId,
  getCompetitionSnapshotDuplicateShadowIds,
} from './competition-snapshot';

const BASE_APP = 'LRROwulJciI7JYkIT55cQtdpnze';
const TABLE_ID = 'tbl9WJyxl9bbtYjb';
const WIKI_TOKEN = 'LRROwulJciI7JYkIT55cQtdpnze';
const FEISHU_API = 'https://open.feishu.cn/open-apis';

interface FeishuRecord {
  record_id: string;
  fields?: Record<string, unknown>;
}

export interface SyncCompetitionSnapshotOptions {
  scope: 'all' | 'period';
  period?: string;
}

export interface SyncCompetitionSnapshotResult {
  scope: 'all' | 'period';
  period: string | null;
  fetched: number;
  upserted: number;
  skipped: number;
  removedDuplicates: number;
  fieldDescriptions: Record<string, string>;
}

function getRecordTextField(record: FeishuRecord, fieldName: string): string {
  const value = record.fields?.[fieldName];
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0] !== null && 'text' in value[0]) {
    return value.map((item) => String((item as { text?: unknown }).text ?? '')).join('');
  }
  return value == null ? '' : String(value);
}

async function fetchFeishuRecords(token: string, reviewPeriodFieldName: string, options: SyncCompetitionSnapshotOptions): Promise<FeishuRecord[]> {
  const records: FeishuRecord[] = [];
  let pageToken: string | undefined;
  let filterSupported = options.scope === 'period';

  do {
    const url = new URL(`${FEISHU_API}/bitable/v1/apps/${BASE_APP}/tables/${TABLE_ID}/records`);
    url.searchParams.set('page_size', '100');
    if (filterSupported && options.period) {
      url.searchParams.set('filter', `AND(CurrentValue.[${reviewPeriodFieldName}]="${options.period}")`);
    }
    if (pageToken) url.searchParams.set('page_token', pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();

    if (!res.ok || json.code !== 0) {
      if (filterSupported && json.code === 1254043) {
        filterSupported = false;
        pageToken = undefined;
        records.length = 0;
        continue;
      }
      throw new Error(`飞书 API 错误: ${json.msg ?? res.status}`);
    }

    records.push(...((json.data?.items ?? []) as FeishuRecord[]));
    pageToken = json.data?.has_more ? json.data.page_token : undefined;
  } while (pageToken);

  if (options.scope === 'period' && options.period && !filterSupported) {
    return records.filter((record) => getRecordTextField(record, reviewPeriodFieldName) === options.period);
  }

  return records;
}

export async function syncCompetitionSnapshot(options: SyncCompetitionSnapshotOptions): Promise<SyncCompetitionSnapshotResult> {
  const supabase = getSupabaseAdmin();
  const token = await getTenantAccessToken();

  const fieldMapResult = await syncFieldMapFromFeishu(BASE_APP, TABLE_ID);
  if (!fieldMapResult.ok) {
    console.warn('[competition-snapshot-sync] 字段映射同步失败:', fieldMapResult.error);
  }

  const fieldMap = await getActiveFieldMap(BASE_APP, TABLE_ID, 'sync');
  const fieldDescriptions = collectFieldDescriptions(fieldMap);
  const reviewPeriodFieldName = Object.entries(fieldMap).find(([, entry]) => entry.key === 'reviewPeriod')?.[0] ?? '评审周期';
  const records = await fetchFeishuRecords(token, reviewPeriodFieldName, options);
  const { data: existingRows, error: existingRowsError } = await supabase
    .from('competition_submissions')
    .select('id, record_url')
    .not('record_url', 'is', null);
  if (existingRowsError) throw new Error(`读取快照身份失败: ${existingRowsError.message}`);
  const existingIdentities = (existingRows ?? []) as CompetitionSnapshotIdentityRow[];

  let skipped = 0;
  const rows = records
    .map((record) => {
      const canonicalId = getCanonicalCompetitionSnapshotId(record, existingIdentities);

      const item = mapFeishuRecord(
        record,
        (recordId) => `https://ztn.feishu.cn/wiki/${WIKI_TOKEN}?table=${TABLE_ID}&record=${recordId}`,
        fieldMap,
      ) as unknown as Parameters<typeof buildCompetitionSnapshotUpsertRow>[0];
      item.id = canonicalId;
      if (!item.title) {
        skipped++;
        return null;
      }
      if (!item.reviewPeriod && options.scope === 'period' && options.period) {
        item.reviewPeriod = options.period;
      }
      return buildCompetitionSnapshotUpsertRow(item);
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error } = await supabase
      .from('competition_submissions')
      .upsert(batch, { onConflict: 'id' });
    if (error) throw new Error(`写入数据库失败: ${error.message}`);
  }

  const duplicateShadowIds = getCompetitionSnapshotDuplicateShadowIds(records, existingIdentities);
  let removedDuplicates = 0;
  if (duplicateShadowIds.length > 0) {
    const { error, count } = await supabase
      .from('competition_submissions')
      .delete({ count: 'exact' })
      .in('id', duplicateShadowIds);
    if (error) throw new Error(`清理重复快照失败: ${error.message}`);
    removedDuplicates = count ?? 0;
  }

  return {
    scope: options.scope,
    period: options.period ?? null,
    fetched: records.length,
    upserted: rows.length,
    skipped,
    removedDuplicates,
    fieldDescriptions,
  };
}
