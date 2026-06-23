'use client';

/**
 * Header 字段渲染（按 headerStyle 自适应排版）
 *
 * 设计：根据字段的"自然属性"自动选排版方式
 *   - tag          小圆角彩色标签
 *   - heading      大字标题
 *   - subheading   中字副标题
 *   - paragraph    段落文字（自动换行）
 *   - chips        chip 列表（多值）
 *   - metric       大字 monospace 数字
 *
 * 颜色：tag 和 metric 的颜色由字段值推断（已知语义字段）/ 兜底用蓝色
 */

import React from 'react';
import { renderFieldValue, type HeaderFieldStyle } from '@/lib/entry-card-layout';

// ────────────────────────────────────────────────────────────────────
// 已知语义字段 → 颜色（tag / metric）
// ────────────────────────────────────────────────────────────────────

const TAG_COLORS: Record<string, { bg: string; fg: string }> = {
  proposalNo: { bg: 'rgba(26,58,138,0.1)', fg: '#1a3a8a' },
  sceneCategory: { bg: 'rgba(242,127,34,0.1)', fg: '#F27F22' },
  competitionProgress: { bg: 'rgba(0,0,0,0.06)', fg: 'var(--foreground)' },
  landingProgress: { bg: 'rgba(16,185,129,0.1)', fg: '#10b981' },
  reuseValue: { bg: 'rgba(168,85,247,0.1)', fg: '#a855f7' },
  regionCoefficient: { bg: 'rgba(100,116,139,0.1)', fg: '#64748b' },
  monthlySavedHours: { bg: 'rgba(26,58,138,0.08)', fg: '#1a3a8a' },
  monthlySavedCost: { bg: 'rgba(242,127,34,0.08)', fg: '#F27F22' },
  totalSavedHours: { bg: 'rgba(26,58,138,0.12)', fg: '#1a3a8a' },
  totalEfficiencyRate: { bg: 'rgba(16,185,129,0.1)', fg: '#10b981' },
};

const METRIC_COLORS: Record<string, string> = {
  finalValueScore: '#F27F22', // 暖橙（价值计分）
  valueRank: '#1a3a8a',       // 深蓝（排名）
};

// ────────────────────────────────────────────────────────────────────
// 各 style 渲染器
// ────────────────────────────────────────────────────────────────────

function TagField({ fieldKey, value }: { fieldKey: string; value: React.ReactNode }) {
  const colors = TAG_COLORS[fieldKey] ?? { bg: 'rgba(0,0,0,0.05)', fg: 'var(--foreground)' };
  return (
    <span
      className="entry-card-header-tag"
      style={{ background: colors.bg, color: colors.fg }}
    >
      {value}
    </span>
  );
}

function HeadingField({ value }: { value: React.ReactNode }) {
  return <div className="entry-card-header-heading">{value}</div>;
}

function SubheadingField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="entry-card-header-subheading">
      <span className="entry-card-header-subheading-label">{label}</span>
      <span className="entry-card-header-subheading-value">{value}</span>
    </div>
  );
}

function ParagraphField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="entry-card-header-paragraph">
      {label && <span className="entry-card-header-paragraph-label">{label}</span>}
      <span className="entry-card-header-paragraph-text">{value}</span>
    </div>
  );
}

function ChipsField({ value }: { value: React.ReactNode }) {
  const arr = Array.isArray(value) ? value : [value];
  return (
    <div className="entry-card-header-chips">
      {arr.map((v, i) => (
        <span key={i} className="entry-card-header-chip">{v}</span>
      ))}
    </div>
  );
}

function MetricField({ fieldKey, label, value }: { fieldKey: string; label: string; value: React.ReactNode }) {
  const color = METRIC_COLORS[fieldKey] ?? '#1a3a8a';
  return (
    <div className="entry-card-header-metric">
      <div className="entry-card-header-metric-label">{label}</div>
      <div className="entry-card-header-metric-value" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// 主函数
// ────────────────────────────────────────────────────────────────────

export function renderHeaderField(
  item: unknown,
  fieldKey: string,
  style: HeaderFieldStyle,
  label: string,
): React.ReactNode {
  const value = renderFieldValue(item, fieldKey);

  switch (style) {
    case 'tag':
      return <TagField key={fieldKey} fieldKey={fieldKey} value={value} />;
    case 'heading':
      return <HeadingField key={fieldKey} value={value} />;
    case 'subheading':
      return <SubheadingField key={fieldKey} label={label} value={value} />;
    case 'paragraph':
      return <ParagraphField key={fieldKey} label={label} value={value} />;
    case 'chips':
      return <ChipsField key={fieldKey} value={value} />;
    case 'metric':
      return <MetricField key={fieldKey} fieldKey={fieldKey} label={label} value={value} />;
  }
}
