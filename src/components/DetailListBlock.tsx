'use client';

import { useState, useMemo } from 'react';
import { Tag, Tooltip, Table, type TableColumnsType } from 'antd';
import {
  StarOutlined,
  StarFilled,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import { fieldOptionsToFilterItems, type FilterItem } from '@/lib/bitable/filter-options';
import { reuseLevelStyle, FALLBACK_COLOR } from '@/lib/bitable/enums';
import type { FieldSelectOption } from '@/lib/bitable/field-map';
import { FIELD_LABELS, VALUE_FORMULA_COPY } from '@/lib/bitable/labels';
import { formatCurrency, parseMetricNumber, summarizeValueMetrics } from '@/lib/bitable/metrics';

// ── WishItem 类型定义（与 wish-pool/competitions 共用）──
export interface WishItem {
  id: string;
  recordUrl?: string;
  proposalNo?: string;
  title?: string;
  briefIntro?: string;
  sceneCategory?: string;
  coreValue?: string;
  sceneSource?: string;
  regionCoefficient?: string;
  regionCoefficientValue?: number;
  landingProgress?: string;
  competitionProgress?: string;
  reviewPeriod?: string;
  plannedStartDate?: string;
  pilotDate?: string;
  rolloutDate?: string;
  fullLaunchDate?: string;
  progressRecord?: string;
  bizOwner?: string[];
  aiOwner?: string[];
  submitter?: string[];
  teamMembers?: string[];
  creator?: string[];
  team?: string;
  teamType?: string;
  aiTools?: string[];
  beforeProcess?: string;
  painPoints?: string[];
  beforeFrequency?: string;
  beforeOperationCount?: number;
  beforeFreq?: string;
  beforePeopleCount?: number;
  beforeHoursPerTask?: number;
  beforeMonthlyHours?: number;
  monthlySavedHours?: number;
  monthlySavedCost?: number;
  costReductionNote?: string;
  costSavedHours?: number;
  totalSavedHours?: number;
  afterProcess?: string;
  afterFrequency?: string;
  afterOperationCount?: number;
  afterFreq?: string;
  afterPeopleCount?: number;
  afterHoursPerTask?: number;
  afterMonthlyHours?: number;
  aiCost?: number;
  reuseValue?: string;
  reuseValueNumber?: number;
  reuseValueLevel?: string;
  totalEfficiencyRate?: number;
  finalValueScore?: number;
  valueRank?: number;
  implementation?: string;
  implementationLink?: string;
  valueStarLevel?: number | null;
  seq?: number;
}

// ── 常量 ──
export const SORT_OPTIONS = [
  { value: 'finalValueScore', label: '最终价值计分' },
  { value: 'monthlySavedHours', label: '月均提效节省工时' },
  { value: 'totalSavedHours', label: '月均节省总工时' },
  { value: 'monthlySavedCost', label: '月均降本费用' },
  { value: 'reuseValueNumber', label: '复用价值系数' },
];

// ── 工具函数 ──
export function fmt(n: number): string {
  if (n >= 1e4) return (n / 1e4).toFixed(1) + '万';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return Math.round(n).toString();
}
export function fmtF(n: number): string { return n.toLocaleString('zh-CN', { maximumFractionDigits: 0 }); }
export function numOrDash(v: number | null | undefined, unit: string, decimals = 0): string {
  if (v == null) return '—';
  const n = decimals === 0 ? String(Math.round(v)) : v.toFixed(decimals);
  return `${n}${unit}`;
}
export function fmtCost(v: number | string | null | undefined): string {
  return formatCurrency(v);
}

// ── FmtHeader（带问号 tooltip 的表头）──
export function FmtHeader({ label, tip }: { label: string; tip: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <Tooltip title={tip} placement="top">
        <QuestionCircleOutlined style={{ fontSize: 10, color: '#9ca3af', cursor: 'help' }} />
      </Tooltip>
    </span>
  );
}

// ── 篮选行（简约版，无icon）──
export function FilterRow({ label, options, value, onChange }: {
  label: string;
  options: FilterItem[];
  value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{label}</span>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-all"
          style={{
            background: value === opt.value ? '#1a3a8a' : 'rgba(0,0,0,0.04)',
            color: value === opt.value ? '#fff' : 'var(--text-secondary)',
          }}
        >
          {opt.label} <span className="opacity-60">({opt.count})</span>
        </button>
      ))}
    </div>
  );
}

