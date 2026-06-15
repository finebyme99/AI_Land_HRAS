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
  // 量化
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
  // 详情
  sceneCategory: string;
  aiTools: string[];
  beforeProcess: string;
  afterProcess: string;
  extraValue: string;
  reuseValue: string | null;
  reuseValueLevel: string | null;
  monthlySavedCost: string | null;
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
  { value: 'frequency', label: '频率' },
];

const BAR_COLORS = ['#1a3a8a', '#2d5aa0', '#4a7fd4', '#7ba7e8', '#a8c8f0', '#c5daf5'];

// ─── Helpers ─────────────────────────────────────────────────────

function parseFrequencyHours(freq: string | null, count: number | null): number | null {
  if (!freq || count == null) return null;
  // 尝试提取频率中的次数（如 "每周x次" → x=count）
  const match = freq.match(/(\d+(?:\.\d+)?)/);
  const times = match ? parseFloat(match[1]) : 1;
  // 粗略估算月工时：假设每月 4 周
  if (freq.includes('每周') || freq.includes('weekly')) return count * times * 4;
  if (freq.includes('每日') || freq.includes('daily')) return count * times * 22;
  if (freq.includes('每月') || freq.includes('monthly')) return count * times;
  if (freq.includes('每季') || freq.includes('quarterly')) return count * times / 3;
  return null;
}

