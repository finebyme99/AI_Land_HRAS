'use client';

/**
 * StaticFieldChip / StaticGroupHeader — 卡片最终展示样式（只读）
 *
 * 与设计器里的 SortableFieldChip 视觉对齐，但不可拖、无操作按钮。
 * 使用同一套 .entry-card-* CSS class，确保设计器与最终卡片 1:1。
 */

import React from 'react';
import type { FieldSpan } from '@/lib/entry-card-layout';

export interface ChipRenderProps {
  fieldKey: string;
  groupId: string;
  span: FieldSpan;
  label: string;
  value: React.ReactNode;
}

export interface GroupHeaderRenderProps {
  group: { id: string; title: string; color: string };
}

/** 只读字段 chip（设计器外的卡片使用） */
export function StaticFieldChip({ label, value, span }: ChipRenderProps) {
  const isFull = span === 2;
  return (
    <div
      className="entry-card-static-chip"
      data-span={span}
      style={isFull ? { gridColumn: '1 / -1' } : undefined}
    >
      <div className="entry-card-static-chip-label">{label}</div>
      <div className="entry-card-static-chip-value">{value}</div>
    </div>
  );
}

/** 只读分组 header（设计器外的卡片使用） */
export function StaticGroupHeader({ group }: GroupHeaderRenderProps) {
  return (
    <div
      className="entry-card-static-group-header"
      style={{
        borderLeftColor: group.color,
        color: group.color,
        borderBottomColor: `color-mix(in srgb, ${group.color} 18%, transparent)`,
      }}
    >
      {group.title}
    </div>
  );
}
