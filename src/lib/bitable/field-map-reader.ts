/**
 * DB 优先的飞书字段映射 reader
 *
 * 调用方：sync / progress / wish-pool 三个 API
 * 流程：
 *   1. 查 DB（带 in-memory cache，5 分钟）
 *   2. DB 有 → 用 DB 的；DB 没有 → fallback 到 lib/bitable/field-map.ts 的硬编码
 *
 * 好处：
 *   - 加新字段：硬编码 fallback 加一行（同步字段定义到所有消费方）
 *   - 字段改名：UI 里点「从飞书拉取」自动同步 field_id，不用改代码
 *   - 临时停用某个字段：UI 里 is_active=false，下次请求就不消费了
 */

import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  FALLBACK_FIELD_MAP,
  type FieldMapEntry,
  type FieldType,
} from '@/lib/bitable/field-map';

interface DBFieldRow {
  field_name: string;
  key: string;
  type: FieldType;
  group_name: string;
  is_active: boolean;
  roles: string[];
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { map: Record<string, FieldMapEntry>; ts: number }>();

function cacheKey(baseApp: string, tableId: string, role: string): string {
  return `${baseApp}::${tableId}::${role}`;
}

/**
 * 给指定 API（sync / progress / wish-pool）拿到该表所有 is_active=true 的字段
 *
 * @param baseApp  飞书 app token
 * @param tableId  飞书 table id
 * @param role     调用方角色 'sync' | 'progress' | 'wish-pool'，过滤 roles 数组
 * @returns        Record<飞书字段名, FieldMapEntry>
 */
export async function getActiveFieldMap(
  baseApp: string,
  tableId: string,
  role: 'sync' | 'progress' | 'wish-pool',
): Promise<Record<string, FieldMapEntry>> {
  const key = cacheKey(baseApp, tableId, role);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.map;
  }

  let map: Record<string, FieldMapEntry> = {};
  try {
    const supabase = getSupabaseAdmin();
    const { data: rows } = await supabase
      .from('bitable_field_map')
      .select('field_name, key, type, group_name, is_active, roles')
      .eq('base_app', baseApp)
      .eq('table_id', tableId)
      .eq('is_active', true)
      .contains('roles', [role]);

    if (rows && rows.length > 0) {
      for (const r of rows as DBFieldRow[]) {
        map[r.field_name] = {
          key: r.key,
          type: r.type,
          group: r.group_name,
        };
      }
    }
  } catch (err) {
    console.error('[getActiveFieldMap] DB read failed, fallback to hardcoded:', err);
  }

  // DB 没有记录 → fallback
  if (Object.keys(map).length === 0) {
    map = { ...FALLBACK_FIELD_MAP };
  } else {
    // DB 有记录但有 fallback 独有的字段（防止 DB 漏配）— 用 fallback 补全
    for (const [name, entry] of Object.entries(FALLBACK_FIELD_MAP)) {
      if (!map[name]) map[name] = entry;
    }
  }

  cache.set(key, { map, ts: Date.now() });
  return map;
}

/** 强制清缓存（admin UI 上「刷新」按钮调用，或者写入 DB 后调用） */
export function invalidateFieldMapCache(): void {
  cache.clear();
}

// 重新导出 lib 的公共 API，方便消费方只引一处
export { FALLBACK_FIELD_MAP, extractValue } from '@/lib/bitable/field-map';
export type { FieldMapEntry, FieldType } from '@/lib/bitable/field-map';