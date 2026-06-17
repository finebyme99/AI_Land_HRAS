'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Spin, Tag, Button, App } from 'antd';
import {
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
  proposalNo?: string;           // 场景编号
  title?: string;                // 场景名称
  briefIntro?: string;           // 一句话简介
  sceneCategory?: string;        // 场景分类
  coreValue?: string;            // 核心价值
  sceneSource?: string;          // 场景来源
  regionCoefficient?: string;    // 场景归属地区系数
  regionCoefficientValue?: number; // 场景归属地区系数值
  landingProgress?: string;      // 落地进展
  competitionProgress?: string;  // 大赛进展
  reviewPeriod?: string;         // 评审周期
  plannedStartDate?: string;     // 计划启动日期
  pilotDate?: string;            // 试点上线日期
  rolloutDate?: string;          // 推广上线日期
  fullLaunchDate?: string;       // 全面上线日期
  progressRecord?: string;       // 进展记录&链接
  bizOwner?: string[];           // 业务负责人
  aiOwner?: string[];            // AI负责人
  submitter?: string[];          // 提报人
  teamMembers?: string[];        // 组队成员
  creator?: string[];            // 创建人
  team?: string;                 // 提报团队
  teamType?: string;             // 提报组队类型
  aiTools?: string[];            // AI工具
  beforeProcess?: string;        // 原业务场景及流程
  painPoints?: string[];         // 原核心痛点
  beforeFrequency?: string;      // 原操作频率
  beforeOperationCount?: number; // 原操作次数
  beforeFreq?: number;           // 原操作频次
  beforePeopleCount?: number;    // 原操作人数
  beforeHoursPerTask?: number;   // 原单次操作耗时
  beforeMonthlyHours?: number;   // 原月均耗时
  monthlySavedHours?: number;    // 月均提效节省工时
  monthlySavedCost?: number;     // 月均降本费用
  costReductionNote?: string;    // 降本费用说明
  costSavedHours?: number;       // 月均降本折算工时
  totalSavedHours?: number;      // 月均节省总工时
  afterProcess?: string;         // 新业务流程
  afterFrequency?: string;       // 新操作频率
  afterOperationCount?: number;  // 新操作次数
  afterFreq?: number;            // 新操作频次
  afterPeopleCount?: number;     // 新操作人数
  afterHoursPerTask?: number;    // 新单次操作耗时
  afterMonthlyHours?: number;    // 新月均耗时
  aiCost?: number;               // 月均Token费用
  reuseValue?: string;           // 推广复用价值系数
  reuseValueNumber?: number;     // 推广复用价值系数值
  reuseValueLevel?: string;      // 推广复用价值等级
  totalEfficiencyRate?: number;  // 总降本提效比例
  finalValueScore?: number;      // 最终价值计分
  valueRank?: number;            // 价值排名
  implementation?: string;       // AI实现过程简述
  implementationLink?: string;   // AI实现效果
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

// ── 颜色配置（蓝/白/橙三色系，与全站设计系统一致）──
const CATEGORY_COLORS: Record<string, string> = {
  数据分析: '#1a3a8a',
  招聘管理: '#F27F22',
  薪酬绩效: '#2d5bc7',
  培训管理: '#4a7de0',
  组织与人才发展: '#1a3a8a',
  文化氛围: '#F27F22',
  核算与报账: '#2d5bc7',
  基础人事支持: '#4a7de0',
  行政管理: '#1a3a8a',
  日常工作: '#2d5bc7',
  考勤管理: '#4a7de0',
};

const PROGRESS_COLORS: Record<string, string> = {
  待启动: '#94a3b8',
  训练验证中: '#4a7de0',
  试点上线: '#1a3a8a',
  推广上线: '#2d5bc7',
  全面上线: '#F27F22',
  关闭: '#64748b',
  未标记: '#cbd5e1',
};

const CONTEST_COLORS: Record<string, string> = {
  评审中: '#1a3a8a',
  终审通过: '#F27F22',
  待提交人补充方案: '#F27F22',
  待提交人调整方案: '#F27F22',
  并入其他方案: '#94a3b8',
  未参赛: '#94a3b8',
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
        <div style={{ height: '100%', borderRadius: 9, width: `${Math.max(pct, 1)}%`, background: `linear-gradient(90deg, ${color}, ${color}88)`, transition: 'width 0.6s ease' }} />
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

// ── 场景详情悬浮弹窗 ──
function SceneDetailPopup({ item }: { item: WishItem }) {
  const labelStyle: React.CSSProperties = { color: 'var(--text-muted)', fontSize: 11, whiteSpace: 'nowrap' };
  const valStyle: React.CSSProperties = { color: 'var(--foreground)', fontSize: 12, fontWeight: 500, textAlign: 'right' as const };
  const sectionTitle = (text: string, color: string) => (
    <div style={{
      fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.5,
      borderBottom: `1px solid ${color}30`, paddingBottom: 4, marginBottom: 6, marginTop: 10,
    }}>{text}</div>
  );
  const row = (label: string, value: React.ReactNode, full?: boolean) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: '3px 0', gridColumn: full ? '1 / -1' : undefined }}>
      <span style={labelStyle}>{label}</span>
      <span style={{ ...valStyle, maxWidth: full ? 260 : 120, wordBreak: 'break-word' }}>{value || '—'}</span>
    </div>
  );
  const arr = (v: string[] | undefined) => v?.length ? v.join('、') : null;

  return (
    <div style={{ width: 400, maxHeight: 480, overflowY: 'auto', padding: '2px 0' }}>
      {/* Header */}
      <div style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          {item.proposalNo && <Tag style={{ fontSize: 10, margin: 0, background: 'rgba(26,58,138,0.1)', borderColor: 'rgba(26,58,138,0.2)', color: '#1a3a8a' }}>{item.proposalNo}</Tag>}
          {item.sceneCategory && <Tag color={CATEGORY_COLORS[item.sceneCategory] || '#6b7280'} style={{ fontSize: 10, margin: 0 }}>{item.sceneCategory}</Tag>}
          {item.landingProgress && <Tag color={PROGRESS_COLORS[item.landingProgress] || '#6b7280'} style={{ fontSize: 10, margin: 0 }}>{item.landingProgress}</Tag>}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.3 }}>{item.title || '未命名场景'}</div>
        {item.briefIntro && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{item.briefIntro}</div>}
      </div>

      {/* 场景信息 */}
      {sectionTitle('场景信息', '#1a3a8a')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
        {row('核心价值', item.coreValue)}
        {row('场景来源', item.sceneSource)}
        {row('业务负责人', arr(item.bizOwner))}
        {row('AI负责人', arr(item.aiOwner))}
        {row('计划启动', item.plannedStartDate?.slice(0, 10))}
      </div>

      {/* AI前指标 */}
      {sectionTitle('AI前指标', '#1a3a8a')}
      {item.beforeProcess && row('原业务流程', item.beforeProcess.length > 80 ? item.beforeProcess.slice(0, 80) + '…' : item.beforeProcess, true)}
      {item.painPoints && item.painPoints.length > 0 && row('原核心痛点', item.painPoints.join('、'), true)}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
        {row('原操作频次', item.beforeFreq ? `${item.beforeFreq}次/月` : null)}
        {row('原操作人数', item.beforePeopleCount ? `${item.beforePeopleCount}人` : null)}
        {row('单次耗时', item.beforeHoursPerTask ? `${item.beforeHoursPerTask}h` : null)}
        {row('原月均耗时', item.beforeMonthlyHours ? `${fmtF(Math.round(item.beforeMonthlyHours))}h` : null)}
      </div>

      {/* 价值计分指标 */}
      {sectionTitle('价值计分指标', '#F27F22')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
        {row('月均提效节省', item.monthlySavedHours ? `${fmtF(Math.round(item.monthlySavedHours))}h` : null)}
        {row('月均降本费用', item.monthlySavedCost ? `¥${fmtF(item.monthlySavedCost)}` : null)}
        {row('降本折算工时', item.costSavedHours ? `${fmtF(Math.round(item.costSavedHours))}h` : null)}
        {row('月均节省总工时', item.totalSavedHours ? `${fmtF(Math.round(item.totalSavedHours))}h` : null)}
        {row('总降本提效', item.totalEfficiencyRate ? `${(item.totalEfficiencyRate * 100).toFixed(1)}%` : null)}
        {row('地区系数', item.regionCoefficient)}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 8, padding: '6px 10px', background: 'rgba(242,127,34,0.06)', borderRadius: 8, border: '1px solid rgba(242,127,34,0.15)' }}>
        <div>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>最终价值计分</span>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#F27F22', fontFamily: 'SF Mono, monospace' }}>{item.finalValueScore ? fmtF(Math.round(item.finalValueScore)) : '-'}</div>
        </div>
        <div>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>价值排名</span>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#1a3a8a', fontFamily: 'SF Mono, monospace' }}>{item.valueRank ? `#${item.valueRank}` : '-'}</div>
        </div>
      </div>
      {item.costReductionNote && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>降本说明：{item.costReductionNote}</div>}

      {/* AI后指标 */}
      {sectionTitle('AI后指标', '#1a3a8a')}
      {item.afterProcess && row('新业务流程', item.afterProcess.length > 80 ? item.afterProcess.slice(0, 80) + '…' : item.afterProcess, true)}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
        {row('新操作频次', item.afterFreq ? `${item.afterFreq}次/月` : null)}
        {row('新操作人数', item.afterPeopleCount ? `${item.afterPeopleCount}人` : null)}
        {row('新单次耗时', item.afterHoursPerTask ? `${item.afterHoursPerTask}h` : null)}
        {row('新月均耗时', item.afterMonthlyHours ? `${fmtF(Math.round(item.afterMonthlyHours))}h` : null)}
        {row('月均Token费用', item.aiCost ? `¥${fmtF(item.aiCost)}` : null)}
      </div>
    </div>
  );
}

