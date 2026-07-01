import { getActiveFieldMap } from './bitable/field-map-reader';
import { mapFeishuRecord, type FieldMapEntry } from './bitable/field-map';
import { collectFieldDescriptions } from './bitable/metrics';
import { syncFieldMapFromFeishu } from './bitable/sync-field-map';
import { getTenantAccessToken } from './feishu';
import { getSupabaseAdmin } from './supabase-admin';
import {
  buildCompetitionSnapshotUpsertRow,
  COMPETITION_SNAPSHOT_SELECT,
  COMPETITION_SNAPSHOT_SELECT_WITHOUT_OWNER_PROFILES,
  countChangedCompetitionSnapshotRows,
  type CompetitionSnapshotIdentityRow,
  getCanonicalCompetitionSnapshotId,
  getCompetitionSnapshotDuplicateShadowIds,
  isMissingCompetitionOwnerProfileColumnsError,
  omitCompetitionOwnerProfileColumns,
} from './competition-snapshot';
import {
  mergePersonProfileDetails,
  normalizeBitablePersonProfiles,
  type PersonProfile,
  type PersonProfileDetails,
} from './person-profile';

const BASE_APP = 'LRROwulJciI7JYkIT55cQtdpnze';
const TABLE_ID = 'tbl9WJyxl9bbtYjb';
const WIKI_TOKEN = 'LRROwulJciI7JYkIT55cQtdpnze';
const FEISHU_API = 'https://open.feishu.cn/open-apis';
const OWNER_PROFILE_KEYS = ['bizOwner', 'aiOwner'] as const;

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
  changed: number;
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

function getRecordOwnerProfiles(
  record: FeishuRecord,
  fieldMap: Record<string, FieldMapEntry>,
): Partial<Record<(typeof OWNER_PROFILE_KEYS)[number], PersonProfile[]>> {
  const output: Partial<Record<(typeof OWNER_PROFILE_KEYS)[number], PersonProfile[]>> = {};

  for (const [fieldName, value] of Object.entries(record.fields ?? {})) {
    const entry = fieldMap[fieldName];
    if (!entry || entry.type !== 'person') continue;
    if (!OWNER_PROFILE_KEYS.includes(entry.key as (typeof OWNER_PROFILE_KEYS)[number])) continue;

    const profiles = normalizeBitablePersonProfiles(value);
    if (profiles.length === 0) continue;
    output[entry.key as (typeof OWNER_PROFILE_KEYS)[number]] = profiles;
  }

  return output;
}

async function fetchFeishuPersonDetails(token: string, openId: string): Promise<PersonProfileDetails> {
  try {
    const url = new URL(`${FEISHU_API}/contact/v3/users/${encodeURIComponent(openId)}`);
    url.searchParams.set('user_id_type', 'open_id');
    url.searchParams.set('department_id_type', 'open_department_id');

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (!res.ok || json.code !== 0) return {};

    const user = json.data?.user as Record<string, unknown> | undefined;
    if (!user) return {};
    const avatar = user.avatar as Record<string, unknown> | undefined;
    const departments = Array.isArray(user.departments)
      ? user.departments
        .map((department) => {
          if (!department || typeof department !== 'object') return '';
          const record = department as Record<string, unknown>;
          return typeof record.name === 'string' ? record.name : '';
        })
        .filter(Boolean)
      : [];

    return {
      userId: typeof user.user_id === 'string' ? user.user_id : undefined,
      unionId: typeof user.union_id === 'string' ? user.union_id : undefined,
      employeeId: typeof user.employee_no === 'string' ? user.employee_no : undefined,
      department: typeof user.department === 'string'
        ? user.department
        : departments.length > 0 ? departments.join(' / ') : undefined,
      email: typeof user.enterprise_email === 'string'
        ? user.enterprise_email
        : typeof user.email === 'string' ? user.email : undefined,
      jobTitle: typeof user.job_title === 'string' ? user.job_title : undefined,
      avatarUrl: typeof avatar?.avatar_72 === 'string'
        ? avatar.avatar_72
        : typeof avatar?.avatar_240 === 'string' ? avatar.avatar_240 : undefined,
    };
  } catch (err) {
    console.warn('[competition-snapshot-sync] 获取飞书人员资料失败:', openId, err);
    return {};
  }
}

async function loadLocalPersonDetailsByOpenId(openIds: string[]): Promise<Map<string, PersonProfileDetails>> {
  if (openIds.length === 0) return new Map();
  const { data, error } = await getSupabaseAdmin()
    .from('users')
    .select('feishu_open_id, department, employee_id, avatar')
    .in('feishu_open_id', openIds);
  if (error || !data) return new Map();

  return new Map((data as Array<{
    feishu_open_id: string | null;
    department: string | null;
    employee_id: string | null;
    avatar: string | null;
  }>)
    .filter((row) => row.feishu_open_id)
    .map((row) => [row.feishu_open_id as string, {
      department: row.department ?? undefined,
      employeeId: row.employee_id ?? undefined,
      avatarUrl: row.avatar ?? undefined,
    }]));
}