function formatFrequency(freq: string | null, count: number | null): string {
  if (!freq) return '—';
  if (count == null) return freq;
  return freq.replace(/x/gi, String(count));
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

  // ── Auth guard ──
  useEffect(() => {
    if (!authLoading && !isAdmin) router.replace('/');
  }, [authLoading, isAdmin, router]);

  // ── Data fetch ──
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

  // ── Sync handler ──
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

  // ── Derived data ──
  const enriched = useMemo(() => {
    return (data?.submissions ?? []).map((s) => {
      // 原月工时 = 人均工时 × 人数
      const beforeHours = (s.beforeHoursPerPerson != null && s.beforePeopleCount != null)
        ? Math.round(s.beforeHoursPerPerson * s.beforePeopleCount * 10) / 10
        : null;
      // AI后月工时
      const afterHours = (s.afterHoursPerPerson != null && s.afterPeopleCount != null)
        ? Math.round(s.afterHoursPerPerson * s.afterPeopleCount * 10) / 10
        : null;
      // 节省工时：优先用 monthlySavedHours，否则用差值
      const savedHours = s.monthlySavedHours ?? (
        (beforeHours != null && afterHours != null)
          ? Math.round((beforeHours - afterHours) * 10) / 10
          : null
      );
      // 频率文本
      const frequencyDisplay = formatFrequency(s.oldFrequency, s.oldOperationCount);
      return {
        ...s,
        beforeHours,
        afterHours,
        savedHours,
        frequencyDisplay,
      };
    });
  }, [data]);

  // ── Summary stats ──
  const summary = useMemo(() => {
    const totalPeople = enriched.reduce((sum, s) => sum + (s.beforePeopleCount ?? 0), 0);
    const totalBeforeHours = enriched.reduce((sum, s) => sum + (s.beforeHours ?? 0), 0);
    const totalAfterHours = enriched.reduce((sum, s) => sum + (s.afterHours ?? 0), 0);
    const totalSaved = enriched.reduce((sum, s) => sum + (s.savedHours ?? 0), 0);
    const avgEff = enriched.filter((s) => s.efficiencyRate != null).length > 0
      ? enriched.filter((s) => s.efficiencyRate != null).reduce((sum, s) => sum + (s.efficiencyRate ?? 0), 0) / enriched.filter((s) => s.efficiencyRate != null).length
      : null;
    return {
      count: enriched.length,
      totalPeople,
      totalBeforeHours: Math.round(totalBeforeHours * 10) / 10,
      totalAfterHours: Math.round(totalAfterHours * 10) / 10,
      totalSaved: Math.round(totalSaved * 10) / 10,
      avgEfficiency: avgEff != null ? Math.round(avgEff * 1000) / 10 : null,
    };
  }, [enriched]);

  // ── Chart data: by department ──
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

  // ── Teams for filter ──
  const teams = useMemo(() => {
    const set = new Set<string>();
    enriched.forEach((s) => s.team && set.add(s.team));
    return Array.from(set).sort();
  }, [enriched]);

  const teamCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    enriched.forEach((s) => {
      if (s.team) counts[s.team] = (counts[s.team] ?? 0) + 1;
    });
    return counts;
  }, [enriched]);

  // ── Filtered & sorted table data ──
  const tableData = useMemo(() => {
    let list = enriched;
    if (teamFilter !== 'all') list = list.filter((s) => s.team === teamFilter);

    const sorted = [...list].sort((a, b) => {
      switch (sortBy) {
        case 'savedHours': return (b.savedHours ?? -1) - (a.savedHours ?? -1);
        case 'efficiency': return (b.efficiencyRate ?? -1) - (a.efficiencyRate ?? -1);
        case 'beforeHours': return (b.beforeHours ?? -1) - (a.beforeHours ?? -1);
        case 'people': return (b.beforePeopleCount ?? -1) - (a.beforePeopleCount ?? -1);
        case 'frequency': return (b.oldFrequency ?? '').localeCompare(a.oldFrequency ?? '');
        default: return 0;
      }
    });
    return sorted.map((s, i) => ({ ...s, rank: i + 1 }));
  }, [enriched, teamFilter, sortBy]);

  // ── Table columns ──
  const columns: TableColumnsType<typeof tableData[number]> = [
    {
      title: '#',
      dataIndex: 'rank',
      key: 'rank',
      width: 48,
      align: 'center',
      render: (rank: number) => (
        <span className="font-bold text-sm" style={{ color: rank <= 3 ? '#d97706' : 'var(--text-muted)' }}>
          {rank}
        </span>
      ),
    },
    {
      title: '事情',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (title: string, record) => (
        <div>
          <div className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>{title}</div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{record.sceneCategory || record.authorName}</div>
        </div>
      ),
    },
    {
      title: '原工时',
      dataIndex: 'beforeHours',
      key: 'beforeHours',
      width: 90,
      align: 'right',
      render: (v: number | null) => (
        <span className="font-mono text-sm" style={{ color: 'var(--foreground)' }}>
          {v != null ? `${v}h` : '—'}
        </span>
      ),
    },
    {
      title: '频率',
      dataIndex: 'frequencyDisplay',
      key: 'frequency',
      width: 100,
      render: (v: string) => (
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{v}</span>
      ),
    },
    {
      title: '人数',
      dataIndex: 'beforePeopleCount',
      key: 'people',
      width: 60,
      align: 'center',
      render: (v: number | null) => (
        <span className="font-mono text-sm" style={{ color: 'var(--foreground)' }}>
          {v != null ? `${v}` : '—'}
        </span>
      ),
    },
    {
      title: '部门',
      dataIndex: 'team',
      key: 'team',
      width: 100,
      render: (team: string) => team ? <Tag color="blue" style={{ margin: 0 }}>{team}</Tag> : '—',
    },
    {
      title: 'AI 后',
      dataIndex: 'afterHours',
      key: 'afterHours',
      width: 80,
      align: 'right',
      render: (v: number | null) => (
        <span className="font-mono text-sm" style={{ color: '#16a34a' }}>
          {v != null ? `${v}h` : '—'}
        </span>
      ),
    },
    {
      title: '节省',
      dataIndex: 'savedHours',
      key: 'savedHours',
      width: 80,
      align: 'right',
      sorter: (a, b) => (a.savedHours ?? -1) - (b.savedHours ?? -1),
      defaultSortOrder: 'descend',
      render: (v: number | null) => (
        <span className="font-mono text-sm font-bold" style={{ color: '#16a34a' }}>
          {v != null ? `${v}h` : '—'}
        </span>
      ),
    },
  ];

  // ── Expanded row render ──
  const expandedRowRender = (record: typeof tableData[number]) => {
    const formatFreq = (freq: string | null, count: number | null) => formatFrequency(freq, count);
    return (
      <div className="px-4 py-3 space-y-3 text-sm" style={{ background: 'rgba(255,255,255,0.3)' }}>
        {/* 量化对比 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>人均工时</div>
            <div className="font-mono">
              {record.beforeHoursPerPerson != null ? `${record.beforeHoursPerPerson}h` : '—'}
              <span style={{ color: 'var(--text-muted)' }}> → </span>
              <span style={{ color: '#16a34a' }}>{record.afterHoursPerPerson != null ? `${record.afterHoursPerPerson}h` : '—'}</span>
            </div>
          </div>
          <div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>执行人数</div>
            <div className="font-mono">
              {record.beforePeopleCount != null ? `${record.beforePeopleCount}人` : '—'}
              <span style={{ color: 'var(--text-muted)' }}> → </span>
              <span style={{ color: '#16a34a' }}>{record.afterPeopleCount != null ? `${record.afterPeopleCount}人` : '—'}</span>
            </div>
          </div>
          <div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>单次耗时</div>
            <div className="font-mono">
              {record.oldHoursPerTask != null ? `${record.oldHoursPerTask}h` : '—'}
              <span style={{ color: 'var(--text-muted)' }}> → </span>
              <span style={{ color: '#16a34a' }}>{record.newDuration != null ? `${record.newDuration}h` : '—'}</span>
            </div>
          </div>
          <div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>频次</div>
            <div>
              {formatFreq(record.oldFrequency, record.oldOperationCount)}
              <span style={{ color: 'var(--text-muted)' }}> → </span>
              <span style={{ color: '#16a34a' }}>{formatFreq(record.newFrequency, record.newOperationCount)}</span>
            </div>
          </div>
        </div>
        {/* AI 工具 + 降本 */}
        <div className="flex flex-wrap gap-2">
          {record.aiTools.map((t) => (
            <Tag key={t} color="geekblue" style={{ margin: 0, fontSize: 11 }}>{t}</Tag>
          ))}
          {record.reuseValue && <Tag color="gold" style={{ margin: 0, fontSize: 11 }}>{record.reuseValue}</Tag>}
          {record.monthlySavedCost && <Tag color="green" style={{ margin: 0, fontSize: 11 }}>降本 {record.monthlySavedCost}</Tag>}
        </div>
        {/* 前后流程摘要 */}
        {record.beforeProcess && (
          <div className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            <span className="font-semibold" style={{ color: 'var(--text-muted)' }}>原流程：</span>
            {record.beforeProcess.length > 150 ? record.beforeProcess.slice(0, 150) + '…' : record.beforeProcess}
          </div>
        )}
        {record.afterProcess && (
          <div className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            <span className="font-semibold" style={{ color: '#16a34a' }}>AI 后：</span>
            {record.afterProcess.length > 150 ? record.afterProcess.slice(0, 150) + '…' : record.afterProcess}
          </div>
        )}
      </div>
    );
  };

  // ── Guard ──
  if (authLoading) {
    return <div className="flex justify-center items-center min-h-[60vh]"><Spin size="large" /></div>;
  }
  if (!isAdmin) return null;

  // ── Render ──
  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #16a34a, #0891b2)', color: '#fff' }}>
            <BarChartOutlined />
          </span>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>AI 落地成效总览</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>人力投入产出 · 一眼看清</p>
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
          <Select
            value={period}
            onChange={setPeriod}
            options={PERIOD_OPTIONS}
            style={{ width: 150 }}
            size="middle"
          />
        </div>
      </div>

      {/* 顶部统计 */}
      <div className="glass rounded-2xl p-5 mb-5" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatCard
            icon={<BarChartOutlined />}
            label="方案数"
            value={String(summary.count)}
            color="var(--primary)"
          />
          <StatCard
            icon={<TeamOutlined />}
            label="覆盖人数"
            value={summary.totalPeople > 0 ? `${summary.totalPeople}` : '—'}
            sub="执行人数合计"
            color="#0891b2"
          />
          <StatCard
            icon={<ClockCircleOutlined />}
            label="原总工时"
            value={summary.totalBeforeHours > 0 ? `${summary.totalBeforeHours}h` : '—'}
            sub="月均合计"
            color="#d97706"
          />
          <StatCard
            icon={<ThunderboltOutlined />}
            label="AI 后工时"
            value={summary.totalAfterHours > 0 ? `${summary.totalAfterHours}h` : '—'}
            sub="月均合计"
            color="#7c3aed"
          />
          <StatCard
            icon={<RiseOutlined />}
            label="节省工时"
            value={summary.totalSaved > 0 ? `${summary.totalSaved}h` : '—'}
            sub={summary.avgEfficiency != null ? `平均提效 ${summary.avgEfficiency}%` : '月均合计'}
            color="#16a34a"
            highlight
          />
        </div>
      </div>

      {/* 图表区域 */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
          {/* 节省工时 · 按部门 */}
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
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 提效比例 · 按部门 */}
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
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[(i + 2) % BAR_COLORS.length]} />
                  ))}
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
            expandable={{
              expandedRowRender,
              rowExpandable: (record) => !!(record.beforeProcess || record.afterProcess || record.aiTools.length > 0),
            }}
            size="middle"
            scroll={{ x: 700 }}
            rowClassName={() => 'cho-table-row'}
          />
        </div>
      )}

      {/* 底部说明 */}
      <div className="mt-4 text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        <span className="font-semibold">原工时</span> = 人均工时 × 执行人数 ·
        <span className="font-semibold"> AI 后</span> = AI 后人均工时 × AI 后人数 ·
        <span className="font-semibold"> 节省</span> = 月均提效节省工时（优先）或 原工时 - AI 后工时
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
  highlight,
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
