'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Spin, App, Select, Tag, Table, type TableColumnsType } from 'antd';
import {
  BarChartOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  RiseOutlined,
  ThunderboltOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
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
  { value: 'efficiency', label: '提效比例' },
  { value: 'beforeHours', label: '原工时' },
  { value: 'people', label: '人数' },
];

const BAR_COLORS = ['#1a3a8a', '#2d5aa0', '#4a7fd4', '#7ba7e8', '#a8c8f0', '#c5daf5'];

// ─── Helpers ─────────────────────────────────────────────────────

/** 将频率文本 + 执行次数 → X次/月 */
function calcMonthlyFreq(freq: string | null, count: number | null): number | null {
  if (count != null && count > 0) {
    if (!freq) return count;
    if (freq.includes('每日') || freq.includes('daily')) return count * 22;
    if (freq.includes('每周') || freq.includes('weekly')) return count * 4;
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

function freqDisplay(freq: string | null, count: number | null): string {
  const monthly = calcMonthlyFreq(freq, count);
  if (monthly == null) return '—';
  return `${monthly}次/月`;
}

function num(v: number | null | undefined): string {
  if (v == null) return '—';
  return v % 1 === 0 ? String(v) : v.toFixed(1);
}

/**
 * 计算变化类型：null=无变化, 'up'=上升, 'down'=下降
 * isPositiveWhenUp: true → 上升为正面(节省工时), false → 上升为负面(人数/耗时)
 */
function changeType(
  oldVal: number | null | undefined,
  newVal: number | null | undefined,
  isPositiveWhenUp: boolean,
): 'up' | 'down' | null {
  if (oldVal == null || newVal == null || oldVal === 0) return null;
  if (Math.abs(newVal - oldVal) / Math.abs(oldVal) < 0.001) return null;
  const direction = newVal > oldVal ? 'up' : 'down';
  return direction;
}

// ─── Component ───────────────────────────────────────────────────

export default function ChoDashboardPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [period, setPeriod] = useState('2605');
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState('savedHours');

  useEffect(() => {
    if (!authLoading && !isAdmin) router.replace('/');
  }, [authLoading, isAdmin, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/competitions/overview?period=${period}`);
      if (!res.ok) throw new Error((await res.json()).error || '加载失败');
      const json: OverviewResponse = await res.json();
      setData(json);
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
      const res = await fetch(`/api/competitions/sync?period=${period}`, {
        method: 'POST',
        signal: controller.signal,
      });
      clearTimeout(timer);
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      message.success({ content: `已同步 ${result.synced} 条方案`, key: 'sync' });
      await fetchData();
    } catch (err) {
      const msg = err instanceof DOMException && err.name === 'AbortError'
        ? '同步超时，请稍后重续'
        : err instanceof Error ? err.message : '同步失败';
      message.error({ content: msg, key: 'sync' });
    } finally {
      setSyncing(false);
    }
  };

  // ── Enriched data ──
  const enriched = useMemo(() => {
    return (data?.submissions ?? []).map((s) => {
      const beforeMonthlyFreq = calcMonthlyFreq(s.oldFrequency, s.oldOperationCount);
      const afterMonthlyFreq = calcMonthlyFreq(s.newFrequency, s.newOperationCount);
      const beforeHours =
        s.beforeHoursPerPerson != null && s.beforePeopleCount != null
          ? Math.round(s.beforeHoursPerPerson * s.beforePeopleCount * 10) / 10
          : null;
      const afterHours =
        s.afterHoursPerPerson != null && s.afterPeopleCount != null
          ? Math.round(s.afterHoursPerPerson * s.afterPeopleCount * 10) / 10
          : null;
      const savedHours =
        s.monthlySavedHours ??
        (beforeHours != null && afterHours != null
          ? Math.round((beforeHours - afterHours) * 10) / 10
          : null);
      return { ...s, beforeMonthlyFreq, afterMonthlyFreq, beforeHours, afterHours, savedHours };
    });
  }, [data]);

  // ── Summary ──
  const summary = useMemo(() => {
    const totalPeople = enriched.reduce((sum, s) => sum + (s.beforePeopleCount ?? 0), 0);
    const totalBefore = enriched.reduce((sum, s) => sum + (s.beforeHours ?? 0), 0);
    const totalAfter = enriched.reduce((sum, s) => sum + (s.afterHours ?? 0), 0);
    const totalSaved = enriched.reduce((sum, s) => sum + (s.savedHours ?? 0), 0);
    const withEff = enriched.filter((s) => s.efficiencyRate != null);
    const avgEff =
      withEff.length > 0
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

  // ── Chart data ──
  const chartData = useMemo(() => {
    const byTeam: Record<string, { saved: number; before: number; after: number; count: number }> = {};
    for (const s of enriched) {
      const team = s.team || '未分类';
      if (!byTeam[team]) byTeam[team] = { saved: 0, before: 0, after: 0, count: 0 };
      byTeam[team].saved += s.savedHours ?? 0;
      byTeam[team].before += s.beforeHours ?? 0;
      byTeam[team].after += s.afterHours ?? 0;
      byTeam[team].count += 1;
    }
    return Object.entries(byTeam)
      .map(([team, v]) => ({
        team,
        saved: Math.round(v.saved * 10) / 10,
        before: Math.round(v.before * 10) / 10,
        after: Math.round(v.after * 10) / 10,
        efficiency: v.before > 0 ? Math.round(((v.before - v.after) / v.before) * 1000) / 10 : 0,
        count: v.count,
      }))
      .sort((a, b) => b.saved - a.saved);
  }, [enriched]);

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

  // ── Filtered & sorted ──
  const tableData = useMemo(() => {
    let list = enriched;
    if (teamFilter !== 'all') list = list.filter((s) => s.team === teamFilter);
    const sorted = [...list].sort((a, b) => {
      switch (sortBy) {
        case 'savedHours': return (b.savedHours ?? -1) - (a.savedHours ?? -1);
        case 'efficiency': return (b.efficiencyRate ?? -1) - (a.efficiencyRate ?? -1);
        case 'beforeHours': return (b.beforeHours ?? -1) - (a.beforeHours ?? -1);
        case 'people': return (b.beforePeopleCount ?? -1) - (a.beforePeopleCount ?? -1);
        default: return 0;
      }
    });
    return sorted.map((s, i) => ({ ...s, rank: i + 1 }));
  }, [enriched, teamFilter, sortBy]);

  // ── Cell renderer: value + optional change indicator ──
  const renderChangeCell = (
    oldVal: number | null | undefined,
    newVal: number | null | undefined,
    fmt: (v: number | null | undefined) => string,
    isPositiveWhenUp: boolean,
    unit?: string,
  ) => {
    const ct = changeType(oldVal, newVal, isPositiveWhenUp);
    if (!ct) {
      return (
        <span className="font-mono text-xs" style={{ color: 'var(--foreground)' }}>
          {fmt(newVal)}{unit && newVal != null ? unit : ''}
        </span>
      );
    }
    const isGood = (ct === 'up' && isPositiveWhenUp) || (ct === 'down' && !isPositiveWhenUp);
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium"
        style={{
          background: isGood ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.08)',
          color: isGood ? '#16a34a' : '#dc2626',
        }}
      >
        {fmt(newVal)}{unit && newVal != null ? unit : ''}
        <span className="text-[10px]">{ct === 'up' ? '↑' : '↓'}</span>
      </span>
    );
  };

  // ── Table columns ──
  const columns: TableColumnsType<typeof tableData[number]> = [
    // ── 基础信息 ──
    {
      title: '#',
      dataIndex: 'rank',
      key: 'rank',
      width: 40,
      align: 'center',
      fixed: 'left',
      className: 'cho-frozen-rank',
      render: (rank: number) => (
        <span className="text-xs font-bold" style={{ color: rank <= 3 ? '#d97706' : 'var(--text-muted)' }}>
          {rank}
        </span>
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 180,
      ellipsis: true,
      render: (title: string, record) => (
        <div>
          <div className="text-xs font-medium truncate" style={{ color: 'var(--foreground)' }}>{title}</div>
          <div className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{record.team || '—'}</div>
        </div>
      ),
    },

    // ── 改造前 ──
    {
      title: '改造前',
      key: 'before-group',
      className: 'cho-group-before',
      children: [
        {
          title: '执行人数',
          dataIndex: 'beforePeopleCount',
          key: 'beforePeople',
          width: 65,
          align: 'center',
          render: (v: number | null) => (
            <span className="font-mono text-xs" style={{ color: 'var(--foreground)' }}>{num(v)}{v != null ? '人' : ''}</span>
          ),
        },
        {
          title: '执行频次',
          dataIndex: 'beforeMonthlyFreq',
          key: 'beforeFreq',
          width: 72,
          align: 'center',
          render: (_: number | null, record) => (
            <span className="font-mono text-xs" style={{ color: 'var(--foreground)' }}>
              {freqDisplay(record.oldFrequency, record.oldOperationCount)}
            </span>
          ),
        },
        {
          title: '单次耗时',
          dataIndex: 'oldHoursPerTask',
          key: 'beforeDur',
          width: 65,
          align: 'center',
          render: (v: number | null) => (
            <span className="font-mono text-xs" style={{ color: 'var(--foreground)' }}>{num(v)}{v != null ? 'h' : ''}</span>
          ),
        },
        {
          title: '月总工时',
          dataIndex: 'beforeHours',
          key: 'beforeHours',
          width: 70,
          align: 'right',
          render: (v: number | null) => (
            <span className="font-mono text-xs font-medium" style={{ color: 'var(--foreground)' }}>{num(v)}{v != null ? 'h' : ''}</span>
          ),
        },
      ],
    },

    // ── 改造后 ──
    {
      title: '改造后',
      key: 'after-group',
      className: 'cho-group-after',
      children: [
        {
          title: '执行人数',
          dataIndex: 'afterPeopleCount',
          key: 'afterPeople',
          width: 65,
          align: 'center',
          render: (_: number | null, record) =>
            renderChangeCell(record.beforePeopleCount, record.afterPeopleCount, num, false, '人'),
        },
        {
          title: '执行频次',
          dataIndex: 'afterMonthlyFreq',
          key: 'afterFreq',
          width: 72,
          align: 'center',
          render: (_: number | null, record) =>
            renderChangeCell(record.beforeMonthlyFreq, record.afterMonthlyFreq, (v) => freqDisplay(null, v ?? null), true),
        },
        {
          title: '单次耗时',
          dataIndex: 'newDuration',
          key: 'afterDur',
          width: 65,
          align: 'center',
          render: (_: number | null, record) =>
            renderChangeCell(record.oldHoursPerTask, record.newDuration, num, false, 'h'),
        },
        {
          title: '月总工时',
          dataIndex: 'afterHours',
          key: 'afterHours',
          width: 70,
          align: 'right',
          render: (_: number | null, record) =>
            renderChangeCell(record.beforeHours, record.afterHours, num, false, 'h'),
        },
      ],
    },

    // ── 成效 ──
    {
      title: '成效',
      key: 'result-group',
      className: 'cho-group-result',
      children: [
        {
          title: '月均降本',
          dataIndex: 'monthlySavedCost',
          key: 'costSaved',
          width: 80,
          align: 'right',
          render: (v: string | null) => (
            <span className="font-mono text-xs font-medium" style={{ color: v ? '#16a34a' : 'var(--text-muted)' }}>
              {v || '—'}
            </span>
          ),
        },
        {
          title: '节省工时',
          dataIndex: 'savedHours',
          key: 'savedHours',
          width: 68,
          align: 'right',
          sorter: (a, b) => (a.savedHours ?? -1) - (b.savedHours ?? -1),
          defaultSortOrder: 'descend',
          render: (v: number | null) => (
            <span className="font-mono text-xs font-bold" style={{ color: v != null && v > 0 ? '#16a34a' : 'var(--text-muted)' }}>
              {num(v)}{v != null ? 'h' : ''}
            </span>
          ),
        },
        {
          title: '提效比例',
          dataIndex: 'efficiencyRate',
          key: 'efficiency',
          width: 68,
          align: 'right',
          sorter: (a, b) => (a.efficiencyRate ?? -1) - (b.efficiencyRate ?? -1),
          render: (v: number | null) => (
            <span className="font-mono text-xs font-medium" style={{ color: v != null && v > 0 ? '#16a34a' : 'var(--text-muted)' }}>
              {v != null ? `${v}%` : '—'}
            </span>
          ),
        },
        {
          title: '复用工时',
          dataIndex: 'reuseValue',
          key: 'reuse',
          width: 75,
          align: 'center',
          render: (v: string | null, record) => {
            if (!v) return <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>;
            const match = v.match(/[×xX]\s*(\d+(?:\.\d+)?)/);
            const multiplier = match ? parseFloat(match[1]) : null;
            const level = record.reuseValueLevel;
            const bg = level === '高价值' ? 'rgba(22,163,74,0.1)' : level === '中价值' ? 'rgba(217,119,6,0.08)' : 'rgba(0,0,0,0.04)';
            const fg = level === '高价值' ? '#16a34a' : level === '中价值' ? '#d97706' : 'var(--text-secondary)';
            return (
              <span
                className="inline-block rounded-md px-1.5 py-0.5 text-[11px] font-medium"
                style={{ background: bg, color: fg }}
                title={v}
              >
                {multiplier ? `×${multiplier}` : v.length > 6 ? v.slice(0, 6) + '…' : v}
              </span>
            );
          },
        },
        {
          title: 'Token 费用',
          dataIndex: 'aiCost',
          key: 'tokenCost',
          width: 70,
          align: 'right',
          render: (v: string | null) => (
            <span className="font-mono text-xs" style={{ color: v ? 'var(--foreground)' : 'var(--text-muted)' }}>
              {v || '—'}
            </span>
          ),
        },
      ],
    },
  ];

  // ── Guard ──
  if (authLoading) {
    return <div className="flex justify-center items-center min-h-[60vh]"><Spin size="large" /></div>;
  }
  if (!isAdmin) return null;

  return (
    <>
      <style jsx global>{`
        .cho-frozen-rank {
          position: sticky !important;
          left: 0 !important;
          z-index: 3 !important;
          background: rgba(255, 255, 255, 0.92) !important;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .cho-frozen-rank::after {
          content: '';
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          width: 3px;
          background: linear-gradient(to right, rgba(0,0,0,0.06), transparent);
          pointer-events: none;
        }
        .cho-group-before > .ant-table-cell {
          background: rgba(251, 191, 36, 0.04) !important;
        }
        .cho-group-after > .ant-table-cell {
          background: rgba(22, 163, 74, 0.04) !important;
        }
        .cho-group-result > .ant-table-cell {
          background: rgba(26, 58, 138, 0.03) !important;
        }
        .cho-table-row td {
          border-bottom: 1px solid rgba(0, 0, 0, 0.04) !important;
          padding: 6px 8px !important;
        }
        .cho-table-row:hover td {
          background: rgba(26, 58, 138, 0.03) !important;
        }
        .ant-table-thead > tr > th {
          padding: 6px 8px !important;
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
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>改造前后对比 · 一目了然</p>
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
            <StatCard icon={<RiseOutlined />} label="节省工时" value={summary.totalSaved > 0 ? `${summary.totalSaved}h` : '—'} sub={summary.avgEfficiency != null ? `平均提效 ${summary.avgEfficiency}%` : '月均合计'} color="#16a34a" highlight />
          </div>
        </div>

        {/* 图表区域 */}
        {chartData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
            <div className="glass rounded-2xl p-5" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
              <div className="text-xs font-semibold mb-3 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                <RiseOutlined /> 节省工时 · 按部门
              </div>
              <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 36 + 40)}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#666' }} />
                  <YAxis dataKey="team" type="category" tick={{ fontSize: 11, fill: '#333' }} width={80} />
                  <Tooltip
                    formatter={(value) => [`${value}h`, '节省工时']}
                    contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="saved" radius={[0, 6, 6, 0]} maxBarSize={28}>
                    {chartData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="glass rounded-2xl p-5" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
              <div className="text-xs font-semibold mb-3 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                <ThunderboltOutlined /> 提效比例 · 按部门
              </div>
              <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 36 + 40)}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#666' }} tickFormatter={(v) => `${v}%`} />
                  <YAxis dataKey="team" type="category" tick={{ fontSize: 11, fill: '#333' }} width={80} />
                  <Tooltip
                    formatter={(value) => [`${value}%`, '提效比例']}
                    contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="efficiency" radius={[0, 6, 6, 0]} maxBarSize={28}>
                    {chartData.map((_, i) => <Cell key={i} fill={BAR_COLORS[(i + 2) % BAR_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 筛选 + 排序 */}
        <div className="glass rounded-xl px-4 py-3 mb-4" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
              <TeamOutlined /> 部门
            </span>
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
          <div className="glass rounded-2xl overflow-hidden" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
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
          <span className="font-semibold">绿色高亮</span> = 改造后数值改善 ·
          <span className="font-semibold"> 红色高亮</span> = 数值增加需关注 ·
          <span className="font-semibold"> 频次</span>统一折算为次/月 ·
          <span className="font-semibold"> ↑↓</span>箭头表示变化方向
        </div>
      </div>
    </>
  );
}

// ─── Sub-components ──────────────────────────────────────────────

function StatCard({
  icon, label, value, sub, color, highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
  highlight?: boolean;
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