// ── 明细列表区块（排序+筛选+summary+表格，可复用组件）──
export function DetailListBlock({
  baseList,
  label,
  emptyText,
  showMetrics = true,
  labelColor = '#1a3a8a',
  showPendingDates = false,
  fieldDescriptions,
  fieldOptions,
  progressColors,
  onRowEnter,
  onRowLeave,
  onSelectItem,
}: {
  baseList: WishItem[];
  label: string;
  emptyText: string;
  showMetrics?: boolean;
  labelColor?: string;
  showPendingDates?: boolean;
  fieldDescriptions: Record<string, string>;
  fieldOptions: Record<string, FieldSelectOption[]>;
  progressColors: Record<string, string>;
  onRowEnter: (item: WishItem) => void;
  onRowLeave: () => void;
  onSelectItem: (item: WishItem) => void;
}) {
  const [sortBy, setSortBy] = useState('finalValueScore');
  const [titleWidth, setTitleWidth] = useState(180);
  const [sceneCategoryFilter, setSceneCategoryFilter] = useState<string>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');

  // 篮选选项（从 baseList 聚合，count 只反映当前视图的数据）
  const categoryOptions = useMemo(
    () => fieldOptionsToFilterItems('sceneCategory', baseList, fieldOptions, {}),
    [baseList, fieldOptions],
  );
  const teamOptions = useMemo(
    () => fieldOptionsToFilterItems('team', baseList, fieldOptions, {}),
    [baseList, fieldOptions],
  );

  // 篮选+排序后的数据
  const filteredData = useMemo(() => {
    let list = baseList;
    if (sceneCategoryFilter !== 'all') list = list.filter((d) => d.sceneCategory === sceneCategoryFilter);
    if (teamFilter !== 'all') list = list.filter((d) => d.team === teamFilter);
    return [...list].sort((a, b) => {
      switch (sortBy) {
        case 'finalValueScore': return (b.finalValueScore ?? -1) - (a.finalValueScore ?? -1);
        case 'monthlySavedHours': return (b.monthlySavedHours ?? -1) - (a.monthlySavedHours ?? -1);
        case 'totalSavedHours': return (b.totalSavedHours ?? -1) - (a.totalSavedHours ?? -1);
        case 'monthlySavedCost': {
          const aC = parseMetricNumber(a.monthlySavedCost) ?? 0;
          const bC = parseMetricNumber(b.monthlySavedCost) ?? 0;
          return bC - aC;
        }
        case 'reuseValueNumber': return (b.reuseValueNumber ?? -1) - (a.reuseValueNumber ?? -1);
        default: return 0;
      }
    }).map((s, i) => ({ ...s, seq: i + 1 }));
  }, [baseList, sceneCategoryFilter, teamFilter, sortBy]);

  // Summary
  const summary = useMemo(() => {
    return summarizeValueMetrics(filteredData);
  }, [filteredData]);

  // 待实现视图额外列：预计启动日、预计试点上线（仅 showPendingDates 时插入落地进展后面）
  const pendingDateColumns: TableColumnsType<typeof filteredData[number]> = showPendingDates ? [
    { title: <FmtHeader label="预计启动日" tip={fieldDescriptions.plannedStartDate || '计划启动日期'} />, dataIndex: 'plannedStartDate', key: 'psd', width: 90, align: 'center' as const,
      render: (v: string | null) => <span className="text-xs" style={{ color: v ? 'var(--foreground)' : 'var(--text-muted)' }}>{v ? v.slice(0, 10) : '—'}</span> },
    { title: <FmtHeader label="预计试点上线" tip={fieldDescriptions.pilotDate || '试点上线日期'} />, dataIndex: 'pilotDate', key: 'pd', width: 90, align: 'center' as const,
      render: (v: string | null) => <span className="text-xs" style={{ color: v ? 'var(--foreground)' : 'var(--text-muted)' }}>{v ? v.slice(0, 10) : '—'}</span> },
  ] : [];

  // Table columns（3视图共用，列顺序：序号→名称→价值星级→最终价值计分→落地进展→[日期列]→改造成效→复用价值）
  const columns: TableColumnsType<typeof filteredData[number]> = [
    {
      title: '序号', dataIndex: 'seq', key: 'seq', width: 50, align: 'center', fixed: 'left', className: 'cho-frozen-rank',
      render: (seq: number) => <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{seq}</span>,
    },
    {
      title: FIELD_LABELS.title, dataIndex: 'title', key: 'title', width: titleWidth, ellipsis: true,
      onHeaderCell: () => ({
        style: { position: 'relative' },
        children: (
          <div className="flex items-center justify-between">
            <span>{FIELD_LABELS.title}</span>
            <div className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-300" style={{ zIndex: 10 }}
              onMouseDown={(e) => {
                e.preventDefault();
                const startX = e.clientX, startWidth = titleWidth;
                const onMove = (e: MouseEvent) => setTitleWidth(Math.max(100, startWidth + e.clientX - startX));
                const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
                document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
              }}
            />
          </div>
        ),
      }),
      render: (title: string, record) => (
        <div>
          <button onClick={() => onSelectItem(record)} className="text-xs font-medium truncate text-left hover:underline w-full" style={{ color: '#1a3a8a' }}
            onMouseEnter={() => onRowEnter(record)} onMouseLeave={onRowLeave}>
            {title || '—'}
          </button>
          <div className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{record.team || '—'}</div>
        </div>
      ),
    },
    {
      title: <FmtHeader label="价值星级" tip="按最终价值计分排名百分位：前20%=5★，前40%=4★，前60%=3★，前80%=2★，后20%=1★" />,
      dataIndex: 'valueStarLevel', key: 'valueStarLevel', width: 80, align: 'center',
      render: (v: number | null) => {
        if (v == null) return <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>;
        const starColor = v >= 4 ? '#1a3a8a' : v >= 3 ? '#2d5bc7' : '#94a3b8';
        return (
          <span className="inline-flex items-center gap-0.5">
            {Array.from({ length: v }, (_, i) => <StarFilled key={i} style={{ fontSize: 11, color: starColor }} />)}
            {Array.from({ length: 5 - v }, (_, i) => <StarOutlined key={i} style={{ fontSize: 11, color: '#cbd5e1' }} />)}
          </span>
        );
      },
    },
    {
      title: <FmtHeader label="最终价值计分" tip={fieldDescriptions.finalValueScore || '最终价值计分'} />,
      dataIndex: 'finalValueScore', key: 'fvs', width: 80, align: 'center',
      render: (v: number | null) => <span className="font-mono text-xs font-bold" style={{ color: v != null && v > 0 ? '#F27F22' : 'var(--text-muted)' }}>{v != null && v > 0 ? fmtF(Math.round(v)) : '—'}</span>,
    },
    {
      title: '落地进展', dataIndex: 'landingProgress', key: 'landingProgress', width: 90, align: 'center',
      render: (v: string | null) => {
        if (!v) return <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>;
        return <Tag color={progressColors[v] || FALLBACK_COLOR} className="text-[11px]" style={{ margin: 0 }}>{v}</Tag>;
      },
    },
    ...pendingDateColumns,
    {
      title: <FmtHeader label="改造成效" tip="量化改造效果" />,
      key: 'result-group', className: 'cho-group-result',
      children: [
        { title: <FmtHeader label={FIELD_LABELS.monthlySavedHours} tip={fieldDescriptions.monthlySavedHours || FIELD_LABELS.monthlySavedHours} />, dataIndex: 'monthlySavedHours', key: 'sh', width: 80, align: 'center', className: 'cho-col-result',
          render: (v: number | null) => <span className="font-mono text-xs font-bold" style={{ color: v != null && v > 0 ? '#16a34a' : 'var(--text-muted)' }}>{numOrDash(v, 'h')}</span> },
        { title: <FmtHeader label={FIELD_LABELS.monthlySavedCost} tip={fieldDescriptions.monthlySavedCost || '月均降本费用（不含人力成本）'} />, dataIndex: 'monthlySavedCost', key: 'mc', width: 80, align: 'center', className: 'cho-col-result',
          render: (v: number | string | null) => <span className="font-mono text-xs" style={{ color: (parseMetricNumber(v) ?? 0) > 0 ? '#d97706' : 'var(--text-muted)' }}>{fmtCost(v)}</span> },
        { title: <FmtHeader label={FIELD_LABELS.totalSavedHours} tip={fieldDescriptions.totalSavedHours || VALUE_FORMULA_COPY.totalSavedHours} />, dataIndex: 'totalSavedHours', key: 'tsh', width: 90, align: 'center', className: 'cho-col-result',
          render: (v: number | null) => <span className="font-mono text-xs font-bold" style={{ color: v != null && v > 0 ? '#16a34a' : 'var(--text-muted)' }}>{numOrDash(v, 'h')}</span> },
      ],
    },
    {
      title: <FmtHeader label="复用价值" tip="方案可复用范围和地区系数" />,
      key: 'reuse-group', className: 'cho-group-reuse',
      children: [
        { title: <FmtHeader label="复用价值系数" tip="跨团队/BU 复用范围" />, dataIndex: 'reuseValue', key: 'rm', width: 110, align: 'center', className: 'cho-col-reuse',
          render: (v: string | null, record) => {
            if (!v) return <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>;
            const level = record.reuseValueLevel;
            const ls = reuseLevelStyle(level);
            return <span className="inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap" style={{ background: ls.bg, color: ls.fg, border: `1px solid ${ls.border}` }}>{v}</span>;
          },
        },
        { title: <FmtHeader label="地区系数" tip="场景归属地区系数" />, dataIndex: 'regionCoefficient', key: 'rc', width: 70, align: 'center', className: 'cho-col-reuse',
          render: (v: string | null) => <span className="text-xs font-medium" style={{ color: v ? 'var(--foreground)' : 'var(--text-muted)' }}>{v || '—'}</span> },
      ],
    },
  ];

  return (
    <div className="space-y-2">
      {/* 篮选+排序 */}
      <div className="glass rounded-xl px-4 py-3" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>排序</span>
            {SORT_OPTIONS.map((opt) => (
              <button key={opt.value} onClick={() => setSortBy(opt.value)}
                className="px-2 py-0.5 rounded-md text-[11px] font-medium transition-all"
                style={{ background: sortBy === opt.value ? '#1a3a8a' : 'rgba(0,0,0,0.04)', color: sortBy === opt.value ? '#fff' : 'var(--text-secondary)' }}>
                {opt.label}
              </button>
            ))}
          </div>
          <FilterRow label="场景分类" options={categoryOptions} value={sceneCategoryFilter} onChange={setSceneCategoryFilter} />
          <FilterRow label="提报团队" options={teamOptions} value={teamFilter} onChange={setTeamFilter} />
        </div>
      </div>

      {/* 小summary */}
      {showMetrics ? (
        <div className="flex items-center gap-4 text-xs px-2" style={{ color: 'var(--text-muted)' }}>
          <span>共 <strong style={{ color: labelColor }}>{summary.count}</strong> 个{label}</span>
          <span>{FIELD_LABELS.monthlySavedHours} <strong style={{ color: labelColor }}>{summary.totalSavedEfficiency > 0 ? `${summary.totalSavedEfficiency}h` : '—'}</strong></span>
          <span>{FIELD_LABELS.monthlySavedCost} <strong style={{ color: '#4a7de0' }}>{summary.totalMonthlySavedCostDisplay}</strong></span>
        </div>
      ) : (
        <div className="flex items-center gap-4 text-xs px-2" style={{ color: 'var(--text-muted)' }}>
          <span>共 <strong style={{ color: labelColor }}>{summary.count}</strong> 个{label}</span>
        </div>
      )}

      {/* 表格 */}
      {filteredData.length === 0 ? (
        <div className="text-center py-16 glass rounded-2xl" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{emptyText}</p>
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden cho-table-wrap" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
          <Table dataSource={filteredData} columns={columns} rowKey="id" pagination={false} size="small" scroll={{ x: 'max-content' }} rowClassName={() => 'cho-table-row'} />
        </div>
      )}
    </div>
  );
}
