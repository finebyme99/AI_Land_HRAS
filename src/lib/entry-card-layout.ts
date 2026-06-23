/**
 * 方案卡片布局配置（competitions-entry-card）
 *
 * 由 admin 在 /admin/layouts/competitions-entry-card 可视化配置。
 * 存于 app_layout_configs 表，scope='global', key='competitions-entry-card'。
 *
 * 渲染方：competitions 页面 EntryDetailPopup 读此配置渲染 hover 卡片。
 * 缺省：fallback 到 DEFAULT_ENTRY_CARD_LAYOUT（与历史硬编码保持一致）。
 *
 * 设计：
 *   - header：可配置字段顺序 + 按 headerStyle 自适应排版
 *   - groups：每组双栏网格，字段可跨列变全宽（span 2）
 */

import type React from 'react';
import { FIELD_LABELS } from '@/lib/bitable/labels';
import { formatCurrency } from '@/lib/bitable/metrics';

// ────────────────────────────────────────────────────────────────────
// 类型定义
// ────────────────────────────────────────────────────────────────────

/** 头部字段的渲染样式（按内容类型自动选） */
export type HeaderFieldStyle =
  | 'tag'          // 小圆角彩色标签（编号 / 分类 / 状态 / 落地进展）
  | 'heading'      // 大字标题（方案标题）
  | 'subheading'   // 中字（团队 / 类型）
  | 'paragraph'    // 段落文字（一句话简介 / 业务流程）
  | 'chips'        // 列表 chip（提报人 / 组队成员 / AI 工具）
  | 'metric';      // 大字 monospace 数字（最终价值计分 / 价值排名）

/** 字段跨列设置：1 = 单列（默认），2 = 全宽（占满双栏） */
export type FieldSpan = 1 | 2;

/** 卡片头部配置（可配置字段顺序） */
export interface EntryCardHeader {
  /** 头部显示的字段（按顺序）。渲染时按各自 style 自动排版 */
  fields: string[];
}

/** 一个分组（一段带标题的字段网格） */
export interface EntryCardGroup {
  id: string;
  title: string;
  /** 标题左侧色条的颜色 */
  color: string;
  /** 该分组下要展示的字段（按顺序）。跨列设置见 fieldSpans */
  fields: string[];
  /** 字段跨列设置：key = 字段 key，value = 跨列数（1 或 2）。未设置默认 1 */
  fieldSpans?: Record<string, FieldSpan>;
}

/** 完整的卡片布局配置 */
export interface EntryCardLayout {
  /** 头部：字段顺序（每个字段按 headerStyle 自适应排版） */
  header: EntryCardHeader;
  /** 字段网格分组 */
  groups: EntryCardGroup[];
  /** 全局隐藏的字段（不出现在头部 / 任何分组里） */
  hiddenFields: string[];
}

// ────────────────────────────────────────────────────────────────────
// 默认布局
// ────────────────────────────────────────────────────────────────────

/**
 * 默认布局 — 头部 + 双栏分组；briefIntro 示范 span 2
 */
export const DEFAULT_ENTRY_CARD_LAYOUT: EntryCardLayout = {
  header: {
    fields: ['proposalNo', 'sceneCategory', 'competitionProgress', 'title', 'briefIntro'],
  },
  groups: [
    {
      id: 'g_participate',
      title: '参赛信息',
      color: '#1a3a8a',
      fields: ['team', 'teamType', 'submitter', 'teamMembers', 'aiTools', 'landingProgress'],
      fieldSpans: {
        briefIntro: 2,
      },
    },
    {
      id: 'g_value',
      title: '价值指标',
      color: '#F27F22',
      fields: [
        'monthlySavedHours',
        'monthlySavedCost',
        'totalSavedHours',
        'totalEfficiencyRate',
        'reuseValue',
        'regionCoefficient',
      ],
    },
  ],
  hiddenFields: ['progressRecord'],
};

// ────────────────────────────────────────────────────────────────────
// 字段库
// ────────────────────────────────────────────────────────────────────

/** 字段池条目 */
export interface EntryCardFieldDef {
  key: string;
  /** 中文标签 */
  label: string;
  /** 字段组（用于左侧字段库分组展示） */
  group: string;
  /** 头部渲染样式（默认 'tag' — 兜底；显式指定更准） */
  headerStyle: HeaderFieldStyle;
}

