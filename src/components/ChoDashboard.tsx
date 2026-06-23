'use client';

import { fieldOptionsToFilterItems, type FilterItem } from '@/lib/bitable/filter-options';
import { reuseLevelStyle } from '@/lib/bitable/enums';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { Spin, App, Table, Modal, Tag, Tooltip, type TableColumnsType } from 'antd';
import CompetitionPeriodTimeline, { type CompetitionPeriodStats } from '@/components/CompetitionPeriodTimeline';
import {
  BarChartOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  RiseOutlined,
  ThunderboltOutlined,
  SyncOutlined,
  SwapRightOutlined,
  QuestionCircleOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/lib/auth-context';
import { FIELD_LABELS, VALUE_FORMULA_COPY } from '@/lib/bitable/labels';
import { parseMetricNumber, summarizeValueMetrics } from '@/lib/bitable/metrics';
import { applyExportImageCloneLayout, getExportImageCaptureWidth } from '@/lib/export-image-style';
import { canSyncCompetitionPeriod, isAllCompetitionPeriod } from '@/lib/competition-periods';

// ─── Types ───────────────────────────────────────────────────────

interface ChoSubmission {
  id: string;
  title: string;
  team: string;
  authorName: string;
  contributors: string[];
  proposalNo: number | null;
  monthlySavedHours: number | null;
  efficiencyRate: number | null;
  beforeHoursPerPerson: number | null;
  beforePeopleCount: number | null;
  afterHoursPerPerson: number | null;
  afterPeopleCount: number | null;
  oldFrequency: string | null;
  newFrequency: string | null;
  oldOperationCount: number | null;
  newOperationCount: number | null;
  oldHoursPerTask: number | null;
  newDuration: number | null;
  sceneCategory: string;
  aiTools: string[];
  beforeProcess: string;
  afterProcess: string;
  extraValue: string;
  reuseValue: string | null;
  reuseValueLevel: string | null;
  monthlySavedCost: string | null;
  costReductionNote: string | null;
  aiCost: string | null;
  briefIntro: string | null;
  beforeFreq: number | null;
  afterFreq: number | null;
  beforeMonthlyHours: number | null;
  afterMonthlyHours: number | null;
  finalValueScore: number | null;
  sceneRegionCoefficientValue: number | null;
  monthlyCostSavingHours: number | null;
  totalMonthlySavedHours: number | null;
  reuseValueCoefficient: number | null;
  regionCoefficient: string | null;
  sceneSource: string | null;
  landingProgress: string | null;
  status: string | null;
  competitionStatus: string | null;
}

interface OverviewResponse {
  period: string;
  summary: {
    total: number;
    reviewed: number;
    pending: number;
    avgScore: number | null;
    totalSavedHours: number;
    avgEfficiencyRate: number | null;
    reuseValueCounts: Record<string, number>;
    reuseValueDistribution: Record<string, number>;
  };
  submissions: ChoSubmission[];
  panel: Record<string, string[]>;
  fieldDescriptions?: Record<string, string>;
  fieldOptions?: Record<string, { id: string; name: string }[]>;
}

interface ProgressTimelineResponse {
  periods?: string[];
  currentPeriod?: string;
  allItems?: unknown[];
  globalSummary?: {
    count?: number;
  };
  stats?: {
    periodMap?: Record<string, CompetitionPeriodStats>;
  };
}

// ─── Constants ───────────────────────────────────────────────────

const SORT_OPTIONS = [
  { value: 'finalValueScore', label: '最终价值计分' },
  { value: 'savedHours', label: '月均提效节省工时' },
  { value: 'totalMonthlySavedHours', label: '月均节省总工时' },
  { value: 'efficiencyRate', label: '总降本提效比例' },
  { value: 'beforeHours', label: '原月均耗时' },
  { value: 'afterHours', label: '新月均耗时' },
  { value: 'monthlySavedCost', label: '月均降本费用' },
  { value: 'aiCost', label: '月均Token费用' },
  { value: 'reuseValueCoefficient', label: '复用价值系数' },
];

// ─── Helpers ─────────────────────────────────────────────────────

/** 频率文本 + 执行次数 → 每月次数 */
function calcMonthlyFreq(freq: string | null, count: number | null): number | null {
  if (count != null && count > 0) {
    if (!freq) return count;
    if (freq.includes('每日') || freq.includes('daily')) return Math.round(count * 22 * 10) / 10;
    if (freq.includes('每周') || freq.includes('weekly')) return Math.round(count * 4 * 10) / 10;
    if (freq.includes('每月') || freq.includes('monthly')) return count;
    if (freq.includes('每季') || freq.includes('quarterly')) return Math.round(count / 3 * 10) / 10;
    if (freq.includes('每年') || freq.includes('yearly')) return Math.round(count / 12 * 10) / 10;
    return count;
  }
  if (freq) {
    const match = freq.match(/(\d+(?:\.\d+)?)/);
    if (match) return parseFloat(match[1]);
  }
  return null;
}

function fmtFreq(monthly: number | null | undefined): string {
  if (monthly == null) return '—';
  const n = monthly % 1 === 0 ? String(monthly) : Math.round(monthly * 10) / 10 + '';
  return `${n}次/月`;
}

/** 操作频率 + 操作次数 → 拼合显示（如 "3次/周"） */
function fmtFreqRaw(freq: string | null, count: number | null): string {
  if (count == null && !freq) return '—';
  const unitMap: Record<string, string> = { '每日': '日', '每天': '日', '每周': '周', '每月': '月', '每季': '季', '每年': '年' };
  const unit = freq ? (unitMap[freq] ?? freq) : '次';
  return count != null ? `${count}次/${unit}` : '—';
}

/** 飞书存储为小数 0~1，显示为百分比，四舍五入取整 */
function fmtPct(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${Math.round(v * 100)}%`;
}

/** 月总工时 = 频次(次/月) × 单次耗时(h) × 人数 */
function calcMonthlyHours(
  freq: number | null,
  duration: number | null,
  people: number | null,
): number | null {
  if (freq == null || duration == null || people == null) return null;
  const result = freq * duration * people;
  return Math.round(result * 10) / 10;
}

/** 从复用价值文本提取乘数 (如 "跨多个BU x3" → 3) */
function extractMultiplier(text: string | null): number | null {
  if (!text) return null;
  const match = text.match(/[×xX]\s*(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * 变化方向：null=无变化, 'up'=上升, 'down'=下降
 */
function changeDir(
  oldVal: number | null | undefined,
  newVal: number | null | undefined,
): 'up' | 'down' | null {
  if (oldVal == null || newVal == null || oldVal === 0) return null;
  if (Math.abs(newVal - oldVal) / Math.abs(oldVal) < 0.001) return null;
  return newVal > oldVal ? 'up' : 'down';
}

/** 带 ⓘ tooltip 的表头 */
function FmtHeader({ label, tip }: { label: string; tip: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <Tooltip title={tip} placement="top">
        <QuestionCircleOutlined style={{ fontSize: 10, color: '#9ca3af', cursor: 'help' }} />
      </Tooltip>
    </span>
  );
}

// ─── Component ───────────────────────────────────────────────────

export default function ChoDashboard() {
  const { message } = App.useApp();
  const { hasPermission } = useAuth();
  const canSyncCompetition = hasPermission('competition.sync');
  const canExportImage = hasPermission('dashboard.export-image');
  const canView = canSyncCompetition || canExportImage;
  const [period, setPeriod] = useState('2605');
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [fieldOptions, setFieldOptions] = useState<Record<string, { id: string; name: string }[]>>({});
  const [activePeriods, setActivePeriods] = useState<string[]>([]);
  const [periodMap, setPeriodMap] = useState<Record<string, CompetitionPeriodStats>>({});
  const [timelineAllCount, setTimelineAllCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [sceneCategoryFilter, setSceneCategoryFilter] = useState<string>('all');
  const [coreValueFilter, setCoreValueFilter] = useState<string>('all');
  const [sceneSourceFilter, setSceneSourceFilter] = useState<string>('AI大赛');
  const [landingProgressFilter, setLandingProgressFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [filterExpanded, setFilterExpanded] = useState(false);
  const [sortBy, setSortBy] = useState('finalValueScore');
  const [titleWidth, setTitleWidth] = useState(260);
  const [detailRecord, setDetailRecord] = useState<typeof enriched[number] | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/competitions/overview?period=${period}`);
      if (!res.ok) throw new Error((await res.json()).error || '加载失败');
      const json = await res.json();
      setData(json);
      setFieldOptions(json.fieldOptions ?? {});
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [period, message]);

  const fetchTimeline = useCallback(async () => {
    try {
      const res = await fetch('/api/competitions/progress');
      if (!res.ok) throw new Error('获取周期失败');
      const json = (await res.json()) as ProgressTimelineResponse;
      setActivePeriods(json.periods ?? []);
      setPeriodMap(json.stats?.periodMap ?? {});
      setTimelineAllCount(json.globalSummary?.count ?? json.allItems?.length ?? 0);
    } catch {
      message.error('获取成效周期失败');
    }
  }, [message]);

  useEffect(() => {
    if (!canView) return undefined;
    const timer = window.setTimeout(() => { void fetchData(); }, 0);
    return () => window.clearTimeout(timer);
  }, [canView, fetchData]);

  useEffect(() => {
    if (!canView) return undefined;
    const timer = window.setTimeout(() => { void fetchTimeline(); }, 0);
    return () => window.clearTimeout(timer);
  }, [canView, fetchTimeline]);

  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const handleExportImage = async () => {
    if (!canExportImage) {
      message.error('无导出权限');
      return;
    }
    setExporting(true);
    try {
      const html2canvas = (await import('html2canvas-pro')).default;
      // 只导出"指标卡片 + 核心公式 + 参赛项目数据明细"，不包含筛选/排序/操作栏
      const element = document.getElementById('cho-dashboard-export');
      if (!element) return;
      await new Promise((r) => setTimeout(r, 100));
      // 取真实表格所需宽度：scrollWidth 取所有列自然撑开的最大宽度
      const realTable = element.querySelector('.ant-table table') as HTMLElement | null;
      const realTableContent = element.querySelector('.ant-table-content') as HTMLElement | null;
      const tableNeededWidth = Math.max(
        realTable?.scrollWidth ?? 0,
        realTableContent?.scrollWidth ?? 0,
        element.scrollWidth,
      );
      const captureWidth = getExportImageCaptureWidth(tableNeededWidth);
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#f8fafc',
        logging: false,
        windowWidth: captureWidth,
        windowHeight: element.scrollHeight + 400,
        onclone: (clonedDoc) => {
          const clonedEl = clonedDoc.getElementById('cho-dashboard-export');
          if (!clonedEl) return;
          // 1. 用真实表格所需宽度撑开 export 容器，并加入导出专用留白
          applyExportImageCloneLayout(clonedEl, { width: tableNeededWidth });
          // 2. 取消 antd Table 的横向滚动限制（content/body/wrap 三层都要打开）
          clonedEl.querySelectorAll('.ant-table-content, .ant-table-body, .ant-table-body-inner, .ant-table').forEach((c) => {
            const el = c as HTMLElement;
            el.style.overflow = 'visible';
            el.style.overflowX = 'visible';
            el.style.overflowY = 'visible';
          });
          clonedEl.querySelectorAll('.cho-table-wrap').forEach((c) => {
            const el = c as HTMLElement;
            el.style.overflow = 'visible';
          });
          // 3. .glass 的 backdrop-filter 已在导出布局工具中替换为可渲染样式
          // 4. 去掉列拖拽手柄（html2canvas 把它截成黑条）
          clonedEl.querySelectorAll('.react-resizable-handle').forEach((h) => {
            (h as HTMLElement).style.display = 'none';
          });
          // 5. 取消 sticky/freeze 列（html2canvas 渲染冻结列经常出现错位/黑底）
          clonedEl.querySelectorAll('.cho-frozen-rank').forEach((c) => {
            const el = c as HTMLElement;
            el.style.position = 'static';
            el.style.left = 'auto';
            el.style.zIndex = 'auto';
          });
          // 6. 关闭 antd Table 的 fixed 列容器阴影/伪元素
          clonedEl.querySelectorAll('.ant-table-cell-fix-left, .ant-table-cell-fix-right').forEach((c) => {
            const el = c as HTMLElement;
            el.style.boxShadow = 'none';
          });
        },
      });
      const link = document.createElement('a');
      link.download = `成效看板_${isAllCompetitionPeriod(period) ? '全部周期' : period}_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      message.error('导出失败');
      console.error(err);
    } finally {
      setExporting(false);
    }
  };
  const handleSync = async () => {
    if (!canSyncCompetition) {
      message.error('无同步权限');
      return;
    }
    if (!canSyncCompetitionPeriod(period)) {
      message.info('请选择具体评审周期后再同步');
      return;
    }
    setSyncing(true);
    message.loading({ content: '正在从飞书同步…', key: 'sync', duration: 0 });
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5 * 60 * 1000);
      const res = await fetch(`/api/competitions/sync?period=${period}`, { method: 'POST', signal: controller.signal });
      clearTimeout(timer);
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      message.success({ content: `已同步 ${result.synced} 条方案`, key: 'sync' });
      await Promise.all([fetchData(), fetchTimeline()]);
    } catch (err) {
      const msg = err instanceof DOMException && err.name === 'AbortError' ? '同步超时' : err instanceof Error ? err.message : '同步失败';
      message.error({ content: msg, key: 'sync' });
    } finally {
      setSyncing(false);
    }
  };

  // ── Enriched data: 尽量全用飞书公式字段 ──
  // 口径说明（2026-06 优化）：
  //   - beforeHours            ：飞书 beforeMonthlyHours（原月均耗时）优先
  //   - afterHours             ：飞书 afterMonthlyHours（新月均耗时）优先，缺失才客户端算
  //   - savedHours             ：统一用飞书 monthlySavedHours（月均提效节省工时）；仅当飞书字段缺失时回退客户端算
  const enriched = useMemo(() => {
    return (data?.submissions ?? []).map((s, idx) => {
      const beforeFreq = s.beforeFreq ?? calcMonthlyFreq(s.oldFrequency, s.oldOperationCount);
      const afterFreq = s.afterFreq ?? calcMonthlyFreq(s.newFrequency, s.newOperationCount);
      const beforeHours = s.beforeMonthlyHours ?? calcMonthlyHours(beforeFreq, s.oldHoursPerTask, s.beforePeopleCount);
      const afterHours = s.afterMonthlyHours ?? calcMonthlyHours(afterFreq, s.newDuration, s.afterPeopleCount);
      // savedHours: 统一用飞书 monthlySavedHours；飞书缺失时才客户端兜底（避免显示「—」）
      const savedHours = s.monthlySavedHours ?? (
        beforeHours != null && afterHours != null
          ? Math.round((beforeHours - afterHours) * 10) / 10
          : null
      );
      // 复用系数：优先用飞书数值字段 reuseValueCoefficient，回退文本提取
      const reuseMultiplier = s.reuseValueCoefficient ?? extractMultiplier(s.reuseValue);
      const reuseSavedHours = reuseMultiplier != null && savedHours != null
        ? Math.round(reuseMultiplier * savedHours * 10) / 10
        : null;
      // 直接引用飞书公式字段，不客户端重算
      const monthlyCostSavingHours = s.monthlyCostSavingHours ?? null;
      const totalMonthlySavedHours = s.totalMonthlySavedHours ?? null;
      return { ...s, beforeFreq, afterFreq, beforeHours, afterHours, savedHours, reuseMultiplier, reuseSavedHours, monthlyCostSavingHours, totalMonthlySavedHours, fixedSeq: idx + 1 };
    });
  }, [data]);

  // ── Filtered & sorted ──
  const tableData = useMemo(() => {
    let list = enriched;
    if (teamFilter !== 'all') list = list.filter((s) => s.team === teamFilter);
    if (sceneCategoryFilter !== 'all') list = list.filter((s) => s.sceneCategory === sceneCategoryFilter);
    if (coreValueFilter !== 'all') list = list.filter((s) => s.extraValue === coreValueFilter);
    if (sceneSourceFilter !== 'all') list = list.filter((s) => s.sceneSource === sceneSourceFilter);
    if (landingProgressFilter !== 'all') list = list.filter((s) => s.landingProgress === landingProgressFilter);
    if (statusFilter !== 'all') list = list.filter((s) => s.competitionStatus === statusFilter);
    const sorted = [...list].sort((a, b) => {
      switch (sortBy) {
        case 'finalValueScore': return (b.finalValueScore ?? -1) - (a.finalValueScore ?? -1);
        case 'savedHours': return (b.savedHours ?? -1) - (a.savedHours ?? -1);
        case 'totalMonthlySavedHours': return (b.totalMonthlySavedHours ?? -1) - (a.totalMonthlySavedHours ?? -1);
        case 'efficiencyRate': return (b.efficiencyRate ?? -1) - (a.efficiencyRate ?? -1);
        case 'beforeHours': return (b.beforeHours ?? -1) - (a.beforeHours ?? -1);
        case 'afterHours': return (b.afterHours ?? -1) - (a.afterHours ?? -1);
        case 'monthlySavedCost': return (parseMetricNumber(b.monthlySavedCost) ?? -1) - (parseMetricNumber(a.monthlySavedCost) ?? -1);
        case 'aiCost': return (parseMetricNumber(b.aiCost) ?? -1) - (parseMetricNumber(a.aiCost) ?? -1);
        case 'reuseValueCoefficient': return (b.reuseValueCoefficient ?? -1) - (a.reuseValueCoefficient ?? -1);
        default: return 0;
      }
    });
    return sorted.map((s, i) => ({ ...s, seq: i + 1 }));
  }, [enriched, teamFilter, sceneCategoryFilter, coreValueFilter, sceneSourceFilter, landingProgressFilter, statusFilter, sortBy]);

  // ── Summary（基于筛选后的数据）──
  const summary = useMemo(() => {
    return summarizeValueMetrics(tableData, {
      monthlySavedHoursKey: 'savedHours',
      totalSavedHoursKey: 'totalMonthlySavedHours',
    });
  }, [tableData]);

  type DashboardRow = (typeof tableData)[number];

  // ── Table columns ──
  const columns: TableColumnsType<typeof tableData[number]> = [
    // ── 基础 ──
    {
      title: '序号',
      dataIndex: 'seq',
      key: 'seq',
      width: 50,
      align: 'center',
      fixed: 'left',
      className: 'cho-frozen-rank',
     
      render: (seq: number) => (
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{seq}</span>
      ),
    },
    {
      title: '名称',
      dataIndex: 'title',
      key: 'title',
      width: titleWidth,
      ellipsis: true,
      onHeaderCell: () => ({
        style: { position: 'relative' },
        children: (
          <div className="flex items-center justify-between">
            <span>{FIELD_LABELS.title}</span>
            <div
              className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-300"
              style={{ zIndex: 10 }}
              onMouseDown={(e) => {
                e.preventDefault();
                const startX = e.clientX;
                const startWidth = titleWidth;
                const onMouseMove = (e: MouseEvent) => {
                  const diff = e.clientX - startX;
                  setTitleWidth(Math.max(120, startWidth + diff));
                };
                const onMouseUp = () => {
                  document.removeEventListener('mousemove', onMouseMove);
                  document.removeEventListener('mouseup', onMouseUp);
                };
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
              }}
            />
          </div>
        ),
      }),
      render: (title: string, record) => (
        <div>
          <button
            onClick={() => setDetailRecord(record)}
            className="text-xs font-medium truncate text-left hover:underline w-full"
            style={{ color: 'var(--primary)' }}
          >
            {title}
          </button>
          <div className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{record.team || '—'}</div>
        </div>
      ),
    },

    // ── 改造前后对比（前/后为行，指标为列，列宽自适应内容） ──
    {
      title: <FmtHeader label="改造前后对比" tip="月工时=频次×耗时×人数，每行显示改造前/后的全部指标" />,
      key: 'compare-group',
      className: 'cho-group-compare',
      width: 320,
      align: 'center' as const,
     
      render: (_: unknown, r: typeof tableData[number]) => {
        const cols = [
          { label: '频次', before: fmtFreqRaw(r.oldFrequency, r.oldOperationCount), after: fmtFreqRaw(r.newFrequency, r.newOperationCount), dir: changeDir(r.oldOperationCount, r.newOperationCount), flex: 4 },
          { label: '耗时', before: numOrDash(r.oldHoursPerTask, 'h', 1), after: numOrDash(r.newDuration, 'h', 1), dir: changeDir(r.oldHoursPerTask, r.newDuration), flex: 3 },
          { label: '人数', before: numOrDash(r.beforePeopleCount, '人'), after: numOrDash(r.afterPeopleCount, '人'), dir: changeDir(r.beforePeopleCount, r.afterPeopleCount), flex: 3 },
          { label: '月工时', before: numOrDash(r.beforeMonthlyHours, 'h'), after: numOrDash(r.afterMonthlyHours, 'h'), dir: changeDir(r.beforeMonthlyHours, r.afterMonthlyHours), flex: 3 },
        ];
        const arrowColor = (dir: 'up' | 'down' | null) => dir === 'down' ? '#16a34a' : '#dc2626';
        const valColor = (dir: 'up' | 'down' | null) => dir != null ? (dir === 'down' ? '#16a34a' : '#dc2626') : 'var(--foreground)';
        return (
          <div className="flex flex-col gap-[2px]">
            {/* 表头 */}
            <div className="flex items-center text-[9px] font-semibold" style={{ color: 'var(--text-muted)' }}>
              <span style={{ width: 28 }}></span>
              {cols.map((c) => <span key={c.label} style={{ flex: c.flex }} className="text-center">{c.label}</span>)}
            </div>
            {/* 前 */}
            <div className="flex items-center">
              <span className="text-[9px] font-semibold text-center cho-col-before rounded-sm" style={{ width: 28, color: '#b45309' }}>前</span>
              {cols.map((c) => <span key={c.label} style={{ flex: c.flex, color: '#9ca3af' }} className="text-center font-mono text-[11px] px-0.5 whitespace-nowrap">{c.before}</span>)}
            </div>
            {/* 后：无变化=默认色，有变化=彩色+箭头 */}
            <div className="flex items-center">
              <span className="text-[9px] font-semibold text-center cho-col-after rounded-sm" style={{ width: 28, color: '#047857' }}>后</span>
              {cols.map((c) => (
                <span key={c.label} style={{ flex: c.flex, color: valColor(c.dir) }} className="text-center font-mono text-[11px] font-medium px-0.5 whitespace-nowrap">
                  {c.after}{c.dir && <span className="text-[9px] ml-0.5" style={{ color: arrowColor(c.dir) }}>{c.dir === 'down' ? '↓' : '↑'}</span>}
                </span>
              ))}
            </div>
          </div>
        );
      },
    },

    // ── 改造成效 ──
    {
      title: <FmtHeader label="改造成效" tip="量化改造效果" />,
      key: 'result-group',
      className: 'cho-group-result',
      children: [
        {
          title: <FmtHeader label={FIELD_LABELS.monthlySavedHours} tip={VALUE_FORMULA_COPY.monthlySavedHours} />,
          dataIndex: 'savedHours', key: 'sh', width: 110, align: 'center' as const, className: 'cho-col-result',
          render: (v: number | null, record: DashboardRow) => {
            const dir = changeDir(record.beforeMonthlyHours, record.afterMonthlyHours);
            return (
              <span className="inline-flex items-center gap-1">
                <span className="font-mono text-xs font-bold" style={{ color: v != null && v > 0 ? '#16a34a' : 'var(--text-muted)' }}>{numOrDash(v, 'h')}</span>
                {dir && <span className="text-[9px]" style={{ color: dir === 'down' ? '#16a34a' : '#dc2626' }}>{dir === 'down' ? '↓' : '↑'}</span>}
              </span>
            );
          },
        },
        {
          title: <FmtHeader label={FIELD_LABELS.efficiencyRate} tip="总降本提效比例（飞书公式字段）" />,
          dataIndex: 'efficiencyRate', key: 'eff', width: 100, align: 'center' as const, className: 'cho-col-result',
          render: (v: number | null) => <span className="font-mono text-xs font-medium" style={{ color: v != null && v > 0 ? '#16a34a' : 'var(--text-muted)' }}>{fmtPct(v)}</span>,
        },
        {
          title: <FmtHeader label={FIELD_LABELS.costSavedHours} tip="= 月均降本费用 / (50 × 地区系数)" />,
          dataIndex: 'monthlyCostSavingHours', key: 'mcsh', width: 110, align: 'center' as const, className: 'cho-col-result',
          render: (v: number | null, record: DashboardRow) => {
            const cost = record.monthlySavedCost;
            const note = record.costReductionNote;
            const hasDetail = v != null && v > 0 && (cost || note);
            const content = (
              <span className="font-mono text-xs" style={{ color: v != null && v > 0 ? '#d97706' : 'var(--text-muted)' }}>
                {numOrDash(v, 'h')}
              </span>
            );
            if (!hasDetail) return content;
            return (
              <Tooltip
                title={
                  <div className="text-xs">
                    {cost && <div>月均降本费用：¥{cost}</div>}
                    {note && <div className="mt-1" style={{ color: 'rgba(255,255,255,0.7)' }}>说明：{note}</div>}
                  </div>
                }
              >
                <span className="cursor-help border-b border-dashed" style={{ borderColor: '#d97706' }}>
                  {content}
                </span>
              </Tooltip>
            );
          },
        },
        {
          title: <FmtHeader label={FIELD_LABELS.totalMonthlySavedHours} tip={VALUE_FORMULA_COPY.totalSavedHours} />,
          dataIndex: 'totalMonthlySavedHours', key: 'tmsh', width: 110, align: 'center' as const, className: 'cho-col-result',
          render: (v: number | null) => <span className="font-mono text-xs font-bold" style={{ color: v != null && v > 0 ? '#16a34a' : 'var(--text-muted)' }}>{numOrDash(v, 'h')}</span>,
        },
      ],
    },

    // ── 复用价值 ──
    {
      title: <FmtHeader label="复用价值" tip="方案可复用的范围" />,
      key: 'reuse-group',
      className: 'cho-group-reuse',
      children: [
        {
          title: <FmtHeader label="复用价值系数" tip="跨团队/BU 复用范围" />,
          dataIndex: 'reuseValue', key: 'rm', width: 200, align: 'center' as const, className: 'cho-col-reuse',
          render: (v: string | null) => {
            if (!v) return <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>;
            const ls = reuseLevelStyle(v);
            return (
              <span className="inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap" style={{ background: ls.bg, color: ls.fg, border: `1px solid ${ls.border}` }}>
                {v}
              </span>
            );
          },
        },
        {
          title: <FmtHeader label="地区系数" tip="场景归属地区系数" />,
          dataIndex: 'regionCoefficient', key: 'rc', width: 120, align: 'center' as const, className: 'cho-col-reuse',
          render: (v: string | null) => <span className="text-xs font-medium" style={{ color: v ? 'var(--foreground)' : 'var(--text-muted)' }}>{v || '—'}</span>,
        },
      ],
    },

    // ── 最终价值计分 ──
    {
      title: <FmtHeader label="最终价值计分" tip="= 月均节省总工时 × 归属地区人力成本系数 × 复用价值系数" />,
      dataIndex: 'finalValueScore',
      key: 'fvs',
      width: 110,
      align: 'center' as const,
     
      render: (v: number | null) => (
        <span className="font-mono text-xs font-bold" style={{ color: v != null && v > 0 ? '#7c3aed' : 'var(--text-muted)' }}>
          {v != null ? Math.round(v) : '—'}
        </span>
      ),
    },

    // ── 一句话简介（最后一列） ──
    {
      title: '一句话简介',
      dataIndex: 'briefIntro',
      key: 'briefIntro',
      width: 250,
      align: 'center' as const,
      ellipsis: true,
     
      render: (v: string | null) => (
        <span className="text-[11px] leading-snug" style={{ color: v ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
          {v || '—'}
        </span>
      ),
    },
  ];

  // ── Guard ──
  if (!canView) return null;

  return (
    <>
      <style jsx global>{`
        /* ── 表格容器 ── */
        .cho-table-wrap .ant-table {
        }
        /* ── 列拖拽拉宽 ── */
        .cho-table-wrap .react-resizable {
          position: relative;
        }
        .cho-table-wrap .react-resizable-handle {
          position: absolute;
          right: 0;
          top: 0;
          bottom: 0;
          width: 6px;
          cursor: col-resize;
          background: transparent;
          z-index: 1;
        }
        .cho-table-wrap .react-resizable-handle:hover,
        .cho-table-wrap .react-resizable-handle:active {
          background: rgba(26, 58, 138, 0.3);
        }
        /* ── 冻结列 ── */
        .cho-frozen-rank {
          position: sticky !important;
          left: 0 !important;
          z-index: 3 !important;
        }
        /* ── 表头分组 ── */
        .cho-group-compare > .ant-table-cell {
          background: #f8fafc !important;
          border-left: 3px solid #64748b !important;
          border-top: 3px solid #64748b !important;
          color: #334155 !important;
        }
        .cho-group-result > .ant-table-cell {
          background: #e0e7ff !important;
          border-left: 3px solid #4f46e5 !important;
          border-top: 3px solid #4f46e5 !important;
          color: #3730a3 !important;
        }
        .cho-group-reuse > .ant-table-cell {
          background: #fff7ed !important;
          border-left: 3px solid #ea580c !important;
          border-top: 3px solid #ea580c !important;
          color: #c2410c !important;
        }
        /* ── 前后对比列底色 ── */
        .cho-col-before { background: rgba(251,191,36,0.06) !important; }
        .cho-col-after { background: rgba(16,185,129,0.06) !important; }
        .cho-table-row:hover .cho-col-before { background: rgba(251,191,36,0.12) !important; }
        .cho-table-row:hover .cho-col-after { background: rgba(16,185,129,0.12) !important; }
        /* ── 数据行分组底色 ── */
        .cho-col-result {
          background: rgba(224, 231, 255, 0.25) !important;
        }
        .cho-col-reuse {
          background: rgba(255, 237, 213, 0.3) !important;
        }
        .cho-table-row:hover .cho-col-result {
          background: rgba(224, 231, 255, 0.45) !important;
        }
        .cho-table-row:hover .cho-col-reuse {
          background: rgba(255, 237, 213, 0.55) !important;
        }
        /* ── 行 ── */
        .cho-table-row td {
          border-bottom: 1px solid rgba(0, 0, 0, 0.04) !important;
          padding: 10px 8px !important;
        }
        .ant-table-thead > tr > th {
          padding: 7px 8px !important;
          font-size: 11px !important;
          font-weight: 600 !important;
        }
      `}</style>

      <div className="py-2 sm:py-3">
        {/* 操作栏（按钮放左侧，无标题） */}
        <div className="glass rounded-xl px-4 py-3 mb-2 flex items-center gap-2" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
          {canSyncCompetition && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all hover:scale-105 disabled:opacity-50"
              style={{
                background: isAllCompetitionPeriod(period) ? 'rgba(148,163,184,0.8)' : 'linear-gradient(135deg, #d46b08, #f27f22)',
                boxShadow: isAllCompetitionPeriod(period) ? 'none' : '0 4px 15px rgba(242,127,34,0.3)',
              }}
            >
              <SyncOutlined spin={syncing} /> 从飞书同步
            </button>
          )}
          {canExportImage && (
            <button
              onClick={handleExportImage}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105 disabled:opacity-50"
              style={{ background: 'rgba(255,255,255,0.7)', color: '#b3540e', border: '1px solid rgba(242,127,34,0.3)' }}
            >
              <DownloadOutlined spin={exporting} /> 导出图片
            </button>
          )}
        </div>

        <div className="mb-2">
          <CompetitionPeriodTimeline
            title="成效周期"
            hint="点击节点筛选成效看板数据 ↓"
            activePeriods={activePeriods}
            selectedPeriod={period}
            periodMap={periodMap}
            allCount={timelineAllCount}
            onSelect={setPeriod}
            onFutureClick={() => message.info('该评审周期尚未开启')}
          />
        </div>

        {/* 筛选 + 排序（不参与导出） */}
        <div className="glass rounded-xl px-4 py-3 mb-2" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>排序</span>
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSortBy(opt.value)}
                  className="px-2 py-0.5 rounded-md text-[11px] font-medium transition-all"
                  style={{
                    background: sortBy === opt.value ? 'var(--primary)' : 'rgba(0,0,0,0.04)',
                    color: sortBy === opt.value ? '#fff' : 'var(--text-secondary)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setFilterExpanded(!filterExpanded)}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all hover:bg-gray-100"
              style={{ color: 'var(--text-muted)' }}
            >
              {filterExpanded ? '收起筛选' : '展开筛选'}
              <span className="text-[10px]">{filterExpanded ? '▲' : '▼'}</span>
            </button>
          </div>
          {filterExpanded && (
            <div className="mt-3 pt-3 space-y-2" style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
              <FilterRow label="部门" options={fieldOptionsToFilterItems('team', enriched, fieldOptions)} value={teamFilter} onChange={setTeamFilter} />
              <FilterRow label="场景分类" options={fieldOptionsToFilterItems('sceneCategory', enriched, fieldOptions)} value={sceneCategoryFilter} onChange={setSceneCategoryFilter} />
              <FilterRow label="核心价值" options={fieldOptionsToFilterItems('coreValue', enriched, fieldOptions)} value={coreValueFilter} onChange={setCoreValueFilter} />
              <FilterRow label="场景来源" options={fieldOptionsToFilterItems('sceneSource', enriched, fieldOptions)} value={sceneSourceFilter} onChange={setSceneSourceFilter} />
              <FilterRow label="落地进展" options={fieldOptionsToFilterItems('landingProgress', enriched, fieldOptions)} value={landingProgressFilter} onChange={setLandingProgressFilter} />
              <FilterRow label="大赛进展" options={fieldOptionsToFilterItems('competitionProgress', enriched, fieldOptions)} value={statusFilter} onChange={setStatusFilter} />
            </div>
          )}
        </div>

        {/* 导出范围：指标卡片 + 核心公式 + 数据表格 */}
        <div id="cho-dashboard-export" data-export-stack>
          {/* 顶部统计 */}
          <div className="glass rounded-2xl p-5 mb-2" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <StatCard icon={<BarChartOutlined />} label="参赛方案数" value={String(summary.count)} color="var(--primary)" />
              <StatCard icon={<TeamOutlined />} label="覆盖人数" value={summary.totalPeople > 0 ? `${summary.totalPeople}` : '—'} sub="执行人数合计" color="#0891b2" />
              <StatCard icon={<RiseOutlined />} label={FIELD_LABELS.monthlySavedHours} value={summary.totalSavedEfficiency > 0 ? `${summary.totalSavedEfficiency}h` : '—'} sub={VALUE_FORMULA_COPY.monthlySavedHours} color="#16a34a" />
              <StatCard icon={<ThunderboltOutlined />} label={FIELD_LABELS.monthlySavedCost} value={summary.totalMonthlySavedCostDisplay} sub="不含人力成本" color="#d97706" />
              <StatCard icon={<ClockCircleOutlined />} label={FIELD_LABELS.totalMonthlySavedHours} value={summary.totalMonthlySavedHoursSum > 0 ? `${summary.totalMonthlySavedHoursSum}h` : '—'} sub="提效 + 降本折算" color="#7c3aed" highlight />
            </div>
          </div>

          {/* 核心公式 */}
          <div
            data-export-block="formula"
            className="glass rounded-lg px-5 py-4 my-2"
            style={{ borderColor: 'rgba(220, 38, 38, 0.15)', background: 'rgba(254, 242, 242, 0.6)' }}
          >
            <div className="text-[11px] font-bold mb-2" style={{ color: '#dc2626' }}>核心公式</div>
            <div className="space-y-1.5">
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626' }}>1</span>
                <span className="text-[11px] font-semibold" style={{ color: '#991b1b' }}>月均提效节省工时</span>
                <span className="text-[11px] font-mono" style={{ color: '#b91c1c' }}>= 月均操作频次 × 单次操作耗时 × 操作人数</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626' }}>2</span>
                <span className="text-[11px] font-semibold" style={{ color: '#991b1b' }}>月均降本折算工时</span>
                <span className="text-[11px] font-mono" style={{ color: '#b91c1c' }}>= 月均降本费用 / (50 × 场景归属地区系数值)</span>
                <span className="text-[10px]" style={{ color: '#9ca3af' }}>定义：按 [全球HR时薪均值] 折算为工时数</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626' }}>3</span>
                <span className="text-[11px] font-semibold" style={{ color: '#991b1b' }}>{FIELD_LABELS.totalMonthlySavedHours}</span>
                <span className="text-[11px] font-mono" style={{ color: '#b91c1c' }}>= 月均提效节省工时 + 月均降本折算工时</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'rgba(124,58,237,0.1)', color: '#7c3aed' }}>4</span>
                <span className="text-[11px] font-semibold" style={{ color: '#5b21b6' }}>最终价值计分</span>
                <span className="text-[11px] font-mono" style={{ color: '#6d28d9' }}>= 月均节省总工时 × 归属地区人力成本系数 × 复用价值系数</span>
              </div>
            </div>
          </div>

          {/* 数据表格（参赛项目数据明细） */}
          {loading ? (
            <div className="flex justify-center py-16"><Spin size="large" /></div>
          ) : tableData.length === 0 ? (
            <div className="text-center py-16 glass rounded-2xl" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>该期暂无方案</p>
            </div>
          ) : (
            <div className="glass rounded-2xl overflow-hidden cho-table-wrap" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
              <Table
                dataSource={tableData}
                columns={columns}
                rowKey="id"
                pagination={false}
                size="small"
                scroll={{ x: 'max-content' }}
                rowClassName={() => 'cho-table-row'}
              />
            </div>
          )}
        </div>

        {/* 方案详情弹窗 */}
        <SubmissionDetailModal
          record={detailRecord}
          onClose={() => setDetailRecord(null)}
        />
      </div>
    </>
  );
}

// ─── Helpers (render) ────────────────────────────────────────────

function numOrDash(v: number | null | undefined, unit: string, decimals = 0): string {
  if (v == null) return '—';
  const n = decimals === 0 ? String(Math.round(v)) : v.toFixed(decimals);
  return `${n}${unit}`;
}

// ─── Sub-components ──────────────────────────────────────────────

function StatCard({ icon, label, value, sub, color, highlight }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color: string; highlight?: boolean;
}) {
  return (
    <div
      className="glass rounded-xl p-4 flex flex-col items-center text-center"
      style={{
        borderColor: highlight ? 'rgba(22,163,74,0.3)' : 'rgba(255, 255, 255, 0.6)',
        background: highlight ? 'rgba(22,163,74,0.06)' : undefined,
      }}
    >
      <span className="text-lg mb-1" style={{ color }}>{icon}</span>
      <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-xl font-bold font-mono mt-0.5" style={{ color }}>{value}</span>
      {sub && <span className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</span>}
    </div>
  );
}

/** 筛选行 pill 组件 */
function FilterRow({ label, options, value, onChange }: {
  label: string;
  options: FilterItem[];
  value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-all"
          style={{
            background: value === opt.value ? 'var(--primary)' : 'rgba(0,0,0,0.04)',
            color: value === opt.value ? '#fff' : 'var(--text-secondary)',
          }}
        >
          {opt.label} <span className="opacity-60">({opt.count})</span>
        </button>
      ))}
    </div>
  );
}

// ─── 方案详情弹窗 ────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SubmissionDetailModal({ record, onClose }: { record: any | null; onClose: () => void }) {
  if (!record) return null;

  const r = record;
  const beforeFreqDisplay = fmtFreq(r.beforeFreq);
  const afterFreqDisplay = fmtFreq(r.afterFreq);

  // 变化标记
  const diff = (oldVal: number | null | undefined, newVal: number | null | undefined, positiveUp: boolean) => {
    const dir = changeDir(oldVal, newVal);
    if (!dir) return null;
    const isGood = (dir === 'up' && positiveUp) || (dir === 'down' && !positiveUp);
    return { color: isGood ? '#16a34a' : '#dc2626', arrow: dir === 'up' ? '↑' : '↓' };
  };

  return (
    <Modal
      open={!!r}
      onCancel={onClose}
      footer={null}
      width={680}
      title={
        <div className="pr-8">
          <div className="text-base font-bold" style={{ color: 'var(--foreground)' }}>{r.title}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {r.team || '—'}{r.sceneCategory ? ` · ${r.sceneCategory}` : ''}
          </div>
        </div>
      }
    >
      <div className="space-y-5 pt-2">
        {/* 核心指标 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.15)' }}>
            <div className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>① 提效节省工时</div>
            <div className="text-lg font-bold font-mono" style={{ color: '#16a34a' }}>{numOrDash(r.savedHours, 'h')}</div>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
            <div className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>② {FIELD_LABELS.costSavedHours}</div>
            <div className="text-lg font-bold font-mono" style={{ color: '#d97706' }}>{numOrDash(r.monthlyCostSavingHours, 'h')}</div>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(26,58,138,0.04)', border: '1px solid rgba(26,58,138,0.1)' }}>
            <div className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>③ {FIELD_LABELS.totalMonthlySavedHours}</div>
            <div className="text-lg font-bold font-mono" style={{ color: 'var(--primary)' }}>{numOrDash(r.totalMonthlySavedHours, 'h')}</div>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.12)' }}>
            <div className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>④ 最终价值计分</div>
            <div className="text-lg font-bold font-mono" style={{ color: '#7c3aed' }}>{r.finalValueScore != null ? Math.round(r.finalValueScore) : '—'}</div>
          </div>
        </div>

        {/* 改造前后对比表（含 mini bar） */}
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.02)' }}>
                <th className="text-left px-4 py-2 font-semibold" style={{ color: 'var(--text-muted)', width: 90 }}>指标</th>
                <th className="text-center px-2 py-2 font-semibold" style={{ color: '#b45309', width: '37%' }}>改造前</th>
                <th className="text-center px-2 py-2" style={{ width: 32 }}></th>
                <th className="text-center px-2 py-2 font-semibold" style={{ color: '#047857', width: '37%' }}>改造后</th>
                <th className="text-center px-2 py-2 font-semibold" style={{ color: 'var(--text-muted)', width: 50 }}>变化</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: '执行人数', old: r.beforePeopleCount, new: r.afterPeopleCount, unit: '人', positiveUp: false },
                { label: '执行频次', oldText: beforeFreqDisplay, newText: afterFreqDisplay, oldNum: r.beforeFreq, newNum: r.afterFreq },
                { label: '单次耗时', old: r.oldHoursPerTask, new: r.newDuration, unit: 'h', positiveUp: false, decimals: 1 },
                { label: '月总工时', old: r.beforeHours, new: r.afterHours, unit: 'h', positiveUp: false, bold: true },
              ].map((row, i) => {
                const hasNums = 'old' in row || 'oldNum' in row;
                const oldN = 'old' in row ? row.old : (row as { oldNum?: number | null }).oldNum;
                const newN = 'new' in row ? row.new : (row as { newNum?: number | null }).newNum;
                const d = hasNums ? diff(oldN as number | null, newN as number | null, row.positiveUp ?? false) : null;
                // mini bar：before 为满刻度（100%），after 按 new/old 比例缩短
                const ratio = oldN != null && newN != null && oldN !== 0
                  ? Math.min(Math.max((newN / oldN) * 100, 0), 100)
                  : null;
                const deltaPct = d && oldN != null && oldN !== 0
                  ? Math.round(Math.abs(((newN ?? 0) - oldN) / oldN) * 100)
                  : null;
                const isBold = 'bold' in row && row.bold;
                return (
                  <tr key={i} style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                    <td className={`px-4 py-2 font-medium ${isBold ? 'font-bold' : ''}`} style={{ color: 'var(--foreground)' }}>{row.label}</td>
                    {/* 改造前：满刻度灰条 + 数值 */}
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-[8px] rounded-sm overflow-hidden" style={{ background: 'rgba(0,0,0,0.04)' }}>
                          {oldN != null && (
                            <div style={{ width: '100%', height: '100%', background: 'rgba(180,83,9,0.5)', borderRadius: 2 }} />
                          )}
                        </div>
                        <span className="font-mono text-xs whitespace-nowrap" style={{ color: '#b45309' }}>
                          {'oldText' in row ? row.oldText : numOrDash(row.old, row.unit!, (row as { decimals?: number }).decimals)}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center">
                      {d ? <span style={{ color: d.color, fontSize: 12 }}>{d.arrow}</span> : <SwapRightOutlined style={{ color: '#9ca3af', fontSize: 12 }} />}
                    </td>
                    {/* 改造后：按比例缩短的彩条 + 数值 */}
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-[8px] rounded-sm overflow-hidden" style={{ background: 'rgba(0,0,0,0.04)' }}>
                          {ratio != null && (
                            <div
                              style={{
                                width: `${ratio}%`,
                                height: '100%',
                                background: d ? d.color : 'rgba(100,116,139,0.5)',
                                borderRadius: 2,
                              }}
                            />
                          )}
                        </div>
                        <span className={`font-mono text-xs whitespace-nowrap ${isBold ? 'font-bold' : 'font-medium'}`} style={{ color: d ? d.color : 'var(--foreground)' }}>
                          {'newText' in row ? row.newText : numOrDash(row.new, row.unit!, (row as { decimals?: number }).decimals)}
                        </span>
                      </div>
                    </td>
                    {/* 变化百分比 */}
                    <td className="px-2 py-2 text-center">
                      {deltaPct != null ? (
                        <span className="font-mono text-xs" style={{ color: d?.color }}>
                          {d?.arrow}{deltaPct}%
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 复用 & 费用 & 系数 */}
        <div className="flex flex-wrap gap-2">
          {r.reuseValue && (
            <Tag color="purple" style={{ margin: 0 }}>
              复用系数 {r.reuseMultiplier ? `×${r.reuseMultiplier}` : r.reuseValue}
            </Tag>
          )}
          {r.monthlySavedCost && <Tag color="green" style={{ margin: 0 }}>降本 {r.monthlySavedCost}</Tag>}
          {r.sceneRegionCoefficientValue != null && (
            <Tag color="blue" style={{ margin: 0 }}>地区系数 {r.sceneRegionCoefficientValue}</Tag>
          )}
          {r.aiCost && <Tag style={{ margin: 0 }}>Token 费用 {r.aiCost}</Tag>}
        </div>

        {/* AI 工具 */}
        {r.aiTools?.length > 0 && (
          <div>
            <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>AI 工具</div>
            <div className="flex flex-wrap gap-1.5">
              {r.aiTools.map((t: string) => <Tag key={t} color="geekblue" style={{ margin: 0, fontSize: 11 }}>{t}</Tag>)}
            </div>
          </div>
        )}

        {/* 流程对比 */}
        {(r.beforeProcess || r.afterProcess) && (
          <div className="grid grid-cols-2 gap-3">
            {r.beforeProcess && (
              <div className="rounded-lg p-3 text-xs leading-relaxed" style={{ background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.1)' }}>
                <div className="font-semibold mb-1" style={{ color: '#b45309' }}>原流程</div>
                <div style={{ color: 'var(--text-secondary)' }}>{r.beforeProcess}</div>
              </div>
            )}
            {r.afterProcess && (
              <div className="rounded-lg p-3 text-xs leading-relaxed" style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.1)' }}>
                <div className="font-semibold mb-1" style={{ color: '#047857' }}>AI 后</div>
                <div style={{ color: 'var(--text-secondary)' }}>{r.afterProcess}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
