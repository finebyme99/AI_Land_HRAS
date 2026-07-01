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
import type { PersonProfile } from '@/lib/person-profile';
import { getDisplayProfiles, PersonContactNames, personContactPlainText } from '@/components/PersonContactDisplay';

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
  bizOwnerProfiles?: PersonProfile[];
  aiOwnerProfiles?: PersonProfile[];
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
export function fmtDate(v: string | null | undefined): string | null {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const date = new Date(v);
  if (Number.isNaN(date.getTime())) return v.slice(0, 10);
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

type ColumnWidthKey =
  | 'seq'
  | 'title'
  | 'valueStarLevel'
  | 'finalValueScore'
  | 'landingProgress'
  | 'progressRecord'
  | 'plannedStartDate'
  | 'team'
  | 'bizOwner'
  | 'aiOwner'
  | 'monthlySavedHours'
  | 'monthlySavedCost'
  | 'totalSavedHours'
  | 'reuseValue'
  | 'regionCoefficient';

interface ColumnWidthRule {
  min: number;
  max: number;
  manualMax: number;
}

const COLUMN_WIDTH_RULES: Record<ColumnWidthKey, ColumnWidthRule> = {
  seq: { min: 50, max: 50, manualMax: 50 },
  title: { min: 180, max: 320, manualMax: 560 },
  valueStarLevel: { min: 82, max: 96, manualMax: 130 },
  finalValueScore: { min: 86, max: 112, manualMax: 150 },
  landingProgress: { min: 92, max: 128, manualMax: 170 },
  progressRecord: { min: 120, max: 200, manualMax: 200 },
  plannedStartDate: { min: 106, max: 128, manualMax: 180 },
  team: { min: 96, max: 170, manualMax: 260 },
  bizOwner: { min: 112, max: 220, manualMax: 360 },
  aiOwner: { min: 108, max: 200, manualMax: 320 },
  monthlySavedHours: { min: 112, max: 136, manualMax: 180 },
  monthlySavedCost: { min: 104, max: 136, manualMax: 180 },
  totalSavedHours: { min: 112, max: 138, manualMax: 190 },
  reuseValue: { min: 130, max: 230, manualMax: 360 },
  regionCoefficient: { min: 78, max: 118, manualMax: 160 },
};

const COST_SCOPE_NOTE = '（不含内部人力成本）';

function clampWidth(width: number, rule: Pick<ColumnWidthRule, 'min' | 'max'>): number {
  return Math.max(rule.min, Math.min(rule.max, Math.ceil(width)));
}

function estimateTextWidth(value: string): number {
  return Array.from(value).reduce((sum, ch) => {
    if (/[\u4e00-\u9fff]/.test(ch)) return sum + 13;
    if (/[A-Z0-9]/.test(ch)) return sum + 8;
    if (/[a-z]/.test(ch)) return sum + 7;
    return sum + 6;
  }, 0);
}

function estimateColumnWidth(header: string, values: Array<string | null | undefined>, rule: ColumnWidthRule): number {
  const measured = [header, ...values.filter((v): v is string => !!v)]
    .map((value) => estimateTextWidth(value) + 36);
  return clampWidth(Math.max(...measured, rule.min), rule);
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

function MultiSelectFilterRow({ label, options, values, onChange }: {
  label: string;
  options: FilterItem[];
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const selected = new Set(values);
  const optionItems = options.filter((opt) => opt.value !== 'all');

  const toggleValue = (value: string) => {
    if (selected.has(value)) {
      onChange(values.filter((v) => v !== value));
      return;
    }
    onChange([...values, value]);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <button
        onClick={() => onChange([])}
        className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-all"
        style={{
          background: values.length === 0 ? '#1a3a8a' : 'rgba(0,0,0,0.04)',
          color: values.length === 0 ? '#fff' : 'var(--text-secondary)',
        }}
      >
        全部 <span className="opacity-60">({options[0]?.count ?? 0})</span>
      </button>
      {optionItems.map((opt) => {
        const isActive = selected.has(opt.value);
        return (
          <button
            key={opt.value}
            onClick={() => toggleValue(opt.value)}
            className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-all"
            style={{
              background: isActive ? '#1a3a8a' : 'rgba(0,0,0,0.04)',
              color: isActive ? '#fff' : 'var(--text-secondary)',
            }}
          >
            {opt.label} <span className="opacity-60">({opt.count})</span>
          </button>
        );
      })}
    </div>
  );
}

type DetailSummaryMode = 'default' | 'overview';

export function DetailSummaryHeadline({
  count,
  label,
  totalSavedEfficiency,
  totalMonthlySavedCostDisplay,
  showMetrics = true,
  showEstimatedValueLabel = false,
  labelColor = '#1a3a8a',
  summaryMode = 'default',
}: {
  count: number;
  label: string;
  totalSavedEfficiency: number;
  totalMonthlySavedCostDisplay: string;
  showMetrics?: boolean;
  showEstimatedValueLabel?: boolean;
  labelColor?: string;
  summaryMode?: DetailSummaryMode;
}) {
  const summaryAccentColor = labelColor === '#94a3b8' ? '#1a3a8a' : labelColor;

  return (
    <div className="cho-summary-headline" data-export-card>
      <span className="cho-summary-headline-main">
        共
        <strong className="cho-summary-headline-count" style={{ color: summaryAccentColor }}>{count}</strong>
        个{label}
        {summaryMode === 'overview' && '（含已落地、待实现）'}
      </span>
      {showMetrics && (
        <>
          {(summaryMode === 'overview' || showEstimatedValueLabel) && (
            <span className="cho-summary-headline-meta">预估价值：</span>
          )}
          <span className="cho-summary-headline-meta">
            {FIELD_LABELS.monthlySavedHours} <strong style={{ color: summaryAccentColor }}>{totalSavedEfficiency > 0 ? `${totalSavedEfficiency}h` : '—'}</strong>
          </span>
          <span className="cho-summary-headline-meta">
            {FIELD_LABELS.monthlySavedCost} <strong style={{ color: '#4a7de0' }}>{totalMonthlySavedCostDisplay}</strong>{COST_SCOPE_NOTE}
          </span>
        </>
      )}
    </div>
  );
}

export function DetailListFilterPanel({
  sortBy,
  onSortChange,
  categoryOptions,
  sceneCategoryFilter,
  onSceneCategoryChange,
  teamOptions,
  teamFilter,
  onTeamChange,
  showLandingProgressFilter = false,
  landingProgressOptions = [],
  landingProgressFilters = [],
  onLandingProgressChange,
}: {
  sortBy: string;
  onSortChange: (v: string) => void;
  categoryOptions: FilterItem[];
  sceneCategoryFilter: string;
  onSceneCategoryChange: (v: string) => void;
  teamOptions: FilterItem[];
  teamFilter: string;
  onTeamChange: (v: string) => void;
  showLandingProgressFilter?: boolean;
  landingProgressOptions?: FilterItem[];
  landingProgressFilters?: string[];
  onLandingProgressChange?: (v: string[]) => void;
}) {
  return (
    <div className="glass rounded-xl px-4 py-3" data-export-card style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>排序</span>
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onSortChange(opt.value)}
              className="px-2 py-0.5 rounded-md text-[11px] font-medium transition-all"
              style={{
                background: sortBy === opt.value ? '#1a3a8a' : 'rgba(0,0,0,0.04)',
                color: sortBy === opt.value ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <FilterRow label="场景分类" options={categoryOptions} value={sceneCategoryFilter} onChange={onSceneCategoryChange} />
        <FilterRow label="提报团队" options={teamOptions} value={teamFilter} onChange={onTeamChange} />
        {showLandingProgressFilter && onLandingProgressChange && (
          <MultiSelectFilterRow
            label={FIELD_LABELS.landingProgress}
            options={landingProgressOptions}
            values={landingProgressFilters}
            onChange={onLandingProgressChange}
          />
        )}
      </div>
    </div>
  );
}

// ── 明细列表区块（排序+筛选+summary+表格，可复用组件）──
export function DetailListBlock({
  baseList,
  label,
  emptyText,
  defaultSortBy = 'finalValueScore',
  defaultSceneCategoryFilter = 'all',
  defaultTeamFilter = 'all',
  showMetrics = true,
  showSummary = true,
  emphasizeSummary = false,
  showEstimatedValueLabel = false,
  summaryMode = 'default',
  labelColor = '#1a3a8a',
  showLandingProgressFilter = false,
  showLandingPlanColumns = false,
  defaultLandingProgressFilters = [],
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
  defaultSortBy?: string;
  defaultSceneCategoryFilter?: string;
  defaultTeamFilter?: string;
  showMetrics?: boolean;
  showSummary?: boolean;
  emphasizeSummary?: boolean;
  showEstimatedValueLabel?: boolean;
  summaryMode?: DetailSummaryMode;
  labelColor?: string;
  showLandingProgressFilter?: boolean;
  showLandingPlanColumns?: boolean;
  defaultLandingProgressFilters?: string[];
  fieldDescriptions: Record<string, string>;
  fieldOptions: Record<string, FieldSelectOption[]>;
  progressColors: Record<string, string>;
  onRowEnter: (item: WishItem) => void;
  onRowLeave: () => void;
  onSelectItem: (item: WishItem) => void;
}) {
  const [sortBy, setSortBy] = useState(defaultSortBy);
  const [sceneCategoryFilter, setSceneCategoryFilter] = useState<string>(defaultSceneCategoryFilter);
  const [teamFilter, setTeamFilter] = useState<string>(defaultTeamFilter);
  const [landingProgressFilters, setLandingProgressFilters] = useState<string[]>(defaultLandingProgressFilters);
  const [manualColumnWidths, setManualColumnWidths] = useState<Partial<Record<ColumnWidthKey, number>>>({});
  const [expandedCells, setExpandedCells] = useState<Set<string>>(() => new Set());

  // 篮选选项（从 baseList 聚合，count 只反映当前视图的数据）
  const categoryOptions = useMemo(
    () => fieldOptionsToFilterItems('sceneCategory', baseList, fieldOptions, {}),
    [baseList, fieldOptions],
  );
  const teamOptions = useMemo(
    () => fieldOptionsToFilterItems('team', baseList, fieldOptions, {}),
    [baseList, fieldOptions],
  );
  const landingProgressOptions = useMemo(
    () => fieldOptionsToFilterItems('landingProgress', baseList, fieldOptions, {}),
    [baseList, fieldOptions],
  );

  // 篮选+排序后的数据
  const filteredData = useMemo(() => {
    let list = baseList;
    if (sceneCategoryFilter !== 'all') list = list.filter((d) => d.sceneCategory === sceneCategoryFilter);
    if (teamFilter !== 'all') list = list.filter((d) => d.team === teamFilter);
    if (showLandingProgressFilter && landingProgressFilters.length > 0) {
      list = list.filter((d) => d.landingProgress && landingProgressFilters.includes(d.landingProgress));
    }
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
  }, [baseList, landingProgressFilters, sceneCategoryFilter, showLandingProgressFilter, teamFilter, sortBy]);

  // Summary
  const summary = useMemo(() => {
    return summarizeValueMetrics(filteredData);
  }, [filteredData]);

  const autoColumnWidths = useMemo<Record<ColumnWidthKey, number>>(() => {
    const values = (key: ColumnWidthKey) => filteredData.map((row) => {
      switch (key) {
        case 'seq': return String(row.seq ?? '');
        case 'title': return row.title;
        case 'valueStarLevel': return row.valueStarLevel ? '★★★★★' : '';
        case 'finalValueScore': return row.finalValueScore == null ? '' : fmtF(Math.round(row.finalValueScore));
        case 'landingProgress': return row.landingProgress;
        case 'progressRecord': return row.progressRecord;
        case 'plannedStartDate': return fmtDate(row.plannedStartDate);
        case 'team': return row.team;
        case 'bizOwner': return personContactPlainText(row.bizOwnerProfiles, row.bizOwner);
        case 'aiOwner': return personContactPlainText(row.aiOwnerProfiles, row.aiOwner);
        case 'monthlySavedHours': return row.monthlySavedHours == null ? '' : numOrDash(row.monthlySavedHours, 'h');
        case 'monthlySavedCost': return fmtCost(row.monthlySavedCost);
        case 'totalSavedHours': return row.totalSavedHours == null ? '' : numOrDash(row.totalSavedHours, 'h');
        case 'reuseValue': return row.reuseValue;
        case 'regionCoefficient': return row.regionCoefficient;
      }
    });

    return {
      seq: 50,
      title: estimateColumnWidth(FIELD_LABELS.title, values('title'), COLUMN_WIDTH_RULES.title),
      valueStarLevel: estimateColumnWidth('价值星级', values('valueStarLevel'), COLUMN_WIDTH_RULES.valueStarLevel),
      finalValueScore: estimateColumnWidth('最终价值计分', values('finalValueScore'), COLUMN_WIDTH_RULES.finalValueScore),
      landingProgress: estimateColumnWidth(FIELD_LABELS.landingProgress, values('landingProgress'), COLUMN_WIDTH_RULES.landingProgress),
      progressRecord: estimateColumnWidth(FIELD_LABELS.progressRecord, values('progressRecord'), COLUMN_WIDTH_RULES.progressRecord),
      plannedStartDate: estimateColumnWidth(FIELD_LABELS.plannedStartDate, values('plannedStartDate'), COLUMN_WIDTH_RULES.plannedStartDate),
      team: estimateColumnWidth(FIELD_LABELS.team, values('team'), COLUMN_WIDTH_RULES.team),
      bizOwner: estimateColumnWidth(FIELD_LABELS.bizOwner, values('bizOwner'), COLUMN_WIDTH_RULES.bizOwner),
      aiOwner: estimateColumnWidth(FIELD_LABELS.aiOwner, values('aiOwner'), COLUMN_WIDTH_RULES.aiOwner),
      monthlySavedHours: estimateColumnWidth(FIELD_LABELS.monthlySavedHours, values('monthlySavedHours'), COLUMN_WIDTH_RULES.monthlySavedHours),
      monthlySavedCost: estimateColumnWidth(FIELD_LABELS.monthlySavedCost, values('monthlySavedCost'), COLUMN_WIDTH_RULES.monthlySavedCost),
      totalSavedHours: estimateColumnWidth(FIELD_LABELS.totalSavedHours, values('totalSavedHours'), COLUMN_WIDTH_RULES.totalSavedHours),
      reuseValue: estimateColumnWidth('复用价值系数', values('reuseValue'), COLUMN_WIDTH_RULES.reuseValue),
      regionCoefficient: estimateColumnWidth('地区系数', values('regionCoefficient'), COLUMN_WIDTH_RULES.regionCoefficient),
    };
  }, [filteredData]);

  const columnWidth = (key: ColumnWidthKey) => {
    const rule = COLUMN_WIDTH_RULES[key];
    const width = manualColumnWidths[key] ?? autoColumnWidths[key];
    return Math.max(rule.min, Math.min(rule.manualMax, Math.ceil(width)));
  };
  const tableScrollX = [
    'seq',
    'title',
    'valueStarLevel',
    'finalValueScore',
    'landingProgress',
    ...(showLandingPlanColumns ? ['progressRecord', 'plannedStartDate', 'team', 'bizOwner', 'aiOwner'] : []),
    'monthlySavedHours',
    'monthlySavedCost',
    'totalSavedHours',
    'reuseValue',
    'regionCoefficient',
  ].reduce((total, key) => total + columnWidth(key as ColumnWidthKey), 0);
  const startColumnResize = (key: ColumnWidthKey) => (event: React.MouseEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = columnWidth(key);
    const rule = COLUMN_WIDTH_RULES[key];
    const onMove = (moveEvent: MouseEvent) => {
      const nextWidth = Math.max(rule.min, Math.min(rule.manualMax, startWidth + moveEvent.clientX - startX));
      setManualColumnWidths((prev) => ({ ...prev, [key]: nextWidth }));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const headerTitle = (key: ColumnWidthKey, label: React.ReactNode, plainLabel: string = String(label)) => (
    <span className="cho-resizable-title">
      <span className="cho-resizable-title-text">{label}</span>
      {key !== 'seq' && (
        <span
          role="separator"
          aria-label={`调整${plainLabel}列宽`}
          className="cho-col-resize-handle"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={startColumnResize(key)}
        />
      )}
    </span>
  );

  const toggleExpandedCell = (rowId: string, key: ColumnWidthKey) => {
    const cellKey = `${rowId}:${key}`;
    setExpandedCells((prev) => {
      const next = new Set(prev);
      if (next.has(cellKey)) next.delete(cellKey);
      else next.add(cellKey);
      return next;
    });
  };

  const expandableTextCell = (record: WishItem, key: ColumnWidthKey, value: string | null | undefined, align: 'left' | 'center' = 'left', className = '') => {
    if (!value) return <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>;
    const isExpanded = expandedCells.has(`${record.id}:${key}`);
    return (
      <button
        type="button"
        title={isExpanded ? '点击收起' : '点击展开'}
        className={`cho-expand-cell ${className} ${isExpanded ? 'is-expanded' : ''}`}
        style={{ textAlign: align }}
        onClick={(e) => {
          e.stopPropagation();
          toggleExpandedCell(record.id, key);
        }}
      >
        {value}
      </button>
    );
  };

  const dateCell = (v: string | null | undefined) => (
    <span className="text-xs" style={{ color: v ? 'var(--foreground)' : 'var(--text-muted)' }}>{fmtDate(v) || '—'}</span>
  );
  const ownerCell = (profiles: PersonProfile[] | undefined, names: string[] | undefined) => {
    const displayProfiles = getDisplayProfiles(profiles, names);
    if (displayProfiles.length === 0) return <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>;
    return <PersonContactNames profiles={displayProfiles} compact showAvatar limit={3} />;
  };

  const landingPlanColumns: TableColumnsType<typeof filteredData[number]> = showLandingPlanColumns ? [
    {
      title: headerTitle('progressRecord', <FmtHeader label={FIELD_LABELS.progressRecord} tip={fieldDescriptions.progressRecord || FIELD_LABELS.progressRecord} />, FIELD_LABELS.progressRecord),
      dataIndex: 'progressRecord',
      key: 'progressRecord',
      width: columnWidth('progressRecord'),
      className: 'cho-col-progress-record',
      render: (v: string | null, record) => expandableTextCell(record, 'progressRecord', v, 'left', 'cho-progress-record-cell'),
    },
    {
      title: headerTitle('plannedStartDate', <FmtHeader label={FIELD_LABELS.plannedStartDate} tip={fieldDescriptions.plannedStartDate || FIELD_LABELS.plannedStartDate} />, FIELD_LABELS.plannedStartDate),
      dataIndex: 'plannedStartDate',
      key: 'plannedStartDate',
      width: columnWidth('plannedStartDate'),
      align: 'center' as const,
      render: (v: string | null) => dateCell(v),
    },
    {
      title: headerTitle('team', FIELD_LABELS.team),
      dataIndex: 'team',
      key: 'teamPlan',
      width: columnWidth('team'),
      align: 'center' as const,
      render: (v: string | null, record) => expandableTextCell(record, 'team', v, 'center'),
    },
    {
      title: headerTitle('bizOwner', FIELD_LABELS.bizOwner),
      dataIndex: 'bizOwner',
      key: 'bizOwner',
      width: columnWidth('bizOwner'),
      align: 'center' as const,
      render: (v: string[] | undefined, record) => ownerCell(record.bizOwnerProfiles, v),
    },
    {
      title: headerTitle('aiOwner', FIELD_LABELS.aiOwner),
      dataIndex: 'aiOwner',
      key: 'aiOwner',
      width: columnWidth('aiOwner'),
      align: 'center' as const,
      render: (v: string[] | undefined, record) => ownerCell(record.aiOwnerProfiles, v),
    },
  ] : [];

  // Table columns（3视图共用，列顺序：序号→名称→价值星级→最终价值计分→落地进展→[日期列]→改造成效→复用价值）
  const columns: TableColumnsType<typeof filteredData[number]> = [
    {
      title: '序号', dataIndex: 'seq', key: 'seq', width: columnWidth('seq'), align: 'center', fixed: 'left', className: 'cho-frozen-rank',
      render: (seq: number) => <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{seq}</span>,
    },
    {
      title: headerTitle('title', FIELD_LABELS.title),
      dataIndex: 'title',
      key: 'title',
      width: columnWidth('title'),
      ellipsis: true,
      render: (title: string, record) => (
        <div>
          <button onClick={() => onSelectItem(record)} className="text-xs font-medium truncate text-left hover:underline w-full" style={{ color: '#1a3a8a' }}
            onMouseEnter={() => onRowEnter(record)} onMouseLeave={onRowLeave}>
            {title || '—'}
          </button>
        </div>
      ),
    },
    {
      title: headerTitle('valueStarLevel', <FmtHeader label="价值星级" tip="按最终价值计分排名百分位：前20%=5★，前40%=4★，前60%=3★，前80%=2★，后20%=1★" />, '价值星级'),
      dataIndex: 'valueStarLevel', key: 'valueStarLevel', width: columnWidth('valueStarLevel'), align: 'center',
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
      title: headerTitle('finalValueScore', <FmtHeader label="最终价值计分" tip={fieldDescriptions.finalValueScore || '最终价值计分'} />, '最终价值计分'),
      dataIndex: 'finalValueScore', key: 'fvs', width: columnWidth('finalValueScore'), align: 'center',
      render: (v: number | null) => <span className="font-mono text-xs font-bold" style={{ color: v != null && v > 0 ? '#F27F22' : 'var(--text-muted)' }}>{v != null && v > 0 ? fmtF(Math.round(v)) : '—'}</span>,
    },
    {
      title: headerTitle('landingProgress', FIELD_LABELS.landingProgress), dataIndex: 'landingProgress', key: 'landingProgress', width: columnWidth('landingProgress'), align: 'center',
      render: (v: string | null) => {
        if (!v) return <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>;
        return <Tag color={progressColors[v] || FALLBACK_COLOR} className="text-[11px]" style={{ margin: 0 }}>{v}</Tag>;
      },
    },
    ...landingPlanColumns,
    {
      title: <FmtHeader label="改造成效" tip="量化改造效果" />,
      key: 'result-group', className: 'cho-group-result',
      children: [
        { title: headerTitle('monthlySavedHours', <FmtHeader label={FIELD_LABELS.monthlySavedHours} tip={fieldDescriptions.monthlySavedHours || FIELD_LABELS.monthlySavedHours} />, FIELD_LABELS.monthlySavedHours), dataIndex: 'monthlySavedHours', key: 'sh', width: columnWidth('monthlySavedHours'), align: 'center', className: 'cho-col-result',
          render: (v: number | null) => <span className="font-mono text-xs font-bold" style={{ color: v != null && v > 0 ? '#16a34a' : 'var(--text-muted)' }}>{numOrDash(v, 'h')}</span> },
        { title: headerTitle('monthlySavedCost', <FmtHeader label={FIELD_LABELS.monthlySavedCost} tip={fieldDescriptions.monthlySavedCost || '月均降本费用（不含人力成本）'} />, FIELD_LABELS.monthlySavedCost), dataIndex: 'monthlySavedCost', key: 'mc', width: columnWidth('monthlySavedCost'), align: 'center', className: 'cho-col-result',
          render: (v: number | string | null) => <span className="font-mono text-xs" style={{ color: (parseMetricNumber(v) ?? 0) > 0 ? '#d97706' : 'var(--text-muted)' }}>{fmtCost(v)}</span> },
        { title: headerTitle('totalSavedHours', <FmtHeader label={FIELD_LABELS.totalSavedHours} tip={fieldDescriptions.totalSavedHours || VALUE_FORMULA_COPY.totalSavedHours} />, FIELD_LABELS.totalSavedHours), dataIndex: 'totalSavedHours', key: 'tsh', width: columnWidth('totalSavedHours'), align: 'center', className: 'cho-col-result',
          render: (v: number | null) => <span className="font-mono text-xs font-bold" style={{ color: v != null && v > 0 ? '#16a34a' : 'var(--text-muted)' }}>{numOrDash(v, 'h')}</span> },
      ],
    },
    {
      title: <FmtHeader label="复用价值" tip="方案可复用范围和地区系数" />,
      key: 'reuse-group', className: 'cho-group-reuse',
      children: [
        { title: headerTitle('reuseValue', <FmtHeader label="复用价值系数" tip="跨团队/BU 复用范围" />, '复用价值系数'), dataIndex: 'reuseValue', key: 'rm', width: columnWidth('reuseValue'), align: 'center', className: 'cho-col-reuse',
          render: (v: string | null, record) => {
            if (!v) return <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>;
            const ls = reuseLevelStyle(v);
            const isExpanded = expandedCells.has(`${record.id}:reuseValue`);
            return (
              <button
                type="button"
                title={isExpanded ? '点击收起' : '点击展开'}
                className={`cho-expand-cell cho-reuse-cell ${isExpanded ? 'is-expanded' : ''}`}
                style={{ background: ls.bg, color: ls.fg, border: `1px solid ${ls.border}`, textAlign: 'center' }}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpandedCell(record.id, 'reuseValue');
                }}
              >
                {v}
              </button>
            );
          },
        },
        { title: headerTitle('regionCoefficient', <FmtHeader label="地区系数" tip="场景归属地区系数" />, '地区系数'), dataIndex: 'regionCoefficient', key: 'rc', width: columnWidth('regionCoefficient'), align: 'center', className: 'cho-col-reuse',
          render: (v: string | null, record) => expandableTextCell(record, 'regionCoefficient', v, 'center') },
      ],
    },
  ];

  return (
    <div className="space-y-2" data-export-stack="compact">
      <style jsx global>{`
        .cho-resizable-title {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          min-width: 0;
          width: 100%;
          position: static;
          padding-right: 8px;
        }
        .cho-resizable-title-text {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .cho-col-resize-handle {
          position: absolute;
          right: 0;
          top: 0;
          bottom: 0;
          width: 14px;
          cursor: col-resize;
          z-index: 8;
        }
        .cho-col-resize-handle::after {
          content: "";
          position: absolute;
          top: 20%;
          bottom: 20%;
          left: 4px;
          width: 1px;
          background: rgba(26,58,138,0);
          transition: background 0.15s ease;
        }
        .cho-col-resize-handle:hover::after {
          background: rgba(26,58,138,0.45);
        }
        .cho-expand-cell {
          display: block;
          width: 100%;
          max-width: 100%;
          padding: 0;
          border: 0;
          background: transparent;
          color: var(--foreground);
          font: inherit;
          cursor: pointer;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.45;
        }
        .cho-progress-record-cell {
          line-height: 1.5;
        }
        .cho-expand-cell.is-expanded {
          white-space: normal;
          overflow: visible;
          text-overflow: clip;
          word-break: break-word;
        }
        .cho-reuse-cell {
          display: inline-block;
          border-radius: 6px;
          padding: 1px 8px;
          font-size: 11px;
          font-weight: 600;
        }
        .cho-table-wrap .ant-table-tbody > tr > td {
          vertical-align: middle !important;
        }
        .cho-table-wrap .ant-table-tbody > tr > td.cho-col-progress-record {
          vertical-align: top !important;
        }
        .cho-table-wrap .ant-table-thead > tr > th {
          position: relative;
          vertical-align: middle !important;
          text-align: center;
        }
        .cho-table-wrap .ant-table-thead .ant-table-cell-content {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 34px;
        }
        .cho-summary-headline {
          display: flex;
          align-items: baseline;
          flex-wrap: wrap;
          gap: 4px 12px;
          padding: 2px 4px 6px;
        }
        .cho-summary-headline-main {
          color: #142033;
          font-size: 15px;
          font-weight: 700;
          line-height: 1.35;
        }
        .cho-summary-headline-count {
          display: inline-block;
          margin: 0 3px;
          font-family: var(--font-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 24px;
          line-height: 1;
          vertical-align: -1px;
        }
        .cho-summary-headline-meta {
          color: #3f4e66;
          font-size: 11px;
          font-weight: 600;
          line-height: 1.4;
        }
      `}</style>
      {showSummary && emphasizeSummary && (
        <DetailSummaryHeadline
          count={summary.count}
          label={label}
          totalSavedEfficiency={summary.totalSavedEfficiency}
          totalMonthlySavedCostDisplay={summary.totalMonthlySavedCostDisplay}
          showMetrics={showMetrics}
          showEstimatedValueLabel={showEstimatedValueLabel}
          labelColor={labelColor}
          summaryMode={summaryMode}
        />
      )}
      <DetailListFilterPanel
        sortBy={sortBy}
        onSortChange={setSortBy}
        categoryOptions={categoryOptions}
        sceneCategoryFilter={sceneCategoryFilter}
        onSceneCategoryChange={setSceneCategoryFilter}
        teamOptions={teamOptions}
        teamFilter={teamFilter}
        onTeamChange={setTeamFilter}
        showLandingProgressFilter={showLandingProgressFilter}
        landingProgressOptions={landingProgressOptions}
        landingProgressFilters={landingProgressFilters}
        onLandingProgressChange={setLandingProgressFilters}
      />

      {/* 小summary */}
      {showSummary && !emphasizeSummary && (showMetrics ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs px-2" data-export-card style={{ color: 'var(--text-muted)' }}>
          <span>共 <strong style={{ color: labelColor }}>{summary.count}</strong> 个{label}</span>
          <span>{FIELD_LABELS.monthlySavedHours} <strong style={{ color: labelColor }}>{summary.totalSavedEfficiency > 0 ? `${summary.totalSavedEfficiency}h` : '—'}</strong></span>
          <span>{FIELD_LABELS.monthlySavedCost} <strong style={{ color: '#4a7de0' }}>{summary.totalMonthlySavedCostDisplay}</strong>{COST_SCOPE_NOTE}</span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs px-2" data-export-card style={{ color: 'var(--text-muted)' }}>
          <span>共 <strong style={{ color: labelColor }}>{summary.count}</strong> 个{label}</span>
        </div>
      ))}

      {/* 表格 */}
      {filteredData.length === 0 ? (
        <div className="text-center py-16 glass rounded-2xl" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{emptyText}</p>
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden cho-table-wrap" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
          <Table dataSource={filteredData} columns={columns} rowKey="id" pagination={false} size="small" tableLayout="fixed" scroll={{ x: tableScrollX }} rowClassName={() => 'cho-table-row'} />
        </div>
      )}
    </div>
  );
}
