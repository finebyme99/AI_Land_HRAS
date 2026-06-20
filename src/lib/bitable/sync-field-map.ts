/**
 * 共享的字段映射同步逻辑
 *
 * 被以下入口复用：
 *   - POST /api/admin/bitable-field-map/sync-from-feishu（管理后台手动）
 *   - POST /api/competitions/sync（成效看板"从飞书同步"按钮）
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const feishuFields = (fieldsJson.data?.items ?? []) as Array<Record<string, unknown>>;

    // 2. DB 现有记录
    const { data: dbRows } = await supabase
      .from('bitable_field_map')
      .select('id, field_id, field_name, key, group_name')
      .eq('base_app', baseApp)
      .eq('table_id', tableId);
    const dbByName = new Map<string, { id: string; field_id: string | null }>();
    for (const row of dbRows ?? []) {
      dbByName.set(row.field_name as string, { id: row.id as string, field_id: (row.field_id as string) ?? null });
    }

    // 3. Diff + 构造 fieldDescriptions / fieldOptions
    const toInsert: Array<Record<string, unknown>> = [];
    const toUpdate: Array<{ id: string; field_id: string; group_name: string; description: string; options: FieldSelectOption[] | null }> = [];
    let skipped = 0;
    const fieldDescriptions: Record<string, string> = {};
    const fieldOptions: Record<string, FieldSelectOption[]> = {};

    for (let i = 0; i < feishuFields.length; i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const f = feishuFields[i] as any;
      const fieldName = (f.field_name as string) ?? '';
      const fieldId = (f.field_id as string) ?? '';
      const groupName = (f.group_name as string) ?? '未分组';
      if (!fieldName || !fieldId) continue;

      const description = extractDescription(f.description);
      const options = extractOptions(f.property);

      const existing = dbByName.get(fieldName);
      if (existing) {
        toUpdate.push({ id: existing.id, field_id: fieldId, group_name: groupName, description, options });
      } else {
        const fallback = FALLBACK_FIELD_MAP[fieldName];
        if (fillKnownOnly && !fallback) {
          skipped++;
          continue;
        }
        toInsert.push({
          base_app: baseApp,
          table_id: tableId,
          field_id: fieldId,
          field_name: fieldName,
          key: fallback?.key ?? `unknown_${fieldId.slice(0, 8)}`,
          type: fallback?.type ?? 'text',
          group_name: fallback?.group ?? groupName,
          is_active: !!fallback,
          roles: ['sync', 'progress', 'wish-pool'],
          sort_order: i,
          description,
          options,
        });
      }

      // 记录字段注释（用 fallback key 或飞书字段名）
      const fallback = FALLBACK_FIELD_MAP[fieldName];
      const key = fallback?.key ?? fieldName;
      if (description) fieldDescriptions[key] = description;
      // 记录 select 字段选项列表
      if (options && options.length > 0) fieldOptions[key] = options;
    }

    // 4. 写库
    let inserted = 0;
    if (toInsert.length > 0) {
      const { error: insErr } = await supabase.from('bitable_field_map').insert(toInsert);
      if (insErr) return { ok: false, inserted: 0, updated: 0, skipped, totalFeishu: feishuFields.length, fieldDescriptions, fieldOptions, error: `插入失败: ${insErr.message}` };
      inserted = toInsert.length;
    }
    let updated = 0;
    for (const u of toUpdate) {
      const { error } = await supabase
        .from('bitable_field_map')
        .update({ field_id: u.field_id, group_name: u.group_name, description: u.description, options: u.options })
        .eq('id', u.id);
      if (!error) updated++;
    }

    // 5. 清内存缓存，让下次 getActiveFieldMap 重新读 DB
    invalidateFieldMapCache();

    return { ok: true, inserted, updated, skipped, totalFeishu: feishuFields.length, fieldDescriptions, fieldOptions };
  } catch (err) {
    console.error('[syncFieldMapFromFeishu] failed:', err);
    return { ok: false, inserted: 0, updated: 0, skipped: 0, totalFeishu: 0, fieldDescriptions: {}, fieldOptions: {}, error: String(err) };
  }
}