// ── 图表/卡片悬浮明细列表 ──
function SceneHoverList({ items }: { items: WishItem[] }) {
  return (
    <div style={{ maxHeight: 300, overflowY: 'auto', width: 380 }}>
      <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['场景', '提报团队', '落地进展', '月省总工时', '复用价值', '地区'].map((h) => (
              <th key={h} style={{ padding: '4px 5px', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.3)', whiteSpace: 'nowrap', textAlign: 'left' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <td style={{ padding: '4px 5px', color: 'var(--foreground)', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title || '-'}</td>
              <td style={{ padding: '4px 5px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{item.team || '—'}</td>
              <td style={{ padding: '4px 5px' }}>
                {item.landingProgress ? <Tag color={PROGRESS_COLORS[item.landingProgress] || '#6b7280'} style={{ fontSize: 10, margin: 0, lineHeight: '16px' }}>{item.landingProgress}</Tag> : <span style={{ color: '#cbd5e1' }}>—</span>}
              </td>
              <td style={{ padding: '4px 5px', color: 'var(--text-secondary)', fontFamily: 'SF Mono, monospace', whiteSpace: 'nowrap' }}>{item.totalSavedHours || item.monthlySavedHours ? `${fmt(item.totalSavedHours || item.monthlySavedHours || 0)}h` : '—'}</td>
              <td style={{ padding: '4px 5px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{item.reuseValueLevel || '—'}</td>
              <td style={{ padding: '4px 5px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{item.regionCoefficient || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
  const [activeTab, setActiveTab] = useState('value');

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
      message.error('获取场景池数据失败');
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

  // 计算统计
  const maxCat = useMemo(() => stats ? Math.max(...Object.values(stats.categoryMap), 1) : 1, [stats]);
  const maxTeam = useMemo(() => stats ? Math.max(...Object.values(stats.teamMap), 1) : 1, [stats]);
  const totalMonthlySaved = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.totalSavedHours || item.monthlySavedHours || 0), 0);
  }, [items]);

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
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">HR AI 场景价值看板</h1>
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
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {[
            { key: 'value', label: '场景价值明细', icon: <TrophyOutlined /> },
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
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center items-center min-h-[40vh]">
          <Spin size="large" />
        </div>
      ) : (
        <>
          {activeTab === 'value' && stats && (
            <div className="space-y-6">
              {/* 统计卡片 */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  label="场景总数"
                  value={String(stats.total)}
                  sub="AI 许愿 + AI 大赛"
                  color="#1a3a8a"
                  icon={<StarOutlined />}
                />
                <MetricCard
                  label="预估月省工时"
                  value={totalMonthlySaved > 0 ? `${fmt(totalMonthlySaved)}h` : '-'}
                  sub="全部场景月均节省总工时"
                  color="#F27F22"
                  icon={<TrophyOutlined />}
                />
                <MetricCard
                  label="已落地/试点"
                  value={String((stats.progressMap['试点上线'] || 0) + (stats.progressMap['推广上线'] || 0) + (stats.progressMap['全面上线'] || 0))}
                  sub="试点 + 推广 + 全面"
                  color="#1a3a8a"
                  icon={<RocketOutlined />}
                />
                <MetricCard
                  label="评审中"
                  value={String(stats.contestMap['评审中'] || 0)}
                  sub="AI 大赛参审场景"
                  color="#F27F22"
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
                        <HBar key={team} label={team} value={count} max={maxTeam} color="#1a3a8a" />
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
                      <div className="mt-3 p-3 rounded-lg" style={{ background: 'rgba(242,127,34,0.08)', border: '1px solid rgba(242,127,34,0.2)' }}>
                        <span style={{ fontWeight: 600, fontSize: 12, color: '#F27F22' }}>
                          {stats.progressMap['未标记']} / {stats.total} 场景未标记进展
                        </span>
                        <span style={{ fontSize: 11, color: '#F27F22', marginLeft: 8, opacity: 0.8 }}>建议设为必填字段</span>
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

              {/* 全部场景价值排名 */}
              <div className="glass rounded-xl overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
                <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.3)' }}>
                  <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>场景价值排名</h3>
                  <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>按最终价值计分排名 · {ranked.length} 个有分场景</p>
                </div>
                <div className="p-5 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        {['排名', '场景', '分类', '提报团队', '落地进展', '排期计划', '价值分', '月节省'].map((h, i) => (
                          <th key={h} className={`py-2 px-3 text-xs font-medium ${i >= 6 ? 'text-right' : 'text-left'}`} style={{ color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.3)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ranked.map((item) => (
                        <Popover
                          key={item.id}
                          content={<SceneDetailPopup item={item} />}
                          trigger="hover"
                          placement="rightTop"
                          mouseEnterDelay={0.3}
                          overlayInnerStyle={{ padding: '12px 16px', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(16px)' }}
                        >
                          <tr className="hover:bg-white/20 transition-colors" style={{ cursor: 'pointer' }}>
                            <td className="py-2 px-3 font-mono text-xs" style={{ color: (item.valueRank ?? 999) <= 3 ? '#F27F22' : 'var(--text-muted)', fontWeight: (item.valueRank ?? 999) <= 3 ? 700 : 400, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                              {item.valueRank ? `#${item.valueRank}` : '-'}
                            </td>
                            <td className="py-2 px-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                              <a href={item.recordUrl} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'var(--foreground)' }}>
                                {(item.title || '-').length > 24 ? (item.title || '-').slice(0, 24) + '…' : (item.title || '-')}
                              </a>
                            </td>
                            <td className="py-2 px-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                              {item.sceneCategory && (
                                <Tag color={CATEGORY_COLORS[item.sceneCategory] || '#6b7280'} className="text-[11px]">{item.sceneCategory}</Tag>
                              )}
                            </td>
                            <td className="py-2 px-3 text-xs" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>{item.team || '—'}</td>
                            <td className="py-2 px-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                              {item.landingProgress ? (
                                <Tag color={PROGRESS_COLORS[item.landingProgress] || '#6b7280'} className="text-[11px]">{item.landingProgress}</Tag>
                              ) : (
                                <span style={{ color: '#cbd5e1', fontSize: 12 }}>—</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-xs" style={{ color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'nowrap' }}>
                              {[
                                item.plannedStartDate && `启动 ${item.plannedStartDate.slice(0, 7)}`,
                                item.pilotDate && `试点 ${item.pilotDate.slice(0, 7)}`,
                                item.rolloutDate && `推广 ${item.rolloutDate.slice(0, 7)}`,
                                item.fullLaunchDate && `全面 ${item.fullLaunchDate.slice(0, 7)}`,
                              ].filter(Boolean).join(' · ') || '—'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                              {item.finalValueScore ? fmtF(Math.round(item.finalValueScore)) : '-'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                              {item.totalSavedHours || item.monthlySavedHours ? `${fmt(item.totalSavedHours || item.monthlySavedHours || 0)}h` : '-'}
                            </td>
                          </tr>
                        </Popover>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 价值计分公式 */}
              <div className="glass rounded-xl overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
                <div className="px-5 py-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>价值计分公式</h3>
                  <div className="space-y-2 text-xs" style={{ fontFamily: 'SF Mono, monospace' }}>
                    <p><span style={{ color: '#1a3a8a', fontWeight: 600 }}>最终价值计分</span> <span style={{ color: 'var(--text-muted)' }}>=</span> <span style={{ color: 'var(--foreground)' }}>月均节省总工时 × 地区系数 × 复用系数</span></p>
                    <p><span style={{ color: '#1a3a8a', fontWeight: 600 }}>月均节省总工时</span> <span style={{ color: 'var(--text-muted)' }}>=</span> <span style={{ color: 'var(--foreground)' }}>月均提效节省工时 + 月均降本折算工时</span></p>
                    <p><span style={{ color: '#1a3a8a', fontWeight: 600 }}>月均降本折算工时</span> <span style={{ color: 'var(--text-muted)' }}>=</span> <span style={{ color: 'var(--foreground)' }}>月均降本费用 ÷ (50 × 地区系数)</span></p>
                    <p><span style={{ color: '#F27F22', fontWeight: 600 }}>地区系数</span> <span style={{ color: 'var(--text-muted)' }}>=</span> <span style={{ color: 'var(--foreground)' }}>国内 ×1 · 海外 ×2 · 全球 ×1.5</span></p>
                    <p><span style={{ color: '#F27F22', fontWeight: 600 }}>复用系数</span> <span style={{ color: 'var(--text-muted)' }}>=</span> <span style={{ color: 'var(--foreground)' }}>个人 ×1 · BU内 ×2 · 跨BU ×3 · 全集团 ×4</span></p>
                  </div>
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
                      filled: items.filter((d) => !!d.team).length,
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
                            background: gap.sev === 'critical' ? '#F27F22' : '#1a3a8a',
                          }} />
                        </div>
                        <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{gap.filled}/{gap.total}</span>
                      </div>
                      <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>{gap.impact}</p>
                      <p className="text-xs mt-1" style={{ color: '#1a3a8a' }}>→ {gap.fix}</p>
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
