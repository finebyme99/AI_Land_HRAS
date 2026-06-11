'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Spin, App, Select, Tag } from 'antd';
import {
  TrophyOutlined,
  AuditOutlined,
  TeamOutlined,
  ArrowRightOutlined,
  SyncOutlined,
  ClockCircleOutlined,
  RiseOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/lib/auth-context';
import HighlightSweep from '@/components/HighlightSweep';

type Role = 'user' | 'business' | 'tech';

interface ReviewDTO {
  id: string;
  reviewerName: string;
  reviewerRole: Role | null;
  decision: string;
  scores: Record<string, number>;
  weightedScore: number;
  reason: string;
}

interface SubmissionDTO {
  id: string;
  title: string;
  team: string;
  authorName: string;
  contributors: string[];
  proposalNo: number | null;
  submittedAt: string;
  status: 'reviewed' | 'pending';
  totalScore: number | null;
  reviewCount: number;
  roleScores: Record<Role, number | null>;
  reviews: ReviewDTO[];
  // 方案详情（弹窗用）
  track: string;
  sceneCategory: string;
  aiTools: string[];
  monthlySavedHours: number | null;
  efficiencyRate: number | null;
  beforeProcess: string;
  painPoints: string[];
  afterProcess: string;
  demoLink: string;
  recordUrl: string;
  aiCost: string;
  extraValue: string;
  teamMembers: string;
  implementation: string;
  verifier: string;
  reuseValue: string | null;
  reuseValueLevel: string | null;
  monthlySavedCost: string | null;
  costReductionNote: string | null;
  implementationLink: string | null;
  finalValueScore: number | null;
  // 量化对比
  beforeHoursPerPerson: number | null;
  beforePeopleCount: number | null;
  afterHoursPerPerson: number | null;
  afterPeopleCount: number | null;
  oldOperationCount: number | null;
  newOperationCount: number | null;
  oldHoursPerTask: number | null;
  newDuration: number | null;
  oldPeopleCount: number | null;
  newPeopleCount: number | null;
  oldFrequency: string | null;
  newFrequency: string | null;
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
  submissions: SubmissionDTO[];
  panel: Record<Role, string[]>;
}

const PERIOD_OPTIONS = [
  { value: '2605', label: '5 月 (2605)' },
  { value: '2606', label: '6 月 (2606)' },
  { value: '2604', label: '4 月 (2604)' },
  { value: '2603', label: '3 月 (2603)' },
];

const ROLE_LABEL: Record<Role, string> = {
  user: '用户评委',
  business: '业务评委',
  tech: '技术评委',
};

const ROLE_COLOR: Record<Role, string> = {
  user: 'blue',
  business: 'orange',
  tech: 'purple',
};

const ROLE_DIM_LABEL: Record<string, string> = {
  productEffectiveness: '产品实用性',
  dataConsistency: '数据一致性',
  productUsability: '产品易用性',
  replicability: '可复用性',
  dataReliability: '数据详实度',
  breakthrough: '突破开创性',
  techDepth: '技术实现深度',
  engineeringQuality: '工程质量与可落地性',
};

const TOTAL_MAX = 100;

/** Aily 行政服务台 硬编码量化数据（按 legacy id 识别）— 机器人拦截率指标 */
const SERVICE_DESK_ID = 'rec27rTLkjFk0J';
const SERVICE_DESK_METRICS = {
  period: '23 天',
  interceptBefore: '70.29%',
  interceptAfter: '78.17%',
  growth: '11.21%',
};

export default function ReviewsOverviewPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [period, setPeriod] = useState('2605');
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [reuseValueFilter, setReuseValueFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('finalValueScore');
  const [modalSub, setModalSub] = useState<SubmissionDTO | null>(null);
  const [detailSub, setDetailSub] = useState<SubmissionDTO | null>(null);

  const SORT_OPTIONS = [
    { value: 'finalValueScore', label: '最终价值计分' },
    { value: 'reuseValue', label: '可复用范围' },
    { value: 'monthlySavedHours', label: '月省工时' },
    { value: 'efficiencyRate', label: '提效比例' },
    { value: 'totalScore', label: '评审得分' },
  ];

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

  // 从飞书同步
  const [syncing, setSyncing] = useState(false);
  const handleSync = async () => {
    setSyncing(true);
    message.loading({ content: '正在从飞书同步，附件较多时可能需要几分钟…', key: 'sync', duration: 0 });
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5 * 60 * 1000);
      const res = await fetch(`/api/competitions/sync?period=${period}`, {
        method: 'POST',
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const attMsg = data.attachments
        ? `（附件：${data.attachments.downloaded} 新下载，${data.attachments.skipped} 已跳过）`
        : '';
      message.success({ content: `已同步 ${data.synced} 条方案${attMsg}`, key: 'sync' });
      await fetchData();
    } catch (err) {
      const msg = err instanceof DOMException && err.name === 'AbortError'
        ? '同步超时，请稍后重试'
        : err instanceof Error ? err.message : '同步失败';
      message.error({ content: msg, key: 'sync' });
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => { if (isAdmin) fetchData(); }, [isAdmin, fetchData]);

  const teams = useMemo(() => {
    const set = new Set<string>();
    (data?.submissions ?? []).forEach((s) => s.team && set.add(s.team));
    return Array.from(set).sort();
  }, [data]);

  // 团队计数（用于 pill 显示数量）
  const teamCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (data?.submissions ?? []).forEach((s) => {
      if (s.team) {
        counts[s.team] = (counts[s.team] ?? 0) + 1;
      }
    });
    return counts;
  }, [data]);

  // 可复用范围 + 各范围计数
  const reuseValues = useMemo(() => {
    const counts: Record<string, number> = {};
    (data?.submissions ?? []).forEach((s) => {
      if (s.reuseValue) counts[s.reuseValue] = (counts[s.reuseValue] ?? 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, count }));
  }, [data]);

  // 计算预估月省工时 = 月省工时 × x 系数（系数从 reuse_value 字符串 regex 提取）
  const calcEstimatedHours = (s: SubmissionDTO): number | null => {
    if (s.monthlySavedHours == null) return null;
    const match = s.reuseValue?.match(/x(\d+(?:\.\d+)?)/i);
    const coef = match ? parseFloat(match[1]) : 0;
    if (!coef) return null;
    return Math.round(s.monthlySavedHours * coef * 10) / 10;
  };

  // 排序比较器
  const sortComparator = useCallback((a: SubmissionDTO, b: SubmissionDTO): number => {
    if (sortBy === 'reuseValue') {
      // 可复用范围：按 reuseValueLevel 金>银>铜，再按 reuseValue 文本
      const levelOrder: Record<string, number> = { '金': 3, '银': 2, '铜': 1 };
      const la = levelOrder[a.reuseValueLevel ?? ''] ?? 0;
      const lb = levelOrder[b.reuseValueLevel ?? ''] ?? 0;
      if (la !== lb) return lb - la;
      return (b.reuseValue ?? '').localeCompare(a.reuseValue ?? '');
    }
    // 数值字段：降序，null 排最后
    const va = (a as unknown as Record<string, number | null>)[sortBy] ?? null;
    const vb = (b as unknown as Record<string, number | null>)[sortBy] ?? null;
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return vb - va;
  }, [sortBy]);

  const visibleSubs = useMemo(() => {
    let list = data?.submissions ?? [];
    // 评审未开始的方案不展示卡片（totalScore=null 或 reviewCount=0）
    list = list.filter((s) => s.totalScore != null && s.reviewCount > 0);
    if (teamFilter !== 'all') list = list.filter((s) => s.team === teamFilter);
    if (reuseValueFilter !== 'all') list = list.filter((s) => s.reuseValue === reuseValueFilter);
    // 按用户选择排序
    const sorted = [...list].sort(sortComparator);
    // 排名始终按最终价值计分（全数据，不受筛选影响）
    const allSorted = (data?.submissions ?? [])
      .filter((s) => s.totalScore != null && s.reviewCount > 0)
      .sort((a, b) => (b.finalValueScore ?? -1) - (a.finalValueScore ?? -1));
    const rankMap = new Map<string, number>();
    allSorted.forEach((s, i) => rankMap.set(s.id, i + 1));
    return sorted.map((s) => ({ ...s, rank: rankMap.get(s.id) ?? 0 }));
  }, [data, teamFilter, reuseValueFilter, sortComparator]);

  // Top 5 最终价值计分
  const topByValue = useMemo(() => {
    return [...(data?.submissions ?? [])]
      .filter((s) => s.finalValueScore != null && s.finalValueScore > 0)
      .sort((a, b) => (b.finalValueScore ?? 0) - (a.finalValueScore ?? 0))
      .slice(0, 5);
  }, [data]);

  const totalEstimatedHours = useMemo(() => {
    return Math.round(
      (data?.submissions ?? []).reduce((sum, s) => sum + (calcEstimatedHours(s) ?? 0), 0) * 10,
    ) / 10;
  }, [data]);

  if (authLoading) {
    return <div className="flex justify-center items-center min-h-[60vh]"><Spin size="large" /></div>;
  }
  if (!isAdmin) return null;

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* 标题 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0F2057, #1a3a8a)', color: '#fff' }}>
            <AuditOutlined />
          </span>
          <HighlightSweep text="HRAS AI 大赛 · 评审一览" className="text-2xl font-bold" gradient="linear-gradient(135deg, #0F2057 0%, #1a3a8a 50%, #2d5aa0 100%)" />
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
            style={{ width: 160 }}
            size="middle"
          />
        </div>
      </div>

      {/* 顶部总卡片 */}
      {data && (
        <div className="glass rounded-2xl p-5 mb-4" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
            <StatBox
              icon={<TrophyOutlined />}
              label="参赛方案"
              value={String(data.summary.total)}
              sub={`已评 ${data.summary.reviewed} / 未评 ${data.summary.pending}`}
              color="var(--primary)"
            />
            <StatBox
              icon={<ClockCircleOutlined />}
              label="总节省工时"
              value={`${data.summary.totalSavedHours}h`}
              sub="月均合计"
              color="#16a34a"
            />
            <StatBox
              icon={<RiseOutlined />}
              label="总推广预估"
              value={`${totalEstimatedHours}h`}
              sub="月省工时 × 系数"
              color="#0891b2"
            />
            <StatBox
              icon={<ThunderboltOutlined />}
              label="平均提效率"
              value={data.summary.avgEfficiencyRate != null ? `${(data.summary.avgEfficiencyRate * 100).toFixed(1)}%` : '—'}
              sub="所有方案均值"
              color="#d97706"
            />
            <StatBox
              icon={<RiseOutlined />}
              label="平均得分"
              value={data.summary.avgScore != null ? `${data.summary.avgScore.toFixed(1)}` : '—'}
              sub={`/ ${TOTAL_MAX} · 100 制`}
              color="#7c3aed"
            />
          </div>

          {/* 最终价值计分 Top 5 */}
          {topByValue.length > 0 && (
            <div>
              <div className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                <TrophyOutlined /> 最终价值计分 Top 5
              </div>
              <div className="space-y-1.5">
                {topByValue.map((s, i) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 px-3 py-1.5 rounded-lg text-xs"
                    style={{ background: i === 0 ? 'rgba(255,215,0,0.08)' : i === 1 ? 'rgba(192,192,192,0.08)' : i === 2 ? 'rgba(205,127,50,0.08)' : 'rgba(0,0,0,0.02)' }}
                  >
                    <span className="w-5 text-center font-bold" style={{ color: i < 3 ? '#d97706' : 'var(--text-muted)' }}>
                      {i + 1}
                    </span>
                    <span className="flex-1 truncate font-medium" style={{ color: 'var(--foreground)' }}>
                      {s.title}
                    </span>
                    <span className="font-mono font-semibold" style={{ color: '#7c3aed' }}>
                      {s.finalValueScore?.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 价值计分公式 */}
          <div className="mt-3 pt-3 text-[11px] leading-relaxed space-y-1" style={{ borderTop: '1px solid rgba(0,0,0,0.05)', color: 'var(--text-muted)' }}>
            <div><span className="font-semibold">价值计分公式：</span>(月均提效节省工时 + 月均降本节省工时) x 国内/海外人力成本系数值 x 推广复用价值系数值</div>
            <div><span className="font-semibold">国内/海外人力成本系数值：</span>Deepseek 基于全球 HR 人力成本水平给出的系数建议：国内 x1，海外 x2，全球 x1.5</div>
            <div>
              <span className="font-semibold">推广复用价值系数：</span>
              个人/单个部门可用 x1 / BU下/条线下跨多个部门可用 x2 / 跨多个BU/多个条线可用 x3 / 全集团全球员工可用 x4
            </div>
          </div>
        </div>
      )}

      {/* 筛选条 */}
      <div className="glass rounded-xl px-4 py-3 mb-4"
        style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
            <TeamOutlined /> 团队
          </span>
          {[{ value: 'all', label: '全部', count: data?.submissions.length ?? 0 }, ...teams.map((t) => ({ value: t, label: t, count: teamCounts[t] ?? 0 }))].map((opt) => (
            <FilterPill key={opt.value} active={teamFilter === opt.value} label={opt.label} count={opt.count} onClick={() => setTeamFilter(opt.value)} />
          ))}
        </div>
        {reuseValues.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 mt-2.5 pt-2.5" style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
            <span className="text-xs font-semibold flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
              可复用范围
            </span>
            {[{ value: 'all', label: '全部', count: data?.submissions.length ?? 0 }, ...reuseValues.map((r) => ({ value: r.value, label: r.value, count: r.count }))].map((opt) => (
              <FilterPill key={opt.value} active={reuseValueFilter === opt.value} label={opt.label} count={opt.count} onClick={() => setReuseValueFilter(opt.value)} />
            ))}
          </div>
        )}
      </div>

      {/* 排序条 */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>排序</span>
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setSortBy(opt.value)}
            className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-all"
            style={{
              background: sortBy === opt.value ? 'var(--primary)' : 'rgba(0,0,0,0.04)',
              color: sortBy === opt.value ? '#fff' : 'var(--text-secondary)',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 卡片网格 */}
      {loading ? (
        <div className="flex justify-center py-16"><Spin size="large" /></div>
      ) : visibleSubs.length === 0 ? (
        <div className="text-center py-16 glass rounded-[20px]" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>该期暂无方案</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" style={{ gridAutoRows: '1fr' }}>
          {visibleSubs.map((sub) => (
            <div key={sub.id} className="glass rounded-[20px] overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md relative flex flex-col"
              style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
              <RankBadge rank={sub.rank} />

              {/* 头部 */}
              <div className="p-5 pb-3">
                <h3 className="text-sm font-semibold mb-2 pl-12 leading-snug truncate" style={{ color: 'var(--foreground)' }}>
                  {sub.title}
                </h3>
                <div className="flex flex-wrap items-center gap-1.5 pl-12">
                  {sub.team && <Tag color="blue" style={{ margin: 0 }}>{sub.team}</Tag>}
                  {sub.sceneCategory && <Tag color="cyan" style={{ margin: 0, fontSize: 10 }}>{sub.sceneCategory}</Tag>}
                  {sub.extraValue && <Tag color="green" style={{ margin: 0, fontSize: 10 }}>{sub.extraValue}</Tag>}
                </div>
                <p className="text-[11px] pl-12 mt-1" style={{ color: 'var(--text-muted)' }}>
                  {sub.authorName}
                </p>
              </div>

              {/* 一、量化数据 */}
              <div className="px-5 py-3 flex-1" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                <div className="text-[10px] font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  一、量化数据{sub.id === SERVICE_DESK_ID ? ' · 机器人拦截率' : ''}
                </div>
                {sub.id === SERVICE_DESK_ID ? (
                  <div className="space-y-1.5">
                    <MetricMini label="拦截率(接入后)" value={SERVICE_DESK_METRICS.interceptAfter} highlight size="lg" layout="row" />
                    <MetricMini label={`拦截率(接入前)·${SERVICE_DESK_METRICS.period}`} value={SERVICE_DESK_METRICS.interceptBefore} size="lg" layout="row" />
                    <MetricMini label="环比增长" value={SERVICE_DESK_METRICS.growth} highlight size="lg" layout="row" />
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <MetricMini label="月省工时" value={sub.monthlySavedHours != null ? `${sub.monthlySavedHours.toFixed(1)}h` : '—'} highlight size="lg" />
                      <MetricMini label="提效比例" value={sub.efficiencyRate != null ? `${(sub.efficiencyRate * 100).toFixed(0)}%` : '—'} highlight size="lg" />
                      <MetricMini label="Token费/月" value={sub.aiCost ? `¥${sub.aiCost}` : '—'} size="lg" />
                    </div>
                    <QuantGrid3x2 sub={sub} />
                    <BeforeAfterMini sub={sub} />
                  </>
                )}
              </div>

              {/* 二、复用价值 */}
              <ReuseHeroStrip level={sub.reuseValueLevel} fullText={sub.reuseValue} />

              {/* 三、评审得分 */}
              <div className="px-5 py-2" style={{ borderTop: '1px solid rgba(0,0,0,0.05)', background: 'rgba(0,0,0,0.01)' }}>
                <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  <span>三、评审得分</span>
                  <span className="font-bold text-sm" style={{ color: 'var(--primary)' }}>
                    {sub.totalScore != null ? sub.totalScore.toFixed(1) : '—'}
                  </span>
                  <span>/ {TOTAL_MAX}</span>
                  <span className="ml-auto">{sub.reviewCount} 人评</span>
                </div>
              </div>

              {/* 四、最终价值计分 */}
              <div className="px-5 py-2" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  <span>四、最终价值计分</span>
                  <span className="font-bold text-sm font-mono" style={{ color: '#7c3aed' }}>
                    {sub.finalValueScore != null ? sub.finalValueScore.toFixed(1) : '—'}
                  </span>
                </div>
              </div>

              {/* 方案详情按钮 */}
              <div className="px-5 py-2.5 mt-auto" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                <button
                  onClick={() => setDetailSub(sub)}
                  className="w-full flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90"
                  style={{ background: 'var(--primary)', color: '#fff' }}
                >
                  方案详情 <ArrowRightOutlined />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 评委团 footer */}
      {data && data.panel && (
        <div className="mt-8 pt-6" style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}>
          <div className="text-xs mb-3" style={{ color: '#888' }}>
            <TeamOutlined className="mr-1" />
            本次 {data.period === '2605' ? '5 月' : data.period} 大赛评委团（按姓名首字母排序）
          </div>
          <div className="space-y-2 text-sm" style={{ color: '#666' }}>
            {(['user', 'business', 'tech'] as Role[]).map((r) => {
              const names = data.panel?.[r] ?? [];
              if (names.length === 0) return null;
              return (
                <div key={r} className="flex items-start gap-3">
                  <Tag color={ROLE_COLOR[r]} style={{ margin: 0, minWidth: 80, textAlign: 'center' }}>
                    {ROLE_LABEL[r]}
                  </Tag>
                  <span className="flex-1">{names.join('，')}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 评审明细 Modal */}
      {modalSub && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
          onClick={() => setModalSub(null)}
        >
          <div
            className="rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl"
            style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.1)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between"
              style={{ background: '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div>
                <h3 className="text-base font-bold">{modalSub.title}</h3>
                <p className="text-xs mt-0.5" style={{ color: '#666' }}>
                  {modalSub.team && <Tag color="blue" style={{ margin: 0, marginRight: 6 }}>{modalSub.team}</Tag>}
                  总分 <b style={{ color: '#1a3a8a' }}>{modalSub.totalScore != null ? modalSub.totalScore.toFixed(1) : '—'}</b> / {TOTAL_MAX} · {modalSub.reviews.length} 条评审
                </p>
              </div>
              <button onClick={() => setModalSub(null)} className="text-xl" style={{ color: 'var(--text-muted)' }}>×</button>
            </div>

            <div className="p-6 space-y-4" style={{ color: '#1a1a1a' }}>
              {modalSub.reviews.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: '#999' }}>暂无评审记录</p>
              ) : modalSub.reviews.map((r) => (
                <div key={r.id} className="rounded-xl p-4" style={{ background: '#f5f7fb', border: '1px solid rgba(26,58,138,0.15)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm" style={{ color: '#1a1a1a' }}>{r.reviewerName}</span>
                      {r.reviewerRole && <Tag color={ROLE_COLOR[r.reviewerRole]} style={{ margin: 0 }}>{ROLE_LABEL[r.reviewerRole]}</Tag>}
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold" style={{ color: '#1a3a8a' }}>{r.weightedScore}</div>
                      <div className="text-[10px]" style={{ color: '#666' }}>加权总分 / 100</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-2 text-xs">
                    {Object.entries(r.scores).map(([dim, val]) => (
                      <div key={dim} className="flex items-center justify-between">
                        <span style={{ color: '#555' }}>{ROLE_DIM_LABEL[dim] ?? dim}</span>
                        <span className="font-mono font-semibold" style={{ color: '#1a1a1a' }}>{val}</span>
                      </div>
                    ))}
                  </div>
                  {r.reason && (
                    <p className="text-xs mt-2 pt-2" style={{ color: '#333', borderTop: '1px dashed rgba(0,0,0,0.1)' }}>
                      {r.reason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 方案详情 Modal */}
      {detailSub && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
          onClick={() => setDetailSub(null)}
        >
          <div
            className="rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl"
            style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.1)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 px-6 py-4"
              style={{ background: '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold">
                    {detailSub.proposalNo ? `#${String(detailSub.proposalNo).padStart(3, '0')} ` : ''}
                    {detailSub.title}
                  </h3>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {detailSub.team && <Tag color="blue" style={{ margin: 0 }}>{detailSub.team}</Tag>}
                    {detailSub.sceneCategory && <Tag color="cyan" style={{ margin: 0 }}>{detailSub.sceneCategory}</Tag>}
                    {detailSub.extraValue && <Tag color="green" style={{ margin: 0 }}>{detailSub.extraValue}</Tag>}
                    {detailSub.reuseValueLevel && <ReuseLevelTag level={detailSub.reuseValueLevel} />}
                  </div>
                </div>
                <button onClick={() => setDetailSub(null)} className="text-xl shrink-0 ml-2" style={{ color: 'var(--text-muted)' }}>×</button>
              </div>
            </div>

            <div className="p-6 space-y-5" style={{ color: '#1a1a1a' }}>
              <QuantCard sub={detailSub} />

              <div className="grid grid-cols-2 gap-3">
                <Field label="提报人" value={detailSub.authorName} />
                <Field label="小组成员" value={detailSub.teamMembers} />
                <Field label="方案确认人" value={detailSub.verifier} />
                <Field label="Token 费用/月" value={detailSub.aiCost ? `¥${detailSub.aiCost}` : null} />
                <div>
                  <div className="text-xs font-medium mb-0.5" style={{ color: '#666' }}>复用价值</div>
                  <ReuseHeroStrip level={detailSub.reuseValueLevel} fullText={detailSub.reuseValue} showLabel={false} />
                </div>
              </div>

              {detailSub.aiTools.length > 0 && (
                <Section title="用到的 AI 工具">
                  <div className="flex flex-wrap gap-1.5">
                    {detailSub.aiTools.map((t) => <Tag key={t} color="geekblue" style={{ margin: 0 }}>{t}</Tag>)}
                  </div>
                </Section>
              )}

              {detailSub.painPoints.length > 0 && (
                <Section title="核心痛点">
                  <div className="flex flex-wrap gap-1.5">
                    {detailSub.painPoints.map((p) => <Tag key={p} color="orange" style={{ margin: 0 }}>{p}</Tag>)}
                  </div>
                </Section>
              )}

              {detailSub.beforeProcess && (
                <Section title="原业务场景 & 流程">
                  <pre className="text-xs whitespace-pre-wrap font-sans" style={{ color: '#1a1a1a' }}>{detailSub.beforeProcess}</pre>
                </Section>
              )}

              {detailSub.afterProcess && (
                <Section title="改造后流程">
                  <pre className="text-xs whitespace-pre-wrap font-sans" style={{ color: '#1a1a1a' }}>{detailSub.afterProcess}</pre>
                </Section>
              )}

              {detailSub.implementation && (
                <Section title="实现方式">
                  <pre className="text-xs whitespace-pre-wrap font-sans" style={{ color: '#1a1a1a' }}>{detailSub.implementation}</pre>
                </Section>
              )}

              {/* 月均降本费用 + 降本费用说明 */}
              {(detailSub.monthlySavedCost || detailSub.costReductionNote) && (
                <Section title="月均降本">
                  {detailSub.monthlySavedCost && (
                    <div className="text-sm font-bold font-mono" style={{ color: '#1a1a1a' }}>
                      ¥{detailSub.monthlySavedCost} / 月
                    </div>
                  )}
                  {detailSub.costReductionNote && (
                    <pre className="text-xs whitespace-pre-wrap font-sans mt-1" style={{ color: '#1a1a1a' }}>{detailSub.costReductionNote}</pre>
                  )}
                </Section>
              )}

              {/* 实现效果 / 飞书记录链接 */}
              {(detailSub.implementationLink || detailSub.recordUrl) && (
                <Section title="相关链接">
                  {detailSub.implementationLink && (
                    <a href={detailSub.implementationLink} target="_blank" rel="noopener noreferrer"
                      className="block text-xs hover:underline mb-1" style={{ color: '#1a3a8a' }}>
                      实现效果: {detailSub.implementationLink}
                    </a>
                  )}
                  {detailSub.recordUrl && (
                    <a href={detailSub.recordUrl} target="_blank" rel="noopener noreferrer"
                      className="block text-xs hover:underline" style={{ color: '#1a3a8a' }}>
                      飞书记录: {detailSub.recordUrl}
                    </a>
                  )}
                </Section>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── 子组件 ─── */

/** 筛选条 pill — label + 小字号 (count) */
function FilterPill({ active, label, count, onClick }: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1 rounded-full text-xs font-medium transition-all inline-flex items-center gap-1"
      style={{
        color: active ? '#fff' : 'var(--text-secondary)',
        background: active ? 'var(--primary)' : 'rgba(255, 255, 255, 0.3)',
        border: '1px solid transparent',
      }}
    >
      <span>{label}</span>
      <span style={{ fontSize: 10, opacity: active ? 0.85 : 0.7 }}>({count})</span>
    </button>
  );
}

function StatBox({ icon, label, value, sub, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="rounded-xl p-3 flex items-start gap-2.5" style={{ background: 'rgba(0,0,0,0.02)' }}>
      <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-sm" style={{ background: `${color}15`, color }}>
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</div>
        <div className="text-lg font-bold leading-tight truncate" style={{ color }}>{value}</div>
        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{sub}</div>
      </div>
    </div>
  );
}

function MetricMini({ label, value, highlight, size = 'sm', layout = 'col' }: { label: string; value: string; highlight?: boolean; size?: 'sm' | 'lg'; layout?: 'col' | 'row' }) {
  const isLg = size === 'lg';
  if (layout === 'row') {
    return (
      <div className="flex items-center justify-between rounded-md px-3 py-2" style={{ background: 'rgba(0,0,0,0.02)' }}>
        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{label}</span>
        <span className={`${isLg ? 'text-lg' : 'text-sm'} font-bold font-mono`} style={{ color: highlight ? '#16a34a' : 'var(--foreground)' }}>
          {value}
        </span>
      </div>
    );
  }
  return (
    <div className={`flex flex-col items-center rounded-md ${isLg ? 'px-2 py-2' : 'px-2 py-1.5'}`} style={{ background: 'rgba(255,255,255,0.5)' }}>
      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className={`${isLg ? 'text-lg' : 'text-sm'} font-bold font-mono`} style={{ color: highlight ? '#16a34a' : 'var(--foreground)' }}>
        {value}
      </span>
    </div>
  );
}

/** 2×2 网格：原/现人均工时 + 原/现月均人数（量化数据区"具体数据"附属） */
/** 3 行：人数 / 耗时 / 频次 — 简洁文本行，仅变化值高亮 */
function QuantGrid3x2({ sub }: { sub: SubmissionDTO }) {
  const formatFrequency = (freq: string | null, count: number | null): string => {
    if (!freq || count == null) return '—';
    return freq.replace(/x/gi, String(count));
  };
  const beforeFreq = formatFrequency(sub.oldFrequency, sub.oldOperationCount);
  const afterFreq = formatFrequency(sub.newFrequency, sub.newOperationCount);
  const rows: { label: string; before: string; after: string }[] = [
    { label: '人数', before: sub.beforePeopleCount != null ? `${sub.beforePeopleCount}人` : '—', after: sub.afterPeopleCount != null ? `${sub.afterPeopleCount}人` : '—' },
    { label: '耗时', before: sub.oldHoursPerTask != null ? `${sub.oldHoursPerTask}h` : '—', after: sub.newDuration != null ? `${sub.newDuration}h` : '—' },
    { label: '频次', before: beforeFreq, after: afterFreq },
  ];
  const hasData = rows.some((r) => r.before !== '—' || r.after !== '—');
  if (!hasData) return null;
  return (
    <div className="space-y-1 mt-1.5 pt-1.5" style={{ borderTop: '1px dashed rgba(0,0,0,0.06)' }}>
      {rows.map((r) => {
        const changed = r.before !== '—' && r.after !== '—' && r.before !== r.after;
        return (
          <div key={r.label} className="flex items-center gap-2 text-[11px]">
            <span className="w-8 shrink-0" style={{ color: 'var(--text-muted)' }}>{r.label}</span>
            <span style={{ color: 'var(--text-muted)' }}>{r.before}</span>
            <span style={{ color: 'var(--text-muted)' }}>→</span>
            <span
              className="font-medium"
              style={{ color: changed ? '#16a34a' : 'var(--text-muted)' }}
            >
              {r.after}
            </span>
            {changed && <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: 'rgba(22,163,74,0.08)', color: '#16a34a' }}>变化</span>}
          </div>
        );
      })}
    </div>
  );
}

function BeforeAfterMini({ sub }: { sub: SubmissionDTO }) {
  if (sub.beforeHoursPerPerson == null && sub.afterHoursPerPerson == null) return null;
  const changed = sub.beforeHoursPerPerson != null && sub.afterHoursPerPerson != null && sub.beforeHoursPerPerson !== sub.afterHoursPerPerson;
  return (
    <div className="flex items-center gap-2 text-[11px] mt-1.5 pt-1.5" style={{ borderTop: '1px dashed rgba(0,0,0,0.06)' }}>
      <span className="w-12 shrink-0" style={{ color: 'var(--text-muted)' }}>人均工时</span>
      <span style={{ color: 'var(--text-muted)' }}>{sub.beforeHoursPerPerson != null ? `${sub.beforeHoursPerPerson}h` : '—'}</span>
      <span style={{ color: 'var(--text-muted)' }}>→</span>
      <span className="font-medium" style={{ color: changed ? '#16a34a' : 'var(--foreground)' }}>
        {sub.afterHoursPerPerson != null ? `${sub.afterHoursPerPerson}h` : '—'}
      </span>
      {changed && <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: 'rgba(22,163,74,0.08)', color: '#16a34a' }}>变化</span>}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs font-medium mb-0.5" style={{ color: '#666' }}>{label}</div>
      <div className="text-sm font-medium" style={{ color: value ? '#1a1a1a' : '#999' }}>
        {value || '—'}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm font-bold mb-2" style={{ color: '#1a1a1a' }}>{title}</div>
      <div>{children}</div>
    </div>
  );
}

function QuantCard({ sub }: { sub: SubmissionDTO }) {
  // 硬编码方案：Aily 行政服务台 — 显示机器人拦截率
  if (sub.id === SERVICE_DESK_ID) return <ServiceDeskQuant />;
  const savedHours = sub.monthlySavedHours;
  const effRate = sub.efficiencyRate;
  const beforeH = sub.beforeHoursPerPerson;
  const beforeP = sub.beforePeopleCount;
  const afterH = sub.afterHoursPerPerson;
  const afterP = sub.afterPeopleCount;
  const oldOp = sub.oldOperationCount;
  const newOp = sub.newOperationCount;
  const oldDur = sub.oldHoursPerTask;
  const newDur = sub.newDuration;
  // 4 字段 2x2（原/现人均工时 + 原/现月均人数）
  const cells4: { label: string; value: string }[] = [];
  if (beforeH != null) cells4.push({ label: '原人均每月投入工时', value: `${beforeH} 小时` });
  if (beforeP != null) cells4.push({ label: '原月均投入人数', value: `${beforeP} 人` });
  if (afterH != null) cells4.push({ label: '现人均每月投入工时', value: `${afterH} 小时` });
  if (afterP != null) cells4.push({ label: '现月均投入人数', value: `${afterP} 人` });
  const hasOps = oldOp != null || newOp != null;
  const hasDur = oldDur != null || newDur != null;
  const hasAny = savedHours != null || effRate != null || cells4.length > 0 || hasOps || hasDur;
  if (!hasAny) return null;

  const calcSaved = (beforeH != null && afterH != null && beforeP != null)
    ? Math.round((beforeH - afterH) * beforeP * 10) / 10
    : null;
  const showSaved = savedHours ?? calcSaved;

  return (
    <div className="rounded-2xl p-5 shadow-sm"
      style={{ background: 'linear-gradient(135deg, #1a3a8a 0%, #2d5aa0 100%)', color: '#fff' }}>
      <div className="text-xs font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.8)' }}>
        量化数据
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        {showSaved != null && (
          <div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>月均节省工时</div>
            <div className="text-2xl font-bold mt-0.5">
              {typeof showSaved === 'number' ? showSaved.toFixed(1) : showSaved}
              <span className="text-sm font-medium ml-1" style={{ color: 'rgba(255,255,255,0.8)' }}>小时</span>
            </div>
          </div>
        )}
        {effRate != null && (
          <div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>提效比例</div>
            <div className="text-2xl font-bold mt-0.5">
              {(effRate * 100).toFixed(1)}
              <span className="text-sm font-medium ml-1" style={{ color: 'rgba(255,255,255,0.8)' }}>%</span>
            </div>
          </div>
        )}
      </div>
      {/* 4 字段 2x2 */}
      {cells4.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }}>
          {cells4.map((c, i) => (
            <div key={i} className="rounded-md p-2" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="text-[10px] mb-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>{c.label}</div>
              <div className="text-sm font-bold font-mono" style={{ color: '#fff' }}>{c.value}</div>
            </div>
          ))}
        </div>
      )}
      {/* 附加：操作次数 + 单次时长（保留） */}
      {(hasOps || hasDur) && (
        <div className="space-y-2 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }}>
          {hasOps && <CompareRow label="操作次数" before={oldOp != null ? `${oldOp} 次` : '—'} after={newOp != null ? `${newOp} 次` : '—'} />}
          {hasDur && <CompareRow label="单次时长" before={oldDur != null ? `${oldDur}` : '—'} after={newDur != null ? `${newDur}` : '—'} />}
        </div>
      )}
    </div>
  );
}

/** 硬编码方案量化卡（Modal 用）：Aily 行政服务台 — 机器人拦截率 */
function ServiceDeskQuant() {
  const rows = [
    { label: '接入后拦截率', value: SERVICE_DESK_METRICS.interceptAfter, highlight: true },
    { label: `接入前拦截率(${SERVICE_DESK_METRICS.period})`, value: SERVICE_DESK_METRICS.interceptBefore, highlight: false },
    { label: '环比增长', value: `+${SERVICE_DESK_METRICS.growth}`, highlight: true },
  ];
  return (
    <div className="rounded-2xl p-5 shadow-sm"
      style={{ background: 'linear-gradient(135deg, #1a3a8a 0%, #2d5aa0 100%)', color: '#fff' }}>
      <div className="text-xs font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.8)', letterSpacing: '0.08em' }}>
        量化数据 · 机器人拦截率
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>{r.label}</span>
            <span className="text-xl font-bold font-mono tracking-tight" style={{ color: r.highlight ? '#86efac' : '#fff' }}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompareRow({ label, before, after }: { label: string; before: string; after: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-20 shrink-0" style={{ color: 'rgba(255,255,255,0.7)' }}>{label}</span>
      <span style={{ color: 'rgba(255,255,255,0.6)' }}>{before}</span>
      <span style={{ color: 'rgba(255,255,255,0.6)' }}>→</span>
      <b style={{ color: '#fff' }}>{after}</b>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const styleMap: Record<number, { bg: string; color: string; label: string }> = {
    1: { bg: 'linear-gradient(135deg, #FFD700, #FFA500)', color: '#5a3a00', label: '🥇' },
    2: { bg: 'linear-gradient(135deg, #E8E8E8, #B0B0B0)', color: '#3a3a3a', label: '🥈' },
    3: { bg: 'linear-gradient(135deg, #CD7F32, #A0522D)', color: '#fff', label: '🥉' },
  };
  const s = styleMap[rank] ?? { bg: 'rgba(26,58,138,0.08)', color: '#1a3a8a', label: '' };
  return (
    <div
      className="absolute top-0 left-0 flex items-center justify-center font-bold"
      style={{
        width: 44, height: 44,
        background: s.bg, color: s.color,
        borderBottomRightRadius: 12,
        fontSize: 16, lineHeight: 1,
        boxShadow: '0 2px 6px rgba(0,0,0,0.1)', zIndex: 1,
      }}
      title={`第 ${rank} 名`}
    >
      {s.label ? <span className="text-base mr-0.5">{s.label}</span> : null}
      <span style={{ marginLeft: s.label ? -2 : 0 }}>{rank}</span>
    </div>
  );
}

/** 复用价值等级 Tag — 高级渐变 + 多层阴影（withEmoji 参数保留向后兼容） */
function ReuseLevelTag({ level, withEmoji = true }: { level: string; withEmoji?: boolean }) {
  void withEmoji;
  const styleMap: Record<string, { bg: string; color: string }> = {
    '金': { bg: '#fef9e7', color: '#92700a' },
    '银': { bg: '#f1f5f9', color: '#475569' },
    '铜': { bg: '#fef3e2', color: '#9a4a1a' },
  };
  const s = styleMap[level] ?? { bg: 'rgba(124,58,237,0.06)', color: 'var(--foreground)' };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold"
      style={{ background: s.bg, color: s.color }}
    >
      {level}
    </span>
  );
}

/** 复用价值条：左侧色条 + 等级 pill + 描述 + 系数 — 简洁现代风 */
function ReuseHeroStrip({ level, fullText, showLabel = true }: {
  level: string | null;
  fullText: string | null;
  showLabel?: boolean;
}) {
  // 左侧色条颜色（按等级）
  const accentMap: Record<string, string> = {
    '金': '#d4a017',
    '银': '#94a3b8',
    '铜': '#c2703e',
  };
  const accent = accentMap[level ?? ''] ?? '#a78bfa';
  // 从 fullText 提取 x 系数
  const coefMatch = fullText?.match(/x(\d+(?:\.\d+)?)/i);
  const coefficient = coefMatch?.[0] ?? null;
  let description = fullText;
  if (fullText && coefficient) {
    const escaped = coefficient.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    description = fullText.replace(new RegExp(escaped, 'i'), '').trim().replace(/\s*[，。,\s]+$/, '').trim();
  }
  if (!level && !fullText) {
    return showLabel ? (
      <div className="px-4 py-2.5" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
        <div className="text-[10px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>二、复用价值</div>
        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>暂无数据</span>
      </div>
    ) : null;
  }
  return (
    <div
      className="px-4 py-2.5 flex items-start gap-2.5"
      style={{ borderLeft: `3px solid ${accent}`, background: 'rgba(0,0,0,0.015)', borderTop: '1px solid rgba(0,0,0,0.05)' }}
    >
      {showLabel && (
        <span className="text-[10px] font-medium shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }}>二、复用价值</span>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {level && <ReuseLevelTag level={level} />}
          {description && <span className="text-xs leading-relaxed flex-1 min-w-0" style={{ color: 'var(--foreground)' }}>{description}</span>}
          {coefficient && <span className="text-sm font-bold font-mono shrink-0" style={{ color: accent }}>{coefficient}</span>}
        </div>
      </div>
    </div>
  );
}
