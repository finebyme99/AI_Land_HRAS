/**
 * 动态枚举共享模块
 *
 * 所有飞书 bitable 选项值（场景分类、落地进展等）不从代码硬编码，
 * 而是从 bitable_field_map.options(DB) 动态读取。
 * 颜色分配用位置序号+固定色板算法，飞书新增选项自动获得下一个色板颜色。
 *
 * 项目规范：禁止硬编码飞书枚举选项值，一律走此模块动态分配。
 */

import type { FieldSelectOption } from '@/lib/bitable/field-map';

// ─── 色板 ────────────────────────────────────────────────────────

/** 场景分类色板（蓝系+橙系，循环分配） */
const CATEGORY_PALETTE = ['#1a3a8a', '#F27F22', '#2d5bc7', '#4a7de0', '#6366f1', '#94a3b8'];

/** 已落地色板（蓝系，深→浅） */
const LANDED_PALETTE = ['#1a3a8a', '#2d5bc7', '#4a7de0', '#6366f1'];

/** 待实现色板（暖灰系） */
const PENDING_PALETTE = ['#94a3b8', '#64748b', '#e2e8f0', '#cbd5e1'];

/** 归并/不纳入待实现统计的状态色板 */
const OTHER_PROGRESS_PALETTE = ['#cbd5e1', '#9ca3af'];

/** 大赛进展色板（蓝+绿） */
const STATUS_PALETTE = ['#1a3a8a', '#16a34a', '#6366f1', '#94a3b8'];

/** 兜底色 */
export const FALLBACK_COLOR = '#6b7280';

/**
 * 按位置序号从色板循环取色
 *
 * @param index  选项在列表中的位置（0-based）
 * @param palette 色板数组
 * @returns       色板颜色字符串
 */
export function paletteColor(index: number, palette: readonly string[]): string {
  return palette[index % palette.length];
}

/**
 * 从 fieldOptions 构建颜色映射（选项名 → 色板颜色）
 *
 * @param opts    fieldOptions[fieldKey]（飞书 select 选项列表）
 * @param palette 色板数组
 * @returns       Record<选项名, 颜色>
 */
export function buildColorMap(
  opts: FieldSelectOption[] | undefined,
  palette: readonly string[],
): Record<string, string> {
  if (!opts) return {};
  const map: Record<string, string> = {};
  opts.forEach((o, i) => { map[o.name] = paletteColor(i, palette); });
  return map;
}

// ─── 落地进展分组 ──────────────────────────────────────────────

/**
 * 判断落地进展选项是否属于"已落地"组
 *
 * 规则：选项名包含"上线"关键词 → 已落地。
 *
 * @param name  飞书落地进展选项名（如"试点上线"、"待启动"）
 */
export function isLandedState(name: string): boolean {
  return name.includes('上线');
}

/**
 * 判断落地进展选项是否属于归并状态。
 *
 * "并入同类项目"表示需求已归并，不应继续计入待实现场景。
 */
export function isMergedSameProjectState(name: string): boolean {
  return name.includes('并入同类');
}

/**
 * 判断落地进展选项是否属于"待实现"组。
 *
 * 规则：非上线、非归并状态 → 待实现。未来飞书新增选项默认归入待实现。
 */
export function isPendingImplementationState(name: string): boolean {
  return !isLandedState(name) && !isMergedSameProjectState(name);
}

/**
 * 从 fieldOptions['landingProgress'] 动态划分已落地/待实现列表
 *
 * @param landingOpts  fieldOptions['landingProgress'] 或 undefined
 * @returns            { landed: string[], pending: string[], other: string[] }
 */
export function partitionProgressStates(
  landingOpts: FieldSelectOption[] | undefined,
): { landed: string[]; pending: string[]; other: string[] } {
  if (!landingOpts) {
    // fallback：DB 还没同步时用空数组（前端不会有匹配数据）
    return { landed: [], pending: [], other: [] };
  }
  const landed: string[] = [];
  const pending: string[] = [];
  const other: string[] = [];
  landingOpts.forEach((o) => {
    if (isLandedState(o.name)) landed.push(o.name);
    else if (isPendingImplementationState(o.name)) pending.push(o.name);
    else other.push(o.name);
  });
  return { landed, pending, other };
}

/**
 * 构建落地进展完整颜色映射（已落地+待实现合并）
 *
 * @param landingOpts  fieldOptions['landingProgress'] 或 undefined
 * @returns            Record<选项名, 颜色>
 */
export function buildProgressColorMap(
  landingOpts: FieldSelectOption[] | undefined,
): Record<string, string> {
  if (!landingOpts) return {};
  const map: Record<string, string> = {};
  let landedIdx = 0;
  let pendingIdx = 0;
  let otherIdx = 0;
  landingOpts.forEach((o) => {
    if (isLandedState(o.name)) {
      map[o.name] = paletteColor(landedIdx++, LANDED_PALETTE);
    } else if (isPendingImplementationState(o.name)) {
      map[o.name] = paletteColor(pendingIdx++, PENDING_PALETTE);
    } else {
      map[o.name] = paletteColor(otherIdx++, OTHER_PROGRESS_PALETTE);
    }
  });
  return map;
}

// ─── 场景分类颜色 ──────────────────────────────────────────────

export function buildCategoryColorMap(
  categoryOpts: FieldSelectOption[] | undefined,
): Record<string, string> {
  return buildColorMap(categoryOpts, CATEGORY_PALETTE);
}

// ─── 大赛进展颜色 ──────────────────────────────────────────────

export function buildStatusColorMap(
  statusOpts: FieldSelectOption[] | undefined,
): Record<string, string> {
  return buildColorMap(statusOpts, STATUS_PALETTE);
}

// ─── 复用价值等级样式 ──────────────────────────────────────────

const REUSE_LEVEL_STYLES: Record<string, { bg: string; fg: string; border: string }> = {
  '低价值':   { bg: 'rgba(34,197,94,0.08)',  fg: '#16a34a', border: 'rgba(34,197,94,0.2)' },
  '中价值':   { bg: 'rgba(20,184,166,0.1)',  fg: '#0d9488', border: 'rgba(20,184,166,0.25)' },
  '高价值':   { bg: 'rgba(245,158,11,0.12)', fg: '#d97706', border: 'rgba(245,158,11,0.3)' },
  '极高价值': { bg: 'rgba(234,88,12,0.15)', fg: '#c2410c', border: 'rgba(234,88,12,0.35)' },
};

const REUSE_LEVEL_FALLBACK = { bg: 'rgba(0,0,0,0.04)', fg: 'var(--text-secondary)', border: 'rgba(0,0,0,0.08)' };

/**
 * 获取复用价值等级对应的样式
 *
 * @param level  价值等级名（低价值/中价值/高价值/极高价值）或 null
 */
export function reuseLevelStyle(level: string | null | undefined): { bg: string; fg: string; border: string } {
  const text = level ?? '';
  const matchedLevel = Object.keys(REUSE_LEVEL_STYLES).find((name) => text.includes(name));
  return REUSE_LEVEL_STYLES[matchedLevel ?? text] ?? REUSE_LEVEL_FALLBACK;
}

// ─── 色板常量导出（供需要直接使用色板的场景）──

export { CATEGORY_PALETTE, LANDED_PALETTE, PENDING_PALETTE, STATUS_PALETTE };
