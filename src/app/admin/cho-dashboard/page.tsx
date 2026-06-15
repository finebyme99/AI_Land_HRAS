'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Spin, App, Select, Table, Modal, Tag, type TableColumnsType } from 'antd';
import {
  BarChartOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  RiseOutlined,
  ThunderboltOutlined,
  SyncOutlined,
  SwapRightOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/lib/auth-context';

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
  aiCost: string | null;
  briefIntro: string | null;
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
}

// ─── Constants ───────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { value: '2605', label: '5 月 (2605)' },
  { value: '2606', label: '6 月 (2606)' },
  { value: '2604', label: '4 月 (2604)' },
  { value: '2603', label: '3 月 (2603)' },
];

const SORT_OPTIONS = [
  { value: 'savedHours', label: '节省工时' },
  { value: 'reuseSaved', label: '推广预估节省工时' },
  { value: 'efficiency', label: '提效比例' },
  { value: 'beforeHours', label: '原工时' },
  { value: 'people', label: '人数' },
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

/** 飞书存储为小数 0~1，显示为百分比，保留 1 位小数 */
function fmtPct(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${(v * 100).toFixed(1)}%`;
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

// ─── Component ───────────────────────────────────────────────────

export default function ChoDashboardPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const { isAdmin, loading: authLoading } = useAuth();
  const [period, setPeriod] = useState('2605');
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState('savedHours');
  const [detailRecord, setDetailRecord] = useState<typeof enriched[number] | null>(null);

  useEffect(() => {
    if (!authLoading && !isAdmin) router.replace('/');
  }, [authLoading, isAdmin, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/competitions/overview?period=${period}`);
      if (!res.ok) throw new Error((await res.json()).error || '加载失败');
      setData(await res.json());
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [period, message]);

  useEffect(() => { if (isAdmin) fetchData(); }, [isAdmin, fetchData]);

  const [syncing, setSyncing] = useState(false);
  const handleSync = async () => {
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
      await fetchData();
    } catch (err) {
      const msg = err instanceof DOMException && err.name === 'AbortError' ? '同步超时' : err instanceof Error ? err.message : '同步失败';
      message.error({ content: msg, key: 'sync' });
    } finally {
      setSyncing(false);
    }
  };

  // ── Enriched data: 月总工时 = 频次 × 单次耗时 × 人数 ──
  const enriched = useMemo(() => {
    return (data?.submissions ?? []).map((s, idx) => {
      const beforeFreq = calcMonthlyFreq(s.oldFrequency, s.oldOperationCount);
      const afterFreq = calcMonthlyFreq(s.newFrequency, s.newOperationCount);
      const beforeHours = calcMonthlyHours(beforeFreq, s.oldHoursPerTask, s.beforePeopleCount);
      const afterHours = calcMonthlyHours(afterFreq, s.newDuration, s.afterPeopleCount);
      const savedHours = s.monthlySavedHours ?? (
        beforeHours != null && afterHours != null
          ? Math.round((beforeHours - afterHours) * 10) / 10
          : null
      );
      const reuseMultiplier = extractMultiplier(s.reuseValue);
      const reuseSavedHours = reuseMultiplier != null && savedHours != null
        ? Math.round(reuseMultiplier * savedHours * 10) / 10
        : null;
      return { ...s, beforeFreq, afterFreq, beforeHours, afterHours, savedHours, reuseMultiplier, reuseSavedHours, fixedSeq: idx + 1 };
    });
  }, [data]);

  // ── Summary ──
  const summary = useMemo(() => {
    const totalPeople = enriched.reduce((sum, s) => sum + (s.beforePeopleCount ?? 0), 0);
    const totalBefore = enriched.reduce((sum, s) => sum + (s.beforeHours ?? 0), 0);
    const totalAfter = enriched.reduce((sum, s) => sum + (s.afterHours ?? 0), 0);
    const totalSaved = enriched.reduce((sum, s) => sum + (s.savedHours ?? 0), 0);
    const withEff = enriched.filter((s) => s.efficiencyRate != null);
    const avgEff = withEff.length > 0
      ? withEff.reduce((sum, s) => sum + (s.efficiencyRate ?? 0), 0) / withEff.length
      : null;
    return {
      count: enriched.length,
      totalPeople,
      totalBefore: Math.round(totalBefore * 10) / 10,
      totalAfter: Math.round(totalAfter * 10) / 10,
      totalSaved: Math.round(totalSaved * 10) / 10,
      avgEfficiency: avgEff != null ? Math.round(avgEff * 1000) / 10 : null,
    };
  }, [enriched]);

  // ── Teams ──
  const teams = useMemo(() => {
    const set = new Set<string>();
    enriched.forEach((s) => s.team && set.add(s.team));
    return Array.from(set).sort();
  }, [enriched]);

  const teamCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    enriched.forEach((s) => { if (s.team) counts[s.team] = (counts[s.team] ?? 0) + 1; });
    return counts;
  }, [enriched]);

  // ── Max values for inline bars ──
  const maxSavedHours = useMemo(() => Math.max(0, ...enriched.map((s) => s.savedHours ?? 0)), [enriched]);
  const maxReuseSaved = useMemo(() => Math.max(0, ...enriched.map((s) => s.reuseSavedHours ?? 0)), [enriched]);

  // ── Filtered & sorted ──
  const tableData = useMemo(() => {
    let list = enriched;
    if (teamFilter !== 'all') list = list.filter((s) => s.team === teamFilter);
    const sorted = [...list].sort((a, b) => {
      switch (sortBy) {
        case 'savedHours': return (b.savedHours ?? -1) - (a.savedHours ?? -1);
        case 'reuseSaved': return (b.reuseSavedHours ?? -1) - (a.reuseSavedHours ?? -1);
        case 'efficiency': return (b.efficiencyRate ?? -1) - (a.efficiencyRate ?? -1);
        case 'beforeHours': return (b.beforeHours ?? -1) - (a.beforeHours ?? -1);
        case 'people': return (b.beforePeopleCount ?? -1) - (a.beforePeopleCount ?? -1);
        default: return 0;
      }
    });
    return sorted.map((s) => ({ ...s, seq: s.fixedSeq }));
  }, [enriched, teamFilter, sortBy]);

  // ── Table columns ──
  const columns: TableColumnsType<typeof tableData[number]> = [
    // ── 基础 ──
    {
      title: '序号',
      dataIndex: 'seq',
      key: 'seq',
      width: 48,
      align: 'center',
      fixed: 'left',
      className: 'cho-frozen-rank',
      render: (seq: number) => (
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{seq}</span>
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 170,
      ellipsis: true,
      render: (title: string, record) => (
        <div>
          <button
            onClick={() => setDetailRecord(record)}
            className="text-xs font-medium truncate text-left hover:underline w-full"
            style={{ color: 'var(--primary)' }}
          >
            <LinkOutlined className="mr-1" style={{ fontSize: 10, opacity: 0.5 }} />
            {title}
          </button>
          <div className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{record.team || '—'}</div>
        </div>
      ),
    },

    // ── 改造前后对比（上下对比） ──
    {
      title: <span style={{ color: '#6b7280' }}>改造前后对比</span>,
      key: 'compare',
      width: 280,
      render: (_: unknown, r: typeof tableData[number]) => {
        const metrics = [
          { label: '人数', before: r.beforePeopleCount, after: r.afterPeopleCount, unit: '人', positiveUp: false },
          { label: '频次', before: r.beforeFreq, after: r.afterFreq, unit: '', positiveUp: true, isFreq: true },
          { label: '单次耗时', before: r.oldHoursPerTask, after: r.newDuration, unit: 'h', positiveUp: false },
          { label: '月总工时', before: r.beforeHours, after: r.afterHours, unit: 'h', positiveUp: false, bold: true },
        ];
        return (
          <div className="space-y-1 py-0.5">
            {metrics.map((m) => {
              const bText = m.isFreq ? fmtFreq(m.before as number | null) : numOrDash(m.before as number | null, m.unit);
              const aText = m.isFreq ? fmtFreq(m.after as number | null) : numOrDash(m.after as number | null, m.unit);
              const dir = m.isFreq ? changeDir(m.before as number | null, m.after as number | null) : changeDir(m.before as number | null, m.after as number | null);
              const hasChange = dir !== null;
              const isGood = hasChange && ((dir === 'up' && m.positiveUp) || (dir === 'down' && !m.positiveUp));
              return (
                <div key={m.label} className="flex items-center gap-1.5 text-[11px] leading-tight">
                  <span className="shrink-0 w-[42px] text-right" style={{ color: 'var(--text-muted)', fontSize: 10 }}>{m.label}</span>
                  <span className="font-mono" style={{ color: 'var(--text-muted)' }}>{bText}</span>
                  <span style={{ color: hasChange ? (isGood ? '#16a34a' : '#dc2626') : 'var(--text-muted)', fontSize: 10 }}>
                    {hasChange ? (dir === 'down' ? '↓' : '↑') : '→'}
                  </span>
                  <span className={`font-mono ${m.bold ? 'font-bold' : 'font-medium'}`} style={{ color: hasChange ? (isGood ? '#16a34a' : '#dc2626') : 'var(--foreground)' }}>
                    {aText}
                  </span>
                </div>
              );
            })}
          </div>
        );
      },
    },

    // ── 成效 ──
    {
      title: <span style={{ color: '#1a3a8a' }}>成效</span>,
      key: 'result-group',
      className: 'cho-group-result',
      children: [
        {
          title: '节省工时', dataIndex: 'savedHours', key: 'sh', width: 95, align: 'right' as const, className: 'cho-col-result',
          render: (v: number | null, record: any) => {
            const dir = changeDir(record.beforeHours, record.afterHours);
            const pct = v != null && maxSavedHours > 0 ? Math.min(Math.max(v / maxSavedHours, 0) * 100, 100) : 0;
            return (
              <div className="flex items-center justify-end gap-1" style={{ position: 'relative' }}>
                {pct > 0 && (
                  <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', height: 16, width: `${pct}%`, maxWidth: '100%', background: 'rgba(22,163,74,0.12)', borderRadius: 2, zIndex: 0 }} />
                )}
                <span className="inline-flex items-center gap-1" style={{ position: 'relative', zIndex: 1 }}>
                  {dir && <span className="text-[10px]" style={{ color: dir === 'down' ? '#16a34a' : '#dc2626' }}>{dir === 'down' ? '↓' : '↑'}</span>}
                  <span className="font-mono text-xs font-bold" style={{ color: v != null && v > 0 ? '#16a34a' : 'var(--text-muted)' }}>{numOrDash(v, 'h')}</span>
                </span>
              </div>
            );
          },
        },
        {
          title: '提效比例', dataIndex: 'efficiencyRate', key: 'eff', width: 72, align: 'right' as const, className: 'cho-col-result',
          render: (v: number | null) => <span className="font-mono text-xs font-medium" style={{ color: v != null && v > 0 ? '#16a34a' : 'var(--text-muted)' }}>{fmtPct(v)}</span>,
        },
        {
          title: 'Token 费用', dataIndex: 'aiCost', key: 'tc', width: 62, align: 'right' as const, className: 'cho-col-result',
          render: (v: string | null) => <span className="font-mono text-xs" style={{ color: v ? 'var(--foreground)' : 'var(--text-muted)' }}>{v || '—'}</span>,
        },
      ],
    },

    // ── 复用价值 ──
    {
      title: <span style={{ color: '#c2410c' }}>复用价值</span>,
      key: 'reuse-group',
      className: 'cho-group-reuse',
      children: [
        {
          title: '推广预估节省工时', dataIndex: 'reuseSavedHours', key: 'rs', width: 100, align: 'right' as const, className: 'cho-col-reuse',
          render: (v: number | null) => {
            const pct = v != null && maxReuseSaved > 0 ? Math.min(Math.max(v / maxReuseSaved, 0) * 100, 100) : 0;
            return (
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                {pct > 0 && (
                  <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', height: 16, width: `${pct}%`, maxWidth: '100%', background: 'rgba(234,88,12,0.12)', borderRadius: 2, zIndex: 0 }} />
                )}
                <span className="font-mono text-xs font-bold" style={{ color: v != null && v > 0 ? '#c2410c' : 'var(--text-muted)', position: 'relative', zIndex: 1 }}>{numOrDash(v, 'h')}</span>
              </div>
            );
          },
        },
        {
          title: '复用系数', dataIndex: 'reuseValue', key: 'rm', width: 140, align: 'center' as const, className: 'cho-col-reuse',
          render: (v: string | null, record: any) => {
            if (!v) return <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>;
            const level = record.reuseValueLevel;
            const levelStyle: Record<string, { bg: string; fg: string; border: string }> = {
              '低价值':   { bg: 'rgba(34,197,94,0.08)',  fg: '#16a34a', border: 'rgba(34,197,94,0.2)' },
              '中价值':   { bg: 'rgba(20,184,166,0.1)',  fg: '#0d9488', border: 'rgba(20,184,166,0.25)' },
              '高价值':   { bg: 'rgba(245,158,11,0.12)', fg: '#d97706', border: 'rgba(245,158,11,0.3)' },
              '极高价值': { bg: 'rgba(234,88,12,0.15)',  fg: '#c2410c', border: 'rgba(234,88,12,0.35)' },
            };
            const s = levelStyle[level ?? ''] ?? { bg: 'rgba(0,0,0,0.04)', fg: 'var(--text-secondary)', border: 'rgba(0,0,0,0.08)' };
            return (
              <span className="inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap" style={{ background: s.bg, color: s.fg, border: `1px solid ${s.border}` }}>
                {v}
              </span>
            );
          },
        },
      ],
    },

    // ── 一句话简介 ──
    {
      title: '一句话简介',
      dataIndex: 'briefIntro',
      key: 'briefIntro',
      width: 160,
      ellipsis: true,
      render: (v: string | null) => (
        <span className="text-[11px] leading-snug" style={{ color: v ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
          {v || '—'}
        </span>
      ),
    },
  ];

  // ── Guard ──
  if (authLoading) return <div className="flex justify-center items-center min-h-[60vh]"><Spin size="large" /></div>;
  if (!isAdmin) return null;

  return (
    <>
      <style jsx global>{`
        /* ── 表格容器：右侧留白 ── */
        .cho-table-wrap .ant-table {
          margin-right: 8px;
        }
        /* ── 冻结列 ── */
        .cho-frozen-rank {
          position: sticky !important;
          left: 0 !important;
          z-index: 3 !important;
        }
        /* ── 表头分组 ── */
        .cho-group-before > .ant-table-cell {
          background: #fef3c7 !important;
          border-left: 3px solid #f59e0b !important;
          border-top: 3px solid #f59e0b !important;
          color: #92400e !important;
          cursor: pointer;
        }
        .cho-group-after > .ant-table-cell {
          background: #d1fae5 !important;
          border-left: 3px solid #10b981 !important;
          border-top: 3px solid #10b981 !important;
          color: #065f46 !important;
          cursor: pointer;
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
        /* ── 分隔列 ── */
        .cho-sep-col > .ant-table-cell {
          background: transparent !important;
          padding: 0 !important;
        }
        /* ── 数据行分组底色 ── */
        .cho-col-before {
          background: rgba(254, 243, 199, 0.3) !important;
        }
        .cho-col-after {
          background: rgba(209, 250, 229, 0.3) !important;
        }
        .cho-col-result {
          background: rgba(224, 231, 255, 0.25) !important;
        }
        .cho-col-reuse {
          background: rgba(255, 237, 213, 0.3) !important;
        }
        .cho-table-row:hover .cho-col-before {
          background: rgba(254, 243, 199, 0.55) !important;
        }
        .cho-table-row:hover .cho-col-after {
          background: rgba(209, 250, 229, 0.55) !important;
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

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #16a34a, #0891b2)', color: '#fff' }}>
              <BarChartOutlined />
            </span>
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>AI 落地成效总览</h1>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>改造前后对比 · 当前价值 + 未来预期</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all hover:scale-105 disabled:opacity-50"
              style={{ background: 'var(--primary)', boxShadow: '0 4px 15px rgba(26,58,138,0.25)' }}
            >
              <SyncOutlined spin={syncing} /> 从飞书同步
            </button>
            <Select value={period} onChange={setPeriod} options={PERIOD_OPTIONS} style={{ width: 150 }} size="middle" />
          </div>
        </div>

        {/* 顶部统计 */}
        <div className="glass rounded-2xl p-5 mb-5" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatCard icon={<BarChartOutlined />} label="方案数" value={String(summary.count)} color="var(--primary)" />
            <StatCard icon={<TeamOutlined />} label="覆盖人数" value={summary.totalPeople > 0 ? `${summary.totalPeople}` : '—'} sub="执行人数合计" color="#0891b2" />
            <StatCard icon={<ClockCircleOutlined />} label="原总工时" value={summary.totalBefore > 0 ? `${summary.totalBefore}h` : '—'} sub="月均合计" color="#d97706" />
            <StatCard icon={<ThunderboltOutlined />} label="AI 后工时" value={summary.totalAfter > 0 ? `${summary.totalAfter}h` : '—'} sub="月均合计" color="#7c3aed" />
            <StatCard icon={<RiseOutlined />} label="节省工时" value={summary.totalSaved > 0 ? `${summary.totalSaved}h` : '—'} sub={summary.avgEfficiency != null ? `平均提效 ${summary.avgEfficiency.toFixed(1)}%` : '月均合计'} color="#16a34a" highlight />
          </div>
        </div>

        {/* 核心公式说明 */}
        <div
          className="glass rounded-xl px-5 py-3 mb-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-1"
          style={{ borderColor: 'rgba(220, 38, 38, 0.2)', background: 'rgba(254, 242, 242, 0.7)' }}
        >
          <span className="text-xs font-semibold" style={{ color: '#dc2626' }}>核心公式</span>
          <span className="text-xs font-mono font-bold" style={{ color: '#991b1b' }}>
            月总工时 <span style={{ color: '#dc2626' }}>=</span> 月均操作次数 <span style={{ color: '#dc2626' }}>×</span> 单次操作耗时 <span style={{ color: '#dc2626' }}>×</span> 操作人数
          </span>
          <span className="text-[10px]" style={{ color: '#9ca3af' }}>·</span>
          <span className="text-xs font-mono" style={{ color: '#b91c1c' }}>
            节省工时 <span style={{ color: '#dc2626' }}>=</span> 改造前月总工时 <span style={{ color: '#dc2626' }}>−</span> 改造后月总工时
          </span>
          <span className="text-[10px]" style={{ color: '#9ca3af' }}>·</span>
          <span className="text-xs font-mono" style={{ color: '#c2410c' }}>
            推广预估 <span style={{ color: '#ea580c' }}>=</span> 节省工时 <span style={{ color: '#ea580c' }}>×</span> 复用系数
          </span>
        </div>

        {/* 筛选 + 排序 */}
        <div className="glass rounded-xl px-4 py-3 mb-4" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold flex items-center gap-1" style={{ color: 'var(--text-muted)' }}><TeamOutlined /> 部门</span>
            {[{ value: 'all', label: '全部', count: enriched.length }, ...teams.map((t) => ({ value: t, label: t, count: teamCounts[t] ?? 0 }))].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTeamFilter(opt.value)}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-all"
                style={{
                  background: teamFilter === opt.value ? 'var(--primary)' : 'rgba(0,0,0,0.04)',
                  color: teamFilter === opt.value ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {opt.label} <span className="opacity-60">({opt.count})</span>
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>排序</span>
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
          </div>
        </div>

        {/* 数据表格 */}
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
              scroll={{ x: 1100 }}
              rowClassName={() => 'cho-table-row'}
            />
          </div>
        )}

        {/* 底部说明 */}
        <div className="mt-4 text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          <span className="font-semibold">月总工时</span> = 频次(次/月) × 单次耗时 × 人数 ·
          <span className="font-semibold"> 绿色</span> = 改善 ·
          <span className="font-semibold"> 红色</span> = 需关注 ·
          <span className="font-semibold"> 频次</span>统一折算为次/月 ·
          <span className="font-semibold"> 推广预估节省工时</span> = 节省工时 × 复用价值系数 ·
          <span className="font-semibold"> 场景归属地区系数</span>待补充
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

function numOrDash(v: number | null | undefined, unit: string): string {
  if (v == null) return '—';
  const n = v % 1 === 0 ? String(v) : Math.round(v * 10) / 10 + '';
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
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.15)' }}>
            <div className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>节省工时</div>
            <div className="text-lg font-bold font-mono" style={{ color: '#16a34a' }}>{numOrDash(r.savedHours, 'h')}</div>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(26,58,138,0.04)', border: '1px solid rgba(26,58,138,0.1)' }}>
            <div className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>提效比例</div>
            <div className="text-lg font-bold font-mono" style={{ color: 'var(--primary)' }}>{fmtPct(r.efficiencyRate)}</div>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.12)' }}>
            <div className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>推广预估节省工时</div>
            <div className="text-lg font-bold font-mono" style={{ color: '#d97706' }}>{numOrDash(r.reuseSavedHours, 'h')}</div>
          </div>
        </div>

        {/* 改造前后对比表 */}
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.02)' }}>
                <th className="text-left px-4 py-2 font-semibold" style={{ color: 'var(--text-muted)' }}></th>
                <th className="text-center px-4 py-2 font-semibold" style={{ color: '#b45309' }}>改造前</th>
                <th className="text-center px-4 py-2" style={{ width: 36 }}></th>
                <th className="text-center px-4 py-2 font-semibold" style={{ color: '#047857' }}>改造后</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: '执行人数', old: r.beforePeopleCount, new: r.afterPeopleCount, unit: '人', positiveUp: false },
                { label: '执行频次', oldText: beforeFreqDisplay, newText: afterFreqDisplay },
                { label: '单次耗时', old: r.oldHoursPerTask, new: r.newDuration, unit: 'h', positiveUp: false },
                { label: '月总工时', old: r.beforeHours, new: r.afterHours, unit: 'h', positiveUp: false },
              ].map((row, i) => {
                const d = 'old' in row ? diff(row.old, row.new, row.positiveUp ?? false) : null;
                return (
                  <tr key={i} style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                    <td className="px-4 py-2 font-medium" style={{ color: 'var(--foreground)' }}>{row.label}</td>
                    <td className="px-4 py-2 text-center font-mono" style={{ color: 'var(--foreground)' }}>
                      {'oldText' in row ? row.oldText : numOrDash(row.old, row.unit!)}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {d ? <span style={{ color: d.color, fontSize: 12 }}>{d.arrow}</span> : <SwapRightOutlined style={{ color: '#16a34a', fontSize: 12 }} />}
                    </td>
                    <td className="px-4 py-2 text-center font-mono font-medium" style={{ color: d ? d.color : 'var(--foreground)' }}>
                      {'newText' in row ? row.newText : numOrDash(row.new, row.unit!)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 复用 & 费用 */}
        <div className="flex flex-wrap gap-2">
          {r.reuseValue && (
            <Tag color="purple" style={{ margin: 0 }}>
              复用系数 {r.reuseMultiplier ? `×${r.reuseMultiplier}` : r.reuseValue}
            </Tag>
          )}
          {r.reuseValueLevel && (
            <Tag color={r.reuseValueLevel === '高价值' ? 'green' : r.reuseValueLevel === '中价值' ? 'orange' : 'default'} style={{ margin: 0 }}>
              {r.reuseValueLevel}
            </Tag>
          )}
          {r.aiCost && <Tag style={{ margin: 0 }}>Token 费用 {r.aiCost}</Tag>}
          {r.monthlySavedCost && <Tag color="green" style={{ margin: 0 }}>降本 {r.monthlySavedCost}</Tag>}
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