/** 字段库 — 所有可选字段，按"自然属性"标注 headerStyle */
export const ENTRY_CARD_FIELD_POOL: EntryCardFieldDef[] = [
  // ── 基本信息 ──
  { key: 'proposalNo', label: '场景编号', group: '基本信息', headerStyle: 'tag' },
  { key: 'sceneCategory', label: '场景分类', group: '基本信息', headerStyle: 'tag' },
  { key: 'competitionProgress', label: '大赛进展', group: '基本信息', headerStyle: 'tag' },
  { key: 'title', label: FIELD_LABELS.title, group: '基本信息', headerStyle: 'heading' },
  { key: 'briefIntro', label: '一句话简介', group: '基本信息', headerStyle: 'paragraph' },

  // ── 参赛信息 ──
  { key: 'team', label: '提报团队', group: '参赛信息', headerStyle: 'subheading' },
  { key: 'teamType', label: '组队类型', group: '参赛信息', headerStyle: 'subheading' },
  { key: 'submitter', label: '提报人', group: '参赛信息', headerStyle: 'chips' },
  { key: 'teamMembers', label: '组队成员', group: '参赛信息', headerStyle: 'chips' },
  { key: 'aiTools', label: 'AI 工具', group: '参赛信息', headerStyle: 'chips' },
  { key: 'landingProgress', label: '落地进展', group: '参赛信息', headerStyle: 'tag' },

  // ── 价值指标 ──
  { key: 'monthlySavedHours', label: FIELD_LABELS.monthlySavedHours, group: '价值指标', headerStyle: 'tag' },
  { key: 'monthlySavedCost', label: FIELD_LABELS.monthlySavedCost, group: '价值指标', headerStyle: 'tag' },
  { key: 'totalSavedHours', label: FIELD_LABELS.totalSavedHours, group: '价值指标', headerStyle: 'tag' },
  { key: 'totalEfficiencyRate', label: FIELD_LABELS.totalEfficiencyRate, group: '价值指标', headerStyle: 'tag' },
  { key: 'reuseValue', label: FIELD_LABELS.reuseValue, group: '价值指标', headerStyle: 'tag' },
  { key: 'regionCoefficient', label: FIELD_LABELS.regionCoefficient, group: '价值指标', headerStyle: 'tag' },

  // ── 业务流程（paragraph 样式）──
  { key: 'beforeProcess', label: '原业务流程', group: '业务流程', headerStyle: 'paragraph' },
  { key: 'afterProcess', label: '新业务流程', group: '业务流程', headerStyle: 'paragraph' },
  { key: 'implementation', label: 'AI 实现过程', group: '业务流程', headerStyle: 'paragraph' },
  { key: 'painPoints', label: '原核心痛点', group: '业务流程', headerStyle: 'chips' },

  // ── 汇总 ──
  { key: 'finalValueScore', label: '最终价值计分', group: '汇总', headerStyle: 'metric' },
  { key: 'valueRank', label: '价值排名', group: '汇总', headerStyle: 'metric' },
];

// ────────────────────────────────────────────────────────────────────
// 工具函数
// ────────────────────────────────────────────────────────────────────

/** 取字段跨列数（默认 1） */
export function getFieldSpan(group: EntryCardGroup, fieldKey: string): FieldSpan {
  return group.fieldSpans?.[fieldKey] ?? 1;
}

/** 取字段 headerStyle（默认 'tag' 兜底） */
export function getFieldHeaderStyle(fieldKey: string): HeaderFieldStyle {
  return ENTRY_CARD_FIELD_POOL.find((f) => f.key === fieldKey)?.headerStyle ?? 'tag';
}

/** 给单字段做渲染（按字段 key 选不同格式化） */
export function renderFieldValue(item: unknown, key: string): React.ReactNode {
  const v = (item as Record<string, unknown> | null)?.[key];
  if (v == null || v === '') return '—';

  switch (key) {
    case 'monthlySavedHours':
      return typeof v === 'number' ? `${Math.round(v)}h` : '—';
    case 'totalSavedHours':
      return typeof v === 'number' ? `${Math.round(v)}h` : '—';
    case 'monthlySavedCost':
      return formatCurrency(v);
    case 'totalEfficiencyRate':
      return typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : '—';
    case 'finalValueScore':
      return typeof v === 'number' ? Math.round(v).toString() : '—';
    case 'valueRank':
      return typeof v === 'number' ? `#${v}` : '—';
    case 'submitter':
    case 'teamMembers':
    case 'aiTools':
    case 'painPoints':
      return Array.isArray(v) ? v : String(v);
    default:
      if (typeof v === 'object') {
        try {
          return JSON.stringify(v);
        } catch {
          return '—';
        }
      }
      return String(v);
  }
}
