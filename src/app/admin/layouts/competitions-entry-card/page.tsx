'use client';

/**
 * 方案卡片布局可视化编辑器（参考飞书多维表格 / Notion / Figma）
 *
 * 布局：左字段库 + 右画布（设计器 = 卡片最终样子 1:1）
 * 画布双栏网格；字段可跨列变全宽（span 2）；支持撤销/重做。
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { App, Button, Spin, Input, ColorPicker, Tooltip, Empty, Select } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  HolderOutlined,
  ReloadOutlined,
  SaveOutlined,
  UndoOutlined,
  RedoOutlined,
  ColumnHeightOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import {
  ENTRY_CARD_FIELD_POOL,
  DEFAULT_ENTRY_CARD_LAYOUT,
  getFieldSpan,
  renderFieldValue,
  type EntryCardLayout,
  type EntryCardGroup,
  type FieldSpan,
} from '@/lib/entry-card-layout';
import { renderHeaderField } from '@/components/EntryCard/renderHeaderField';

// ─── Mock 数据（设计器预览用）───
const MOCK_ENTRY = {
  proposalNo: 'S2026-042',
  title: 'AI 智能客服辅助 — 一线客服工单秒级摘要与回复建议',
  briefIntro: '基于历史工单库 + GPT-4o，3 秒生成摘要、5 秒出回复建议',
  sceneCategory: '客服与售后',
  competitionProgress: '评审中',
  team: '客服一组',
  teamType: '跨部门',
  submitter: ['张三', '李四'],
  teamMembers: ['张三', '李四', '王五', '赵六'],
  aiTools: ['GPT-4o', '内部 RAG', '飞书多维表格'],
  landingProgress: '试点中',
  monthlySavedHours: 320,
  monthlySavedCost: 12800,
  totalSavedHours: 540,
  totalEfficiencyRate: 0.42,
  reuseValueLevel: '高',
  regionCoefficient: '1.2x',
  finalValueScore: 87,
  valueRank: 3,
};

const LAYOUT_KEY = 'competitions-entry-card';
const HISTORY_LIMIT = 30;

// ────────────────────────────────────────────────────────────────────
// 可拖拽字段 chip（带跨列切换 + × 删除 + 真实值预览）
// ────────────────────────────────────────────────────────────────────

function SortableFieldChip({
  fieldKey,
  groupId,
  span,
  label,
  value,
  onRemove,
  onToggleSpan,
}: {
  fieldKey: string;
  groupId: string;
  span: FieldSpan;
  label: string;
  value: React.ReactNode;
  onRemove: () => void;
  onToggleSpan: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `field__${groupId}__${fieldKey}`,
    data: { type: 'field', fieldKey, groupId },
  });
  const isFull = span === 2;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
        gridColumn: isFull ? '1 / -1' : undefined,
      }}
      {...attributes}
      {...listeners}
      className="entry-card-edit-chip"
      data-span={span}
    >
      <HolderOutlined className="entry-card-edit-chip-drag" />
      <div className="entry-card-edit-chip-body">
        <div className="entry-card-edit-chip-label">{label}</div>
        <div className="entry-card-edit-chip-value">{value}</div>
      </div>
      <div className="entry-card-edit-chip-actions">
        <Tooltip title={isFull ? '改为单列' : '改为全宽'}>
          <span
            className="entry-card-edit-chip-action"
            onClick={(e) => { e.stopPropagation(); onToggleSpan(); }}
            onPointerDown={(e) => e.stopPropagation()}
            data-active={isFull ? 'true' : undefined}
          >
            <ColumnHeightOutlined />
          </span>
        </Tooltip>
        <Tooltip title="删除">
          <span
            className="entry-card-edit-chip-action entry-card-edit-chip-remove"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            ×
          </span>
        </Tooltip>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// 可拖拽分组 header
// ────────────────────────────────────────────────────────────────────

function SortableGroupHeader({
  group,
  onUpdate,
  onDelete,
}: {
  group: EntryCardGroup;
  onUpdate: (g: EntryCardGroup) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `group__${group.id}`,
    data: { type: 'group', groupId: group.id },
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        borderLeftColor: group.color,
      }}
      className="entry-card-edit-group-header"
    >
      <HolderOutlined
        {...attributes}
        {...listeners}
        className="entry-card-edit-group-drag"
        style={{ color: group.color }}
      />
      <Input
        size="small"
        value={group.title}
        onChange={(e) => onUpdate({ ...group, title: e.target.value })}
        className="entry-card-edit-group-title"
      />
      <ColorPicker
        size="small"
        value={group.color}
        onChange={(c) => onUpdate({ ...group, color: c.toHexString() })}
      />
      <Tooltip title="删除分组">
        <Button size="small" type="text" icon={<DeleteOutlined />} danger onClick={onDelete} />
      </Tooltip>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// 单个分组（header + 网格）
// ────────────────────────────────────────────────────────────────────

function EditGroup({
  group,
  onRemoveField,
  onToggleSpan,
  onUpdateGroup,
  onDeleteGroup,
}: {
  group: EntryCardGroup;
  onRemoveField: (fieldKey: string) => void;
  onToggleSpan: (fieldKey: string) => void;
  onUpdateGroup: (g: EntryCardGroup) => void;
  onDeleteGroup: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `groupdrop__${group.id}`,
    data: { type: 'group-drop', groupId: group.id },
  });

  return (
    <div className="entry-card-edit-section">
      <SortableGroupHeader group={group} onUpdate={onUpdateGroup} onDelete={onDeleteGroup} />
      <div
        ref={setNodeRef}
        className="entry-card-edit-group-body"
        style={{ borderLeftColor: group.color }}
        data-over={isOver ? 'true' : undefined}
      >
        <SortableContext
          items={group.fields.map((k) => `field__${group.id}__${k}`)}
          strategy={rectSortingStrategy}
        >
          <div className="entry-card-view-grid">
            {group.fields.length === 0 ? (
              <div className="entry-card-edit-group-empty">点左侧字段库添加，或拖字段到这里</div>
            ) : (
              group.fields.map((fieldKey) => {
                const def = ENTRY_CARD_FIELD_POOL.find((f) => f.key === fieldKey);
                if (!def) return null;
                return (
                  <SortableFieldChip
                    key={fieldKey}
                    fieldKey={fieldKey}
                    groupId={group.id}
                    span={getFieldSpan(group, fieldKey)}
                    label={def.label}
                    value={renderFieldValue(MOCK_ENTRY, fieldKey)}
                    onRemove={() => onRemoveField(fieldKey)}
                    onToggleSpan={() => onToggleSpan(fieldKey)}
                  />
                );
              })
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// 卡片预览头部（设计器模式，与最终样式一致）
// ────────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────────
// 头部（设计器：可拖字段进 header，按 headerStyle 自适应排版）
// ────────────────────────────────────────────────────────────────────

function SortableHeaderField({
  fieldKey,
  label,
  style,
  onRemove,
}: {
  fieldKey: string;
  label: string;
  style: import('@/lib/entry-card-layout').HeaderFieldStyle;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `header__${fieldKey}`,
    data: { type: 'header-field', fieldKey },
  });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
      }}
      className="entry-card-edit-header-field"
      data-style={style}
    >
      <HolderOutlined
        {...attributes}
        {...listeners}
        className="entry-card-edit-header-field-drag"
      />
      <div className="entry-card-edit-header-field-content">
        {renderHeaderField(MOCK_ENTRY, fieldKey, style, label)}
      </div>
      <span
        className="entry-card-edit-header-field-remove"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        ×
      </span>
    </div>
  );
}

function CardPreviewHeader({
  layout,
  onRemoveField,
}: {
  layout: EntryCardLayout;
  onRemoveField: (fieldKey: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'header-drop',
    data: { type: 'header-drop' },
  });
  return (
    <div
      ref={setNodeRef}
      className="entry-card-view-header entry-card-edit-header"
      data-over={isOver ? 'true' : undefined}
    >
      <SortableContext
        items={layout.header.fields.map((f) => `header__${f}`)}
        strategy={rectSortingStrategy}
      >
        {layout.header.fields.length === 0 ? (
          <div className="entry-card-edit-header-empty">
            点左侧字段库添加，或拖字段到这里
          </div>
        ) : (
          layout.header.fields.map((fieldKey) => {
            const def = ENTRY_CARD_FIELD_POOL.find((f) => f.key === fieldKey);
            if (!def) return null;
            return (
              <SortableHeaderField
                key={fieldKey}
                fieldKey={fieldKey}
                label={def.label}
                style={def.headerStyle}
                onRemove={() => onRemoveField(fieldKey)}
              />
            );
          })
        )}
      </SortableContext>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// 底部高亮区（自动）
// ────────────────────────────────────────────────────────────────────

function HighlightsSection({ layout }: { layout: EntryCardLayout }) {
  const allFields = layout.groups.flatMap((g) => g.fields);
  const showFinalScore = allFields.includes('finalValueScore');
  const showRank = allFields.includes('valueRank');
  if (!showFinalScore && !showRank) return null;
  return (
    <div className="entry-card-view-highlights">
      {showFinalScore && (
        <div className="entry-card-view-highlights-cell">
          <div className="entry-card-view-highlights-label">最终价值计分</div>
          <div className="entry-card-view-highlights-value" style={{ color: '#F27F22' }}>
            {Math.round(MOCK_ENTRY.finalValueScore)}
          </div>
        </div>
      )}
      {showRank && (
        <div className="entry-card-view-highlights-cell">
          <div className="entry-card-view-highlights-label">价值排名</div>
          <div className="entry-card-view-highlights-value" style={{ color: '#1a3a8a' }}>
            #{MOCK_ENTRY.valueRank}
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// 字段库面板（左侧）
// ────────────────────────────────────────────────────────────────────

function FieldLibrary({
  groups,
  selectedGroupId,
  onSelectGroup,
  usedByLocation,
  onAdd,
}: {
  groups: EntryCardGroup[];
  selectedGroupId: string | null;
  onSelectGroup: (id: string | null) => void;
  usedByLocation: (key: string) => { header: boolean; group: string | null };
  onAdd: (fieldKey: string, targetGroupId: string | null) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, typeof ENTRY_CARD_FIELD_POOL>();
    ENTRY_CARD_FIELD_POOL.forEach((f) => {
      if (!map.has(f.group)) map.set(f.group, []);
      map.get(f.group)!.push(f);
    });
    return Array.from(map.entries());
  }, []);

  return (
    <div className="entry-card-field-library">
      <div className="entry-card-field-library-title">字段库</div>
      <div className="entry-card-field-library-hint">点击字段添加到「目标分组」</div>
      <div className="entry-card-field-library-select">
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 6 }}>目标：</span>
        <Select
          size="small"
          value={selectedGroupId ?? undefined}
          onChange={(v) => onSelectGroup(v ?? null)}
          placeholder="第一个分组"
          style={{ flex: 1 }}
          allowClear
          options={groups.map((g) => ({ label: g.title, value: g.id }))}
        />
      </div>
      <div className="entry-card-field-library-body">
        {grouped.map(([groupName, fields]) => (
          <div key={groupName} className="entry-card-field-library-group">
            <div className="entry-card-field-library-group-title">{groupName}</div>
            <div className="entry-card-field-library-fields">
              {fields.map((f) => {
                const loc = usedByLocation(f.key);
                const fullyUsed = loc.header && loc.group; // 两处都用了才 disable
                const tooltipText = fullyUsed
                  ? `已在 header + 「${loc.group}」中`
                  : loc.header
                    ? '已在 header 中（点击加到分组）'
                    : loc.group
                      ? `已在「${loc.group}」中（点击加到 header）`
                      : '点击添加';
                return (
                  <Tooltip key={f.key} title={tooltipText}>
                    <Button
                      size="small"
                      disabled={!!fullyUsed}
                      onClick={() => onAdd(f.key, selectedGroupId)}
                      className="entry-card-field-library-item"
                      data-used={loc.header || loc.group ? 'true' : undefined}
                    >
                      {loc.header || loc.group ? <CheckOutlined /> : <PlusOutlined />}
                      <span>{f.label}</span>
                    </Button>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// 主页面
// ────────────────────────────────────────────────────────────────────

export default function EntryCardLayoutEditorPage() {
  const { message, modal } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [layout, setLayout] = useState<EntryCardLayout>(DEFAULT_ENTRY_CARD_LAYOUT);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // ── 撤销/重做 ──
  const historyRef = useRef<EntryCardLayout[]>([DEFAULT_ENTRY_CARD_LAYOUT]);
  const cursorRef = useRef(0);
  const [historyCursor, setHistoryCursor] = useState(0);
  const [historyLength, setHistoryLength] = useState(1);
  const canUndo = historyCursor > 0;
  const canRedo = historyCursor < historyLength - 1;

  const pushHistory = useCallback((newLayout: EntryCardLayout) => {
    const truncated = historyRef.current.slice(0, cursorRef.current + 1);
    truncated.push(newLayout);
    if (truncated.length > HISTORY_LIMIT) truncated.shift();
    historyRef.current = truncated;
    cursorRef.current = truncated.length - 1;
    setHistoryCursor(cursorRef.current);
    setHistoryLength(truncated.length);
    setLayout(newLayout);
  }, []);

  const undo = useCallback(() => {
    if (!canUndo) return;
    cursorRef.current -= 1;
    setHistoryCursor(cursorRef.current);
    setLayout(historyRef.current[cursorRef.current]);
  }, [canUndo]);

  const redo = useCallback(() => {
    if (!canRedo) return;
    cursorRef.current += 1;
    setHistoryCursor(cursorRef.current);
    setLayout(historyRef.current[cursorRef.current]);
  }, [canRedo]);

  // ── 拖拽状态 ──
  const [activeDrag, setActiveDrag] = useState<
    | { kind: 'field'; fieldKey: string; label: string; groupId: string; span: FieldSpan }
    | { kind: 'group'; groupId: string; title: string }
    | null
  >(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // 初始加载
  useEffect(() => {
    fetch(`/api/layouts/${LAYOUT_KEY}`)
      .then((r) => r.json())
      .then((d) => {
        const initial = d.config ?? DEFAULT_ENTRY_CARD_LAYOUT;
        historyRef.current = [initial];
        cursorRef.current = 0;
        setHistoryCursor(0);
        setHistoryLength(1);
        setLayout(initial);
      })
      .catch(() => message.error('加载布局失败'))
      .finally(() => setLoading(false));
  }, [message]);

  // 字段 → 在 layout 里的位置
  //   - null: 没用过
  //   - { header: true, group: 'xxx' }: 在 header 和 xxx 组里都有
  //   - { header: false, group: 'xxx' }: 只在 xxx 组
  //   - { header: true, group: null }: 只在 header
  const usedByLocation = useMemo(() => {
    const map = new Map<string, { header: boolean; group: string | null }>();
    layout.header.fields.forEach((f) => {
      map.set(f, { header: true, group: map.get(f)?.group ?? null });
    });
    layout.groups.forEach((g) => {
      g.fields.forEach((f) => {
        const existing = map.get(f) ?? { header: false, group: null };
        map.set(f, { header: existing.header, group: g.title });
      });
    });
    return (key: string) => map.get(key) ?? { header: false, group: null };
  }, [layout]);

  // 旧 API 兼容（仅返回组名）
  const usedByGroup = useCallback(
    (key: string) => usedByLocation(key).group,
    [usedByLocation],
  );

  // ── 操作 ──
  /**
   * 智能添加字段：
   *   - 字段不在 layout 中（header / group 都没有） → 加到 header
   *   - 已在 header 但不在 group → 加到第一个 group
   *   - 已在 group 但不在 header → 加到 header
   *   - 两处都有 → 不可加（按钮 disabled）
   *
   * targetGroupId 是字段库面板里的「目标分组」下拉，强制加到指定 group。
   */
  const handleAddField = useCallback(
    (fieldKey: string, targetGroupId: string | null) => {
      const inHeader = layout.header.fields.includes(fieldKey);
      const inAnyGroup = layout.groups.some((g) => g.fields.includes(fieldKey));

      if (targetGroupId) {
        // 强制加到指定 group
        pushHistory({
          ...layout,
          groups: layout.groups.map((g) =>
            g.id === targetGroupId ? { ...g, fields: [...g.fields, fieldKey] } : g,
          ),
        });
        return;
      }

      if (!inHeader && !inAnyGroup) {
        // 加到 header
        pushHistory({
          ...layout,
          header: { fields: [...layout.header.fields, fieldKey] },
        });
        return;
      }
      if (inHeader && !inAnyGroup) {
        // 加到第一个 group
        const target = layout.groups[0]?.id;
        if (!target) {
          message.warning('请先添加一个分组');
          return;
        }
        pushHistory({
          ...layout,
          groups: layout.groups.map((g) =>
            g.id === target ? { ...g, fields: [...g.fields, fieldKey] } : g,
          ),
        });
        return;
      }
      if (!inHeader && inAnyGroup) {
        // 加到 header
        pushHistory({
          ...layout,
          header: { fields: [...layout.header.fields, fieldKey] },
        });
      }
    },
    [layout, pushHistory, message],
  );

  const handleRemoveField = useCallback(
    (groupId: string, fieldKey: string) => {
      pushHistory({
        ...layout,
        groups: layout.groups.map((g) =>
          g.id === groupId ? { ...g, fields: g.fields.filter((f) => f !== fieldKey) } : g,
        ),
      });
    },
    [layout, pushHistory],
  );

  const handleRemoveHeaderField = useCallback(
    (fieldKey: string) => {
      pushHistory({
        ...layout,
        header: { fields: layout.header.fields.filter((f) => f !== fieldKey) },
      });
    },
    [layout, pushHistory],
  );

  const handleToggleSpan = useCallback(
    (groupId: string, fieldKey: string) => {
      pushHistory({
        ...layout,
        groups: layout.groups.map((g) => {
          if (g.id !== groupId) return g;
          const current = getFieldSpan(g, fieldKey);
          const newSpan: FieldSpan = current === 1 ? 2 : 1;
          const spans = { ...(g.fieldSpans ?? {}) };
          if (newSpan === 1) delete spans[fieldKey];
          else spans[fieldKey] = newSpan;
          return { ...g, fieldSpans: spans };
        }),
      });
    },
    [layout, pushHistory],
  );

  const handleUpdateGroup = useCallback(
    (updated: EntryCardGroup) => {
      pushHistory({
        ...layout,
        groups: layout.groups.map((g) => (g.id === updated.id ? updated : g)),
      });
    },
    [layout, pushHistory],
  );

  const handleAddGroup = useCallback(() => {
    const id = `g_${Date.now()}`;
    pushHistory({
      ...layout,
      groups: [
        ...layout.groups,
        { id, title: '新分组', color: '#6b7280', fields: [], fieldSpans: {} },
      ],
    });
  }, [layout, pushHistory]);

  const handleDeleteGroup = useCallback(
    (groupId: string) => {
      modal.confirm({
        title: '确认删除分组？',
        content: '该分组下的字段会回到字段库，可随时再加回来',
        okText: '删除',
        cancelText: '取消',
        okButtonProps: { danger: true },
        onOk: () => {
          pushHistory({
            ...layout,
            groups: layout.groups.filter((g) => g.id !== groupId),
          });
        },
      });
    },
    [layout, pushHistory, modal],
  );

  // ── 拖拽处理 ──
  function handleDragStart(e: DragStartEvent) {
    const data = e.active.data.current as
      | { type: 'field'; fieldKey: string; groupId: string }
      | { type: 'group'; groupId: string }
      | { type: 'header-field'; fieldKey: string }
      | undefined;
    if (!data) return;
    if (data.type === 'field') {
      const def = ENTRY_CARD_FIELD_POOL.find((f) => f.key === data.fieldKey);
      const g = layout.groups.find((x) => x.id === data.groupId);
      setActiveDrag({
        kind: 'field',
        fieldKey: data.fieldKey,
        label: def?.label ?? data.fieldKey,
        groupId: data.groupId,
        span: g ? getFieldSpan(g, data.fieldKey) : 1,
      });
    } else if (data.type === 'group') {
      const g = layout.groups.find((x) => x.id === data.groupId);
      setActiveDrag({
        kind: 'group',
        groupId: data.groupId,
        title: g?.title ?? data.groupId,
      });
    } else if (data.type === 'header-field') {
      const def = ENTRY_CARD_FIELD_POOL.find((f) => f.key === data.fieldKey);
      setActiveDrag({
        kind: 'header-field',
        fieldKey: data.fieldKey,
        label: def?.label ?? data.fieldKey,
        style: def?.headerStyle ?? 'tag',
      });
    }
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveDrag(null);
    const { active, over } = e;
    if (!over) return;

    const activeData = active.data.current as
      | { type: 'field'; fieldKey: string; groupId: string }
      | { type: 'group'; groupId: string }
      | undefined;
    if (!activeData) return;

    const overId = String(over.id);

    if (activeData.type === 'field') {
      const fromGroupId = activeData.groupId;
      const fieldKey = activeData.fieldKey;

      const overFieldMatch = overId.match(/^field__(.+?)__(.+)$/);
      if (overFieldMatch) {
        const [, toGroupId, overFieldKey] = overFieldMatch;
        if (fromGroupId === toGroupId && fieldKey === overFieldKey) return;
        pushHistory({
          ...layout,
          groups: layout.groups.map((g) => {
            if (g.id === fromGroupId && g.id === toGroupId) {
              const oldIdx = g.fields.indexOf(fieldKey);
              const newIdx = g.fields.indexOf(overFieldKey);
              if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) return g;
              return { ...g, fields: arrayMove(g.fields, oldIdx, newIdx) };
            }
            if (g.id === fromGroupId) {
              return { ...g, fields: g.fields.filter((f) => f !== fieldKey) };
            }
            if (g.id === toGroupId) {
              const idx = g.fields.indexOf(overFieldKey);
              const newFields = [...g.fields];
              if (idx < 0) newFields.push(fieldKey);
              else newFields.splice(idx, 0, fieldKey);
              return { ...g, fields: newFields };
            }
            return g;
          }),
        });
        return;
      }

      const overDropMatch = overId.match(/^groupdrop__(.+)$/);
      if (overDropMatch) {
        const toGroupId = overDropMatch[1];
        if (fromGroupId === toGroupId) return;
        pushHistory({
          ...layout,
          groups: layout.groups.map((g) => {
            if (g.id === fromGroupId) return { ...g, fields: g.fields.filter((f) => f !== fieldKey) };
            if (g.id === toGroupId) return { ...g, fields: [...g.fields, fieldKey] };
            return g;
          }),
        });
      }
      return;
    }

    if (activeData.type === 'group') {
      const overGroupMatch = overId.match(/^group__(.+)$/);
      if (overGroupMatch) {
        const toGroupId = overGroupMatch[1];
        if (activeData.groupId === toGroupId) return;
        pushHistory({
          ...layout,
          groups: arrayMove(
            layout.groups,
            layout.groups.findIndex((g) => g.id === activeData.groupId),
            layout.groups.findIndex((g) => g.id === toGroupId),
          ),
        });
      }
    }
  }

  // ── 保存 / 恢复默认 ──
  async function handleSave() {
    setSaving(true);
    try {
      const r = await fetch(`/api/layouts/${LAYOUT_KEY}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: layout }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || '保存失败');
      message.success('布局已保存');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    modal.confirm({
      title: '恢复默认布局？',
      content: '会清空当前自定义，回到系统默认（不影响撤销历史）',
      okText: '恢复',
      cancelText: '取消',
      onOk: () => pushHistory(DEFAULT_ENTRY_CARD_LAYOUT),
    });
  }

  // ── 键盘快捷键 ──
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault();
        redo();
      } else if (e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undo, redo]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <Spin />
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDrag(null)}
    >
      <div className="entry-card-editor-page">
        {/* 顶部 */}
        <div className="entry-card-editor-topbar">
          <div>
            <h1 className="entry-card-editor-page-title">方案卡片布局</h1>
            <p className="entry-card-editor-page-sub">
              左字段库 · 右画布（设计器与最终卡片 1:1） · 拖字段排序 / 跨组 · 字段可跨列
            </p>
          </div>
          <div className="entry-card-editor-topbar-actions">
            <Tooltip title="撤销 (Ctrl+Z)">
              <Button icon={<UndoOutlined />} disabled={!canUndo} onClick={undo} />
            </Tooltip>
            <Tooltip title="重做 (Ctrl+Shift+Z)">
              <Button icon={<RedoOutlined />} disabled={!canRedo} onClick={redo} />
            </Tooltip>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>恢复默认</Button>
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
              保存配置
            </Button>
          </div>
        </div>

        {/* 主体 */}
        <div className="entry-card-editor-main">
          <FieldLibrary
            groups={layout.groups}
            selectedGroupId={selectedGroupId}
            onSelectGroup={setSelectedGroupId}
            usedByLocation={usedByLocation}
            onAdd={handleAddField}
          />

          <div className="entry-card-editor-canvas">
            <div className="entry-card-view">
              <CardPreviewHeader
                layout={layout}
                onRemoveField={handleRemoveHeaderField}
              />

              {layout.groups.length === 0 ? (
                <Empty description="还没有分组，点下方「+ 添加分组」开始" style={{ margin: 32 }} />
              ) : (
                <SortableContext
                  items={layout.groups.map((g) => `group__${g.id}`)}
                  strategy={rectSortingStrategy}
                >
                  {layout.groups.map((g) => (
                    <EditGroup
                      key={g.id}
                      group={g}
                      onRemoveField={(fk) => handleRemoveField(g.id, fk)}
                      onToggleSpan={(fk) => handleToggleSpan(g.id, fk)}
                      onUpdateGroup={handleUpdateGroup}
                      onDeleteGroup={() => handleDeleteGroup(g.id)}
                    />
                  ))}
                </SortableContext>
              )}

              <HighlightsSection layout={layout} />

              <div className="entry-card-editor-add-group">
                <Button icon={<PlusOutlined />} onClick={handleAddGroup}>添加分组</Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeDrag?.kind === 'field' ? (
          <div
            className="entry-card-edit-chip"
            data-span={activeDrag.span}
            style={{
              background: 'rgba(26,58,138,0.95)',
              color: 'white',
              boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
              cursor: 'grabbing',
              gridColumn: activeDrag.span === 2 ? '1 / -1' : undefined,
            }}
          >
            <HolderOutlined className="entry-card-edit-chip-drag" style={{ color: 'white' }} />
            <div className="entry-card-edit-chip-body">
              <div className="entry-card-edit-chip-label" style={{ color: 'white' }}>
                {activeDrag.label}
              </div>
            </div>
          </div>
        ) : activeDrag?.kind === 'group' ? (
          <div
            style={{
              padding: '8px 14px',
              background: 'rgba(26,58,138,0.95)',
              color: 'white',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
            }}
          >
            {activeDrag.title}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
