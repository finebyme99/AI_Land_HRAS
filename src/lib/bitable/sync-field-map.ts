/**
 * 共享的字段映射同步逻辑
 *
 * 被以下入口复用：
 *   - POST /api/admin/bitable-field-map/sync-from-feishu（管理后台手动）
 *   - POST /api/admin/competition-sync（全量场景数据同步前的字段 schema 联动）
 *
 * 核心流程：
 *   1. 从飞书 fields API 拉取最新字段定义（含 description）
 *   2. 对比 DB bitable_field_map
 *   3. 新字段 insert，已有字段 update（field_id / group_name / description）
 *   4. 自动 invalidate field-map-reader 的内存缓存
 */

import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getTenantAccessTokenFor } from '@/lib/feishu';
import { FALLBACK_FIELD_MAP, type FieldSelectOption } from '@/lib/bitable/field-map';
import { invalidateFieldMapCache } from '@/lib/bitable/field-map-reader';
import {
  buildFieldMapSyncPlan,
  type ExistingFieldMapRow,
  type NormalizedFeishuField,
} from '@/lib/bitable/field-map-identity';

const ZT_APP_ID = 'cli_a84a9ed9597fd01c';

/** 提取飞书字段注释：description 可能是 [{text: "..."}] 数组、字符串或 null */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractDescription(description: any): string {
  if (!description) return '';
  if (typeof description === 'string') return description;
  if (Array.isArray(description)) {
    return description
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((d: any) => (typeof d === 'string' ? d : d?.text ?? ''))
      .join('')
      .trim();
  }
  if (typeof description === 'object' && description.text) return String(description.text);
  return '';
}

/** 提取飞书 select/multi_select 字段的选项列表 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractOptions(property: any): FieldSelectOption[] | null {
  if (!property?.options || !Array.isArray(property.options)) return null;
  return property.options
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((o: any) => ({
      id: String(o.id ?? ''),
      name: String(o.name ?? ''),
    }))
    .filter((o: FieldSelectOption) => o.name);
}

export interface SyncFieldMapResult {
  ok: boolean;
  inserted: number;
  updated: number;
  skipped: number;
  totalFeishu: number;
  fieldDescriptions: Record<string, string>;
  fieldOptions: Record<string, FieldSelectOption[]>;
  error?: string;
}

/**
 * 从飞书同步字段映射到 DB + 清内存缓存
 *
 * @param baseApp  飞书 app token
 * @param tableId  飞书 table id
 * @param options.fillKnownOnly  仅插入 fallback 里有的字段（默认 true）
 */
export async function syncFieldMapFromFeishu(
  baseApp: string,
  tableId: string,
  options?: { fillKnownOnly?: boolean },
): Promise<SyncFieldMapResult> {
  const fillKnownOnly = options?.fillKnownOnly !== false;
  const supabase = getSupabaseAdmin();

  try {
    // 1. 飞书 schema
    const { data: app } = await supabase
      .from('feishu_apps')
      .select('app_id, app_secret')
      .eq('app_id', ZT_APP_ID)
      .single();
    if (!app) return { ok: false, inserted: 0, updated: 0, skipped: 0, totalFeishu: 0, fieldDescriptions: {}, fieldOptions: {}, error: '未找到 ZT 飞书应用' };

    const token = await getTenantAccessTokenFor(app.app_id, app.app_secret);
    const fieldsUrl = `https://open.feishu.cn/open-apis/bitable/v1/apps/${baseApp}/tables/${tableId}/fields?page_size=100`;
    const fieldsRes = await fetch(fieldsUrl, { headers: { Authorization: `Bearer ${token}` } });
    const fieldsJson = await fieldsRes.json();
    if (!fieldsRes.ok || fieldsJson.code !== 0) {
      return { ok: false, inserted: 0, updated: 0, skipped: 0, totalFeishu: 0, fieldDescriptions: {}, fieldOptions: {}, error: `飞书 API 错误: ${fieldsJson.msg ?? fieldsRes.status}` };
    }
    const feishuFields = (fieldsJson.data?.items ?? []) as Array<Record<string, unknown>>;

    // 2. DB 现有记录
    const { data: dbRows } = await supabase
      .from('bitable_field_map')
      .select('id, field_id, field_name, key, type, group_name, is_active, roles, sort_order')
      .eq('base_app', baseApp)
      .eq('table_id', tableId);

    // 3. Diff + 构造 fieldDescriptions / fieldOptions
    const normalizedFields: NormalizedFeishuField[] = [];

    for (let i = 0; i < feishuFields.length; i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const f = feishuFields[i] as any;
      const fieldName = (f.field_name as string) ?? '';
      const fieldId = (f.field_id as string) ?? '';
      const groupName = (f.group_name as string) ?? '未分组';
      if (!fieldName || !fieldId) continue;

      const description = extractDescription(f.description);
      const options = extractOptions(f.property);

      normalizedFields.push({ field_id: fieldId, field_name: fieldName, group_name: groupName, description, options });
    }

    const plan = buildFieldMapSyncPlan((dbRows ?? []) as ExistingFieldMapRow[], normalizedFields, {
      baseApp,
      tableId,
      fillKnownOnly,
      fallbackFieldMap: FALLBACK_FIELD_MAP,
    });

    // 4. 写库
    let inserted = 0;
    if (plan.toInsert.length > 0) {
      const { error: insErr } = await supabase.from('bitable_field_map').insert(plan.toInsert);
      if (insErr) return { ok: false, inserted: 0, updated: 0, skipped: plan.skipped, totalFeishu: feishuFields.length, fieldDescriptions: plan.fieldDescriptions, fieldOptions: plan.fieldOptions, error: `插入失败: ${insErr.message}` };
      inserted = plan.toInsert.length;
    }
    let updated = 0;
    for (const u of plan.toUpdate) {
      const { error } = await supabase
        .from('bitable_field_map')
        .update({ field_id: u.field_id, field_name: u.field_name, group_name: u.group_name, description: u.description, options: u.options })
        .eq('id', u.id);
      if (error) return { ok: false, inserted, updated, skipped: plan.skipped, totalFeishu: feishuFields.length, fieldDescriptions: plan.fieldDescriptions, fieldOptions: plan.fieldOptions, error: `更新失败[${u.field_name}]: ${error.message}` };
      updated++;
    }

    // 5. 清内存缓存，让下次 getActiveFieldMap 重新读 DB
    invalidateFieldMapCache();

    return { ok: true, inserted, updated, skipped: plan.skipped, totalFeishu: feishuFields.length, fieldDescriptions: plan.fieldDescriptions, fieldOptions: plan.fieldOptions };
  } catch (err) {
    console.error('[syncFieldMapFromFeishu] failed:', err);
    return { ok: false, inserted: 0, updated: 0, skipped: 0, totalFeishu: 0, fieldDescriptions: {}, fieldOptions: {}, error: String(err) };
  }
}