async function buildOwnerProfileIndex(
  records: FeishuRecord[],
  fieldMap: Record<string, FieldMapEntry>,
  token: string,
): Promise<Map<string, Partial<Record<'bizOwnerProfiles' | 'aiOwnerProfiles', PersonProfile[]>>>> {
  const rawProfilesByRecordId = new Map<string, Partial<Record<(typeof OWNER_PROFILE_KEYS)[number], PersonProfile[]>>>();
  const openIds = new Set<string>();

  for (const record of records) {
    const profiles = getRecordOwnerProfiles(record, fieldMap);
    rawProfilesByRecordId.set(record.record_id, profiles);
    for (const key of OWNER_PROFILE_KEYS) {
      for (const profile of profiles[key] ?? []) {
        if (profile.openId) openIds.add(profile.openId);
      }
    }
  }

  const openIdList = [...openIds];
  const [feishuDetailPairs, localDetailsByOpenId] = await Promise.all([
    Promise.all(openIdList.map(async (openId) => [openId, await fetchFeishuPersonDetails(token, openId)] as const)),
    loadLocalPersonDetailsByOpenId(openIdList),
  ]);
  const feishuDetailsByOpenId = new Map<string, PersonProfileDetails>(feishuDetailPairs);

  const profileIndex = new Map<string, Partial<Record<'bizOwnerProfiles' | 'aiOwnerProfiles', PersonProfile[]>>>();
  for (const [recordId, rawProfiles] of rawProfilesByRecordId) {
    profileIndex.set(recordId, {
      bizOwnerProfiles: rawProfiles.bizOwner
        ? mergePersonProfileDetails(rawProfiles.bizOwner, feishuDetailsByOpenId, localDetailsByOpenId)
        : undefined,
      aiOwnerProfiles: rawProfiles.aiOwner
        ? mergePersonProfileDetails(rawProfiles.aiOwner, feishuDetailsByOpenId, localDetailsByOpenId)
        : undefined,
    });
  }

  return profileIndex;
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
  const fetchExistingRows = (selectColumns: string) => supabase
    .from('competition_submissions')
    .select(selectColumns)
    .not('record_url', 'is', null);
  let existingRowsResult = await fetchExistingRows(COMPETITION_SNAPSHOT_SELECT);
  let ownerProfileColumnsAvailable = true;
  if (isMissingCompetitionOwnerProfileColumnsError(existingRowsResult.error)) {
    console.warn('[competition-snapshot-sync] competition_submissions owner profile columns missing; falling back to legacy snapshot columns.');
    ownerProfileColumnsAvailable = false;
    existingRowsResult = await fetchExistingRows(COMPETITION_SNAPSHOT_SELECT_WITHOUT_OWNER_PROFILES);
  }
  const { data: existingRows, error: existingRowsError } = existingRowsResult;
  if (existingRowsError) throw new Error(`读取快照身份失败: ${existingRowsError.message}`);
  const existingSnapshotRows = (existingRows ?? []) as unknown as Array<Record<string, unknown> & { id: string }>;
  const existingIdentities = existingSnapshotRows as CompetitionSnapshotIdentityRow[];
  const ownerProfileIndex = ownerProfileColumnsAvailable
    ? await buildOwnerProfileIndex(records, fieldMap, token)
    : new Map<string, Partial<Record<'bizOwnerProfiles' | 'aiOwnerProfiles', PersonProfile[]>>>();

  let skipped = 0;
  const rows = records
    .map((record) => {
      const canonicalId = getCanonicalCompetitionSnapshotId(record, existingIdentities);

      const item = mapFeishuRecord(
        record,
        (recordId) => `https://ztn.feishu.cn/wiki/${WIKI_TOKEN}?table=${TABLE_ID}&record=${recordId}`,
        fieldMap,
      ) as unknown as Parameters<typeof buildCompetitionSnapshotUpsertRow>[0];
      if (ownerProfileColumnsAvailable) {
        const ownerProfiles = ownerProfileIndex.get(record.record_id);
        item.bizOwnerProfiles = ownerProfiles?.bizOwnerProfiles;
        item.aiOwnerProfiles = ownerProfiles?.aiOwnerProfiles;
      }
      item.id = canonicalId;
      if (!item.title) {
        skipped++;
        return null;
      }
      if (!item.reviewPeriod && options.scope === 'period' && options.period) {
        item.reviewPeriod = options.period;
      }
      const row = buildCompetitionSnapshotUpsertRow(item);
      return ownerProfileColumnsAvailable ? row : omitCompetitionOwnerProfileColumns(row);
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
  const changed = countChangedCompetitionSnapshotRows(rows, existingSnapshotRows);

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
    changed,
    skipped,
    removedDuplicates,
    fieldDescriptions,
  };
}
