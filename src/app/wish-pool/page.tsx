'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Spin, Tag, Select, Input, Button, App } from 'antd';
import {
  SearchOutlined,
  SyncOutlined,
  StarOutlined,
  TrophyOutlined,
  RocketOutlined,
  BarChartOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/lib/auth-context';

// ── 类型定义 ──
interface WishItem {
  id: string;
  recordUrl?: string;
  title?: string;
  briefIntro?: string;
  sceneCategory?: string;
  coreValue?: string;
  sceneSource?: string;
  regionCoefficient?: string;
  landingProgress?: string;
  competitionProgress?: string;
  bizOwner?: string[];
  aiOwner?: string[];
  submitter?: string[];
  teamMembers?: string[];
  team?: string[];
  teamType?: string;
  beforeProcess?: string;
  painPoints?: string[];
  beforeFrequency?: string;
  beforeOperationCount?: number;
  beforeFreq?: number;
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
  afterFreq?: number;
  afterPeopleCount?: number;
  afterHoursPerTask?: number;
  afterMonthlyHours?: number;
  reuseValue?: string;
  totalEfficiencyRate?: number;
  finalValueScore?: number;
  valueRank?: number;
}

interface Stats {
  total: number;
  avgScore: number;
  withScoreCount: number;
  progressMap: Record<string, number>;
  contestMap: Record<string, number>;
  categoryMap: Record<string, number>;
  teamMap: Record<string, number>;
}

// ── 颜色配置 ──
const CATEGORY_COLORS: Record<string, string> = {
  数据分析: '#6366f1',
  招聘管理: '#f97316',
  薪酬绩效: '#3b82f6',
  培训管理: '#a855f7',
  组织与人才发展: '#06b6d4',
  文化氛围: '#ec4899',
  核算与报账: '#8b5cf6',
  基础人事支持: '#22c55e',
  行政管理: '#84cc16',
  日常工作: '#10b981',
  考勤管理: '#3b82f6',
};

const PROGRESS_COLORS: Record<string, string> = {
  待启动: '#94a3b8',
  训练验证中: '#60a5fa',
  试点上线: '#fb923c',
  推广上线: '#38bdf8',
  全面上线: '#4ade80',
  关闭: '#f87171',
  未标记: '#cbd5e1',
};

const CONTEST_COLORS: Record<string, string> = {
  评审中: '#3b82f6',
  终审通过: '#22c55e',
  待提交人补充方案: '#f59e0b',
  待提交人调整方案: '#f59e0b',
  并入其他方案: '#94a3b8',
  未参赛: '#8b5cf6',
};

// ── 工具函数 ──
function fmt(n: number): string {
  if (n >= 1e4) return (n / 1e4).toFixed(1) + '万';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return Math.round(n).toString();
}

function fmtF(n: number): string {
  return n.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
}

// ── 水平条形图组件 ──
function HBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
      <span style={{ width: 100, textAlign: 'right', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 18, background: 'rgba(255,255,255,0.3)', borderRadius: 9, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 9, width: `${Math.max(pct, 1)}%`, background: color, transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ width: 60, fontSize: 11, fontFamily: 'SF Mono, monospace', color: 'var(--text-secondary)', flexShrink: 0 }}>{value}个</span>
    </div>
  );
}

// ── 统计卡片组件 ──
function MetricCard({ label, value, sub, color, icon }: { label: string; value: string; sub?: string; color: string; icon: React.ReactNode }) {
  return (
    <div className="glass rounded-xl p-5" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color, fontSize: 16 }}>{icon}</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1, color }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── 排名条组件 ──
function RankBar({ rank, name, category, score, maxScore, totalSavedHours }: {
  rank: number;
  name: string;
  category?: string;
  score: number;
  maxScore: number;
  totalSavedHours?: number;
}) {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  const isTop3 = rank <= 3;
  const bg = isTop3 ? '#f59e0b' : 'rgba(255,255,255,0.3)';
  const fg = isTop3 ? '#fff' : 'var(--text-secondary)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
      <div style={{
        width: 26, height: 26, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, color: 'white', background: bg, flexShrink: 0,
      }}>
        {rank}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {name}
          {category && <Tag color={CATEGORY_COLORS[category] || '#6b7280'} className="text-[10px]">{category}</Tag>}
        </div>
        <div style={{ marginTop: 4, height: 16, background: 'rgba(255,255,255,0.3)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 8,
            width: `${Math.max(pct, 3)}%`,
            background: `linear-gradient(90deg, ${isTop3 ? '#f59e0bcc' : '#3b82f6cc'}, ${isTop3 ? '#f59e0b55' : '#3b82f655'})`,
            display: 'flex', alignItems: 'center', paddingLeft: 6,
            transition: 'width 0.6s ease',
          }}>
            {pct > 15 && <span style={{ fontSize: 10, color: 'white', fontFamily: 'SF Mono, monospace', whiteSpace: 'nowrap' }}>{fmtF(Math.round(score))}</span>}
          </div>
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0, width: 70 }}>
        <div style={{ fontSize: 11, fontFamily: 'SF Mono, monospace', color: 'var(--foreground)' }}>{totalSavedHours ? `${fmt(totalSavedHours)}h/月` : '-'}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{score > 0 ? `${fmtF(Math.round(score))} 分` : '-'}</div>
      </div>
    </div>
  );
}

