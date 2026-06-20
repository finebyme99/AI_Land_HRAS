/**
 * 筛选选项构建共享函数
 *
 * 供 ChoDashboard、wish-pool 等模块统一使用：
 * - 优先用 fieldOptions（DB bitable_field_map.options，来自飞书同步）
 * - fallback 用 aggregateOptions（从实际数据聚合）
 * - count=0 的选项不展示（停用枚举/DB同步滞后产生的空选项对用户无价值）
 */

import type { FieldSelectOption } from '@/lib/bitable/field-map';

export interface FilterItem {
  value: string;
  label: string;
  count: number;
}

/** ChoDashboard 等模块的 key 别名映射（筛选字段 key ↔ enriched 数据 key） */
const KEY_TO_ENRICHED_KEY: Record<string, string> = {
  coreValue: 'extraValue',              // coreValue ↔ extraValue (SYNC_KEY_ALIAS)
  competitionProgress: 'competitionStatus',  // competitionProgress ↔ status
};

/** 从数据动态聚合筛选选项：按数量降序（仅作为 fieldOptionsToFilterItems 内部 fallback） */
function aggregateOptions(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  enriched: readonly any[],
  key: string,
  label: string = '未分类',
): FilterItem[] {
  const counts: Record<string, number> = {};
  enriched.forEach((s) => {
    const v = (s[key] as string) || label;
    counts[v] = (counts[v] ?? 0) + 1;
  });
  const sorted = Object.keys(counts).sort((a, b) => {
    if (a === label) return 1;
    if (b === label) return -1;
    return counts[b] - counts[a];
  });
  return [
    { value: 'all', label: '全部', count: enriched.length },
    ...sorted.map((v) => ({ value: v, label: v, count: counts[v] ?? 0 })),
  ];
}

/**
 * 从 fieldOptions 构造筛选选项列表（优先用 fieldOptions，fallback 用 aggregateOptions）
 *
 * @param fieldKey       筛选字段 key（如 'sceneCategory', 'team', 'coreValue'）
 * @param enriched       当前数据集（用于聚合 count）
 * @param fieldOptions   DB bitable_field_map.options（飞书同步的最新选项列表）
 * @param keyAliasMap    key 别名映射（可选），默认用 KEY_TO_ENRICHED_KEY。
 *                       wish-pool 等模块传入 {} 表示 key 直接映射无需别名。
 */
export function fieldOptionsToFilterItems(
  fieldKey: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  enriched: readonly any[],
  fieldOptions: Record<string, FieldSelectOption[]>,
  keyAliasMap?: Record<string, string>,
): FilterItem[] {
  const aliasMap = keyAliasMap ?? KEY_TO_ENRICHED_KEY;
  const enrichedKey = aliasMap[fieldKey] ?? fieldKey;
  const opts = fieldOptions[fieldKey];

  if (!opts || opts.length === 0) {
    // 没有 fieldOptions → fallback 到 aggregateOptions（天然不含 count=0）
    return aggregateOptions(enriched, enrichedKey);
  }

  // 从 enriched 聚合 count
  const counts: Record<string, number> = {};
  enriched.forEach((s) => {
    const v = (s[enrichedKey] as string) || '未分类';
    counts[v] = (counts[v] ?? 0) + 1;
  });

  const totalCount = enriched.length;
  return [
    { value: 'all', label: '全部', count: totalCount },
    ...opts
      .map((o) => ({ value: o.name, label: o.name, count: counts[o.name] ?? 0 }))
      .filter((item) => item.count > 0),
  ];
}