// ── 主页面 ──
export default function WishPoolPage() {
  const router = useRouter();
  const { isAdmin, loading: authLoading } = useAuth();
  const { message } = App.useApp();

  const [items, setItems] = useState<WishItem[]>([]);
  const [ranked, setRanked] = useState<WishItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [progressFilter, setProgressFilter] = useState<string>('all');

  // 权限检查
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.replace('/');
    }
  }, [authLoading, isAdmin, router]);

  // 获取数据
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/wish-pool');
      if (!res.ok) throw new Error('获取失败');
      const data = await res.json();
      setItems(data.items || []);
      setRanked(data.ranked || []);
      setStats(data.stats);
    } catch {
      message.error('获取许愿池数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  // 刷新数据
  const handleRefresh = async () => {
    setSyncing(true);
    await fetchData();
    setSyncing(false);
    message.success('数据已刷新');
  };

  // 筛选选项
  const categoryOptions = useMemo(() => {
    if (!stats) return [];
    return [
      { value: 'all', label: '全部分类' },
      ...Object.keys(stats.categoryMap).map((cat) => ({ value: cat, label: `${cat} (${stats.categoryMap[cat]})` })),
    ];
  }, [stats]);

  const progressOptions = useMemo(() => {
    if (!stats) return [];
    return [
      { value: 'all', label: '全部进展' },
      ...Object.keys(stats.progressMap).map((prog) => ({ value: prog, label: `${prog} (${stats.progressMap[prog]})` })),
    ];
  }, [stats]);

  // 筛选后的数据
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (categoryFilter !== 'all' && item.sceneCategory !== categoryFilter) return false;
      if (progressFilter !== 'all') {
        const prog = item.landingProgress || '未标记';
        if (prog !== progressFilter) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        return (
          (item.title || '').toLowerCase().includes(q) ||
          (item.briefIntro || '').toLowerCase().includes(q) ||
          (item.sceneCategory || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [items, categoryFilter, progressFilter, search]);

  // 计算统计
  const maxCat = useMemo(() => stats ? Math.max(...Object.values(stats.categoryMap), 1) : 1, [stats]);
  const maxTeam = useMemo(() => stats ? Math.max(...Object.values(stats.teamMap), 1) : 1, [stats]);
  const maxScore = useMemo(() => ranked.length > 0 ? (ranked[0].finalValueScore || 1) : 1, [ranked]);

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Spin size="large" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="glass rounded-2xl p-6 mb-6" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">HR AI 场景价值看板</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              CHO / 管理层决策视角 · {stats?.total || 0} 个场景 · 数据实时同步自飞书
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {[
                { key: 'overview', label: '总览', icon: <BarChartOutlined /> },
                { key: 'value', label: '价值排名', icon: <TrophyOutlined /> },
                { key: 'pipeline', label: '落地管线', icon: <RocketOutlined /> },
                { key: 'gaps', label: '数据质量', icon: <WarningOutlined /> },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    activeTab === tab.key
                      ? 'bg-white shadow-sm text-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
            <Button
              icon={<SyncOutlined spin={syncing} />}
              onClick={handleRefresh}
              loading={syncing}
              size="small"
              type="primary"
            >
              刷新
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center items-center min-h-[40vh]">
          <Spin size="large" />
        </div>
      ) : (
        <>
          {activeTab === 'overview' && stats && (
            <div className="space-y-6">
              {/* 统计卡片 */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  label="心愿总数"
                  value={String(stats.total)}
                  sub="AI 许愿 + AI 大赛"
                  color="var(--primary)"
                  icon={<StarOutlined />}
                />
                <MetricCard
                  label="平均价值分"
                  value={stats.avgScore > 0 ? stats.avgScore.toFixed(1) : '-'}
                  sub={`${stats.withScoreCount} 个有分场景`}
                  color="#7c3aed"
                  icon={<TrophyOutlined />}
                />
                <MetricCard
                  label="已落地/试点"
                  value={String((stats.progressMap['试点上线'] || 0) + (stats.progressMap['推广上线'] || 0) + (stats.progressMap['全面上线'] || 0))}
                  sub="试点 + 推广 + 全面"
                  color="#059669"
                  icon={<RocketOutlined />}
                />
                <MetricCard
                  label="评审中"
                  value={String(stats.contestMap['评审中'] || 0)}
                  sub="AI 大赛参审场景"
                  color="#3b82f6"
                  icon={<BarChartOutlined />}
                />
              </div>

              {/* 图表区 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 按场景分类 */}
                <div className="glass rounded-xl overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
                  <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.3)' }}>
                    <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>按场景分类</h3>
                    <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>各职能领域的场景分布</p>
                  </div>
                  <div className="p-5">
                    {Object.entries(stats.categoryMap)
                      .sort((a, b) => b[1] - a[1])
                      .map(([cat, count]) => (
                        <HBar key={cat} label={cat} value={count} max={maxCat} color={CATEGORY_COLORS[cat] || '#6b7280'} />
                      ))}
                  </div>
                </div>

                {/* 按提报团队 */}
                <div className="glass rounded-xl overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
                  <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.3)' }}>
                    <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>按提报团队</h3>
                    <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>识别 AI 转型的先锋团队</p>
                  </div>
                  <div className="p-5">
                    {Object.entries(stats.teamMap)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 10)
                      .map(([team, count]) => (
                        <HBar key={team} label={team} value={count} max={maxTeam} color="#6366f1" />
                      ))}
                  </div>
                </div>
              </div>

              {/* 落地进展 + 大赛进展 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 落地进展 */}
                <div className="glass rounded-xl overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
                  <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.3)' }}>
                    <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>落地进展</h3>
                    <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>场景从启动到全面上线的推进状态</p>
                  </div>
                  <div className="p-5">
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120, padding: '0 4px' }}>
                      {['待启动', '训练验证中', '试点上线', '推广上线', '全面上线'].map((stage) => {
                        const count = stats.progressMap[stage] || 0;
                        const maxP = Math.max(...['待启动', '训练验证中', '试点上线', '推广上线', '全面上线'].map((s) => stats.progressMap[s] || 0), 1);
                        const h = Math.max((count / maxP) * 90, 3);
                        return (
                          <div key={stage} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)' }}>{count}</div>
                            <div style={{ width: '100%', borderRadius: '4px 4px 0 0', height: h, background: PROGRESS_COLORS[stage] }} />
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.15 }}>{stage}</div>
                          </div>
                        );
                      })}
                    </div>
                    {(stats.progressMap['未标记'] || 0) > 0 && (
                      <div className="mt-3 p-3 rounded-lg" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                        <span style={{ fontWeight: 600, fontSize: 12, color: '#92400e' }}>
                          {stats.progressMap['未标记']} / {stats.total} 场景未标记进展
                        </span>
                        <span style={{ fontSize: 11, color: '#b45309', marginLeft: 8 }}>建议设为必填字段</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 大赛进展 */}
                <div className="glass rounded-xl overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
                  <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.3)' }}>
                    <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>大赛参赛状态</h3>
                    <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>AI 大赛 vs AI 许愿的场景分布</p>
                  </div>
                  <div className="p-5">
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(stats.contestMap).map(([status, count]) => (
                        <div key={status} className="rounded-lg p-3 text-center" style={{ background: 'rgba(255,255,255,0.3)' }}>
                          <div style={{ fontSize: 28, fontWeight: 700, color: CONTEST_COLORS[status] || '#6b7280' }}>{count}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{status}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'value' && (
            <div className="space-y-6">
              {/* Top 10 高价值场景 */}
              <div className="glass rounded-xl overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
                <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.3)' }}>
                  <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Top 10 高价值场景</h3>
                  <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>按最终价值计分排名 = 月均节省总工时 × 地区系数 × 复用系数</p>
                </div>
                <div className="p-5">
                  {ranked.slice(0, 10).map((item) => (
                    <RankBar
                      key={item.id}
                      rank={item.valueRank || 0}
                      name={item.title || '-'}
                      category={item.sceneCategory}
                      score={item.finalValueScore || 0}
                      maxScore={maxScore}
                      totalSavedHours={item.totalSavedHours || item.monthlySavedHours}
                    />
                  ))}
                </div>
              </div>

              {/* 价值计分公式 */}
              <div className="glass rounded-xl overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
                <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.3)' }}>
                  <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>价值计分公式解读</h3>
                  <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>最终价值计分 = 月均节省总工时 × 地区系数 × 复用系数</p>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-lg p-4" style={{ background: 'rgba(59,130,246,0.1)' }}>
                      <h4 className="text-sm font-semibold" style={{ color: '#1e40af' }}>月均节省总工时</h4>
                      <p className="text-xs mt-1" style={{ color: '#3b82f6' }}>= 月均提效节省工时 + 月均降本折算工时</p>
                      <p className="text-xs" style={{ color: '#60a5fa' }}>降本折算：月均降本费用 ÷ (50 × 地区系数)</p>
                    </div>
                    <div className="rounded-lg p-4" style={{ background: 'rgba(34,197,94,0.1)' }}>
                      <h4 className="text-sm font-semibold" style={{ color: '#166534' }}>场景归属地区系数</h4>
                      <p className="text-xs mt-1" style={{ color: '#16a34a' }}>国内 ×1 · 海外 ×2 · 全球 ×1.5</p>
                      <p className="text-xs" style={{ color: '#4ade80' }}>基于全球 HR 人力成本水平</p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-lg p-4" style={{ background: 'rgba(245,158,11,0.1)' }}>
                    <h4 className="text-sm font-semibold" style={{ color: '#92400e' }}>推广复用价值系数</h4>
                    <p className="text-xs mt-1" style={{ color: '#d97706' }}>个人 ×1 · BU 内 ×2 · 跨 BU ×3 · 全集团 ×4</p>
                    <p className="text-xs" style={{ color: '#f59e0b' }}>复用范围越广，价值倍数越高</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'pipeline' && (
            <div className="space-y-6">
              {/* 落地进展漏斗 */}
              <div className="glass rounded-xl overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
                <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.3)' }}>
                  <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>落地进展漏斗</h3>
                  <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>场景从启动到全面上线的推进状态</p>
                </div>
                <div className="p-5">
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 180, padding: '0 10px' }}>
                    {['待启动', '训练验证中', '试点上线', '推广上线', '全面上线'].map((stage) => {
                      const count = stats?.progressMap[stage] || 0;
                      const maxP = Math.max(...['待启动', '训练验证中', '试点上线', '推广上线', '全面上线'].map((s) => stats?.progressMap[s] || 0), 1);
                      const h = Math.max((count / maxP) * 150, 4);
                      return (
                        <div key={stage} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)' }}>{count}</div>
                          <div style={{ width: '100%', borderRadius: '6px 6px 0 0', height: h, background: PROGRESS_COLORS[stage], transition: 'height 0.5s ease' }} />
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.2 }}>{stage}</div>
                        </div>
                      );
                    })}
                  </div>
                  {(stats?.progressMap['未标记'] || 0) > 0 && (
                    <div className="mt-4 p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                      <p style={{ fontWeight: 600, fontSize: 12, color: '#b91c1c' }}>
                        {stats?.progressMap['未标记']} / {stats?.total} 个场景未标记落地进展
                      </p>
                      <p style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>
                        绝大多数场景缺乏进度追踪数据，CHO 无法判断实际推进节奏。建议：将「落地进展」设为必填字段，建立每周/每月更新机制。
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* 场景列表 */}
              <div className="glass rounded-xl overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
                <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.3)' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>各场景落地进展一览</h3>
                      <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>按价值排名展示每个场景的当前状态</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select value={categoryFilter} onChange={setCategoryFilter} options={categoryOptions} style={{ width: 120 }} size="small" />
                      <Select value={progressFilter} onChange={setProgressFilter} options={progressOptions} style={{ width: 120 }} size="small" />
                      <Input
                        placeholder="搜索场景"
                        prefix={<SearchOutlined />}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ width: 160 }}
                        allowClear
                        size="small"
                      />
                    </div>
                  </div>
                </div>
                <div className="p-5 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="text-left py-2 px-3 text-xs font-medium" style={{ color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.3)' }}>排名</th>
                        <th className="text-left py-2 px-3 text-xs font-medium" style={{ color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.3)' }}>场景</th>
                        <th className="text-left py-2 px-3 text-xs font-medium" style={{ color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.3)' }}>分类</th>
                        <th className="text-left py-2 px-3 text-xs font-medium" style={{ color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.3)' }}>落地进展</th>
                        <th className="text-right py-2 px-3 text-xs font-medium" style={{ color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.3)' }}>价值分</th>
                        <th className="text-right py-2 px-3 text-xs font-medium" style={{ color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.3)' }}>月节省</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems
                        .sort((a, b) => ((a.valueRank as number) ?? 999) - ((b.valueRank as number) ?? 999))
                        .map((item) => (
                          <tr key={item.id} className="hover:bg-white/20 transition-colors">
                            <td className="py-2 px-3 font-mono text-xs" style={{ color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                              {item.valueRank ? `#${item.valueRank}` : '-'}
                            </td>
                            <td className="py-2 px-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                              <a href={item.recordUrl} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'var(--foreground)' }}>
                                {(item.title || '-').length > 30 ? (item.title || '-').slice(0, 30) + '…' : (item.title || '-')}
                              </a>
                            </td>
                            <td className="py-2 px-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                              {item.sceneCategory && (
                                <Tag color={CATEGORY_COLORS[item.sceneCategory] || '#6b7280'} className="text-[11px]">
                                  {item.sceneCategory}
                                </Tag>
                              )}
                            </td>
                            <td className="py-2 px-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                              {item.landingProgress ? (
                                <Tag color={PROGRESS_COLORS[item.landingProgress] || '#6b7280'} className="text-[11px]">
                                  {item.landingProgress}
                                </Tag>
                              ) : (
                                <span style={{ color: '#cbd5e1', fontSize: 12 }}>— 未填</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                              {item.finalValueScore ? fmtF(Math.round(item.finalValueScore)) : '-'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                              {item.totalSavedHours || item.monthlySavedHours ? `${fmt(item.totalSavedHours || item.monthlySavedHours || 0)}h` : '-'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'gaps' && stats && (
            <div className="space-y-6">
              <div className="glass rounded-xl overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
                <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.3)' }}>
                  <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>数据完整性诊断</h3>
                  <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>CHO 看板依赖这些数据 — 以下是当前数据质量的关键缺口</p>
                </div>
                <div className="p-5 space-y-4">
                  {[
                    {
                      field: '落地进展',
                      filled: stats.total - (stats.progressMap['未标记'] || 0),
                      total: stats.total,
                      sev: 'critical' as const,
                      impact: '无法展示进度漏斗，CHO 无法判断整体推进节奏',
                      fix: '将「落地进展」设为必填字段，要求各场景负责人每周更新',
                    },
                    {
                      field: '价值排名',
                      filled: ranked.length,
                      total: stats.total,
                      sev: 'medium' as const,
                      impact: '部分场景缺少价值评分，无法进行价值排名',
                      fix: '确保所有场景都有最终价值计分和价值排名',
                    },
                    {
                      field: '场景分类',
                      filled: items.filter((d) => d.sceneCategory).length,
                      total: stats.total,
                      sev: 'medium' as const,
                      impact: '无法按分类统计场景分布',
                      fix: '为未分类场景补填场景分类',
                    },
                    {
                      field: '提报团队',
                      filled: items.filter((d) => d.team && d.team.length > 0).length,
                      total: stats.total,
                      sev: 'low' as const,
                      impact: '无法归因到团队贡献排名',
                      fix: '为未填写团队的场景补填提报团队',
                    },
                  ].map((gap) => (
                    <div key={gap.field} className="rounded-lg p-4" style={{
                      background: gap.sev === 'critical' ? 'rgba(239,68,68,0.05)' : gap.sev === 'medium' ? 'rgba(245,158,11,0.05)' : 'rgba(255,255,255,0.3)',
                      border: `1px solid ${gap.sev === 'critical' ? 'rgba(239,68,68,0.2)' : gap.sev === 'medium' ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.3)'}`,
                    }}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{gap.field}</span>
                        <Tag color={gap.sev === 'critical' ? 'red' : gap.sev === 'medium' ? 'orange' : 'default'} className="text-[11px]">
                          {gap.sev === 'critical' ? '严重' : gap.sev === 'medium' ? '中等' : '轻微'}
                        </Tag>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.3)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 3,
                            width: `${(gap.filled / gap.total) * 100}%`,
                            background: gap.sev === 'critical' ? '#f87171' : '#fbbf24',
                          }} />
                        </div>
                        <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{gap.filled}/{gap.total}</span>
                      </div>
                      <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>{gap.impact}</p>
                      <p className="text-xs mt-1" style={{ color: '#3b82f6' }}>→ {gap.fix}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
