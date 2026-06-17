'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Spin, App, Switch, Tabs, Tag } from 'antd';
import { SyncOutlined, TrophyOutlined, UserOutlined, BankOutlined, CodeOutlined, BookOutlined, CheckCircleOutlined, LockOutlined, AuditOutlined, RightOutlined, RocketOutlined, FireOutlined, BarChartOutlined, StarOutlined, TeamOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useAuth } from '@/lib/auth-context';
import { HARDCODED_REVIEWER_PROPOSALS } from '@/lib/constants';
import CompetitionCard from '@/components/CompetitionCard';
import HighlightSweep from '@/components/HighlightSweep';
import type { Submission } from '@/components/CompetitionCard';
import type { CompetitionReview, ReviewScores, ReviewerRole } from '@/types';

// ── 赛事进展数据类型 ──
interface ProgressEntry {
  id: string;
  recordUrl?: string;
  proposalNo?: string;
  title?: string;
  briefIntro?: string;
  sceneCategory?: string;
  coreValue?: string;
  sceneSource?: string;
  competitionProgress?: string;
  reviewPeriod?: string;
  submitter?: string[];
  teamMembers?: string[];
  team?: string;
  teamType?: string;
  aiTools?: string[];
  landingProgress?: string;
  beforeProcess?: string;
  painPoints?: string[];
  beforeFreq?: number;
  beforePeopleCount?: number;
  beforeHoursPerTask?: number;
  beforeMonthlyHours?: number;
  afterProcess?: string;
  afterFreq?: number;
  afterPeopleCount?: number;
  afterHoursPerTask?: number;
  afterMonthlyHours?: number;
  aiCost?: number;
  monthlySavedHours?: number;
  monthlySavedCost?: number;
  costSavedHours?: number;
  totalSavedHours?: number;
  totalEfficiencyRate?: number;
  regionCoefficient?: string;
  reuseValue?: string;
  reuseValueLevel?: string;
  finalValueScore?: number;
  valueRank?: number;
  implementation?: string;
  implementationLink?: string;
}

interface ProgressStats {
  total: number;
  currentPeriodCount: number;
  teamCount: number;
  totalSavedHours: number;
  categoryMap: Record<string, number>;
  teamMap: Record<string, number>;
  periodMap: Record<string, { total: number; byStatus: Record<string, number> }>;
}

// ── 颜色配置 ──
const CATEGORY_COLORS: Record<string, string> = {
  数据分析: '#1a3a8a', 招聘管理: '#F27F22', 薪酬绩效: '#2d5bc7',
  培训管理: '#4a7de0', 组织与人才发展: '#1a3a8a', 文化氛围: '#F27F22',
  核算与报账: '#2d5bc7', 基础人事支持: '#4a7de0', 行政管理: '#1a3a8a',
  日常工作: '#2d5bc7', 考勤管理: '#4a7de0',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  终审通过: { label: '已结项', color: '#16a34a' },
  评审中: { label: '评审中', color: '#1a3a8a' },
  待提交人补充方案: { label: '待补充', color: '#F27F22' },
  待提交人调整方案: { label: '待调整', color: '#F27F22' },
  并入其他方案: { label: '已合并', color: '#94a3b8' },
};

function fmt(n: number): string {
  if (n >= 1e4) return (n / 1e4).toFixed(1) + '万';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return Math.round(n).toString();
}
function fmtF(n: number): string {
  return n.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
}
function periodLabel(p: string): string {
  if (p.length === 4) {
    const m = p.slice(2);
    return `${parseInt(m)}月`;
  }
  return p;
}

// ── 子组件 ──
function MetricCard({ label, value, sub, color, icon, glow, onMouseEnter, onMouseLeave }: {
  label: string; value: string; sub?: string; color: string; icon: React.ReactNode; glow?: boolean;
  onMouseEnter?: (e: React.MouseEvent) => void; onMouseLeave?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div className="rounded-xl p-5" style={{
      border: '1px solid rgba(255,255,255,0.6)', cursor: 'pointer',
      background: hovered ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.3)',
      backdropFilter: 'blur(12px)',
      transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
      boxShadow: hovered ? '0 12px 28px rgba(26,58,138,0.12), 0 4px 12px rgba(0,0,0,0.06)' : '0 2px 8px rgba(0,0,0,0.04)',
      transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease, background 0.3s ease',
      animation: glow && !hovered ? 'breatheGlow 3s ease-in-out infinite' : 'none',
    }} onMouseEnter={(e) => { setHovered(true); onMouseEnter?.(e); }} onMouseLeave={() => { setHovered(false); onMouseLeave?.(); }}>
      <div className="flex items-center justify-between mb-2">
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
        <span style={{ color, fontSize: 14, opacity: 0.5 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1, color }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function HBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
      <span style={{ width: 100, textAlign: 'right', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 18, background: 'rgba(255,255,255,0.3)', borderRadius: 9, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 9, width: `${Math.max(pct, 1)}%`, background: `linear-gradient(90deg, ${color}, ${color}88)`, transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ width: 40, fontSize: 11, fontFamily: 'SF Mono, monospace', color: 'var(--text-secondary)', flexShrink: 0 }}>{value}</span>
    </div>
  );
}

function EntryHoverList({ items }: { items: ProgressEntry[] }) {
  return (
    <div style={{ maxHeight: 320, overflowY: 'auto', overflowX: 'auto' }}>
      <table style={{ fontSize: 11, borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
        <thead>
          <tr>
            {['方案', '团队', '状态', '月省工时'].map((h) => (
              <th key={h} style={{ padding: '4px 8px', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.3)', textAlign: 'left' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <td style={{ padding: '4px 8px', color: 'var(--foreground)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title || '-'}</td>
              <td style={{ padding: '4px 8px', color: 'var(--text-secondary)' }}>{item.team || '—'}</td>
              <td style={{ padding: '4px 8px' }}>
                {item.competitionProgress ? <Tag color={STATUS_LABELS[item.competitionProgress]?.color || '#6b7280'} style={{ fontSize: 10, margin: 0, lineHeight: '16px' }}>{item.competitionProgress}</Tag> : <span style={{ color: '#cbd5e1' }}>—</span>}
              </td>
              <td style={{ padding: '4px 8px', color: 'var(--text-secondary)', fontFamily: 'SF Mono, monospace' }}>
                {item.totalSavedHours || item.monthlySavedHours ? `${fmt(item.totalSavedHours || item.monthlySavedHours || 0)}h` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EntryDetailPopup({ item }: { item: ProgressEntry }) {
  const labelStyle: React.CSSProperties = { color: 'var(--text-muted)', fontSize: 11, whiteSpace: 'nowrap' };
  const valStyle: React.CSSProperties = { color: 'var(--foreground)', fontSize: 12, fontWeight: 500, textAlign: 'right' as const };
  const sectionTitle = (text: string, color: string) => (
    <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: `1px solid ${color}30`, paddingBottom: 4, marginBottom: 6, marginTop: 10 }}>{text}</div>
  );
  const row = (label: string, value: React.ReactNode, full?: boolean) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: '3px 0', gridColumn: full ? '1 / -1' : undefined }}>
      <span style={labelStyle}>{label}</span>
      <span style={{ ...valStyle, maxWidth: full ? 260 : 120, wordBreak: 'break-word' }}>{value || '—'}</span>
    </div>
  );
  const arr = (v: string[] | undefined) => v?.length ? v.join('、') : null;

  return (
    <div style={{ width: 380, maxHeight: 440, overflowY: 'auto', padding: '2px 0' }}>
      <div style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          {item.proposalNo && <Tag style={{ fontSize: 10, margin: 0, background: 'rgba(26,58,138,0.1)', borderColor: 'rgba(26,58,138,0.2)', color: '#1a3a8a' }}>{item.proposalNo}</Tag>}
          {item.sceneCategory && <Tag color={CATEGORY_COLORS[item.sceneCategory] || '#6b7280'} style={{ fontSize: 10, margin: 0 }}>{item.sceneCategory}</Tag>}
          {item.competitionProgress && <Tag color={STATUS_LABELS[item.competitionProgress]?.color || '#6b7280'} style={{ fontSize: 10, margin: 0 }}>{item.competitionProgress}</Tag>}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.3 }}>{item.title || '未命名方案'}</div>
        {item.briefIntro && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{item.briefIntro}</div>}
      </div>

      {sectionTitle('参赛信息', '#1a3a8a')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
        {row('提报团队', item.team)}
        {row('组队类型', item.teamType)}
        {row('提报人', arr(item.submitter))}
        {row('组队成员', arr(item.teamMembers))}
        {row('AI工具', arr(item.aiTools))}
        {row('落地进展', item.landingProgress)}
      </div>

      {sectionTitle('价值指标', '#F27F22')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
        {row('月均提效节省', item.monthlySavedHours ? `${fmtF(Math.round(item.monthlySavedHours))}h` : null)}
        {row('月均降本', item.monthlySavedCost ? `¥${fmtF(item.monthlySavedCost)}` : null)}
        {row('月省总工时', item.totalSavedHours ? `${fmtF(Math.round(item.totalSavedHours))}h` : null)}
        {row('总降本提效', item.totalEfficiencyRate ? `${(item.totalEfficiencyRate * 100).toFixed(1)}%` : null)}
        {row('复用价值', item.reuseValueLevel)}
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
    </div>
  );
}

function EntryDrillDownModal({ item, onClose }: { item: ProgressEntry; onClose: () => void }) {
  const sectionTitle = (text: string, color: string) => (
    <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: `2px solid ${color}30`, paddingBottom: 6, marginBottom: 12, marginTop: 20 }}>{text}</div>
  );
  const labelStyle: React.CSSProperties = { color: 'var(--text-muted)', fontSize: 12 };
  const valStyle: React.CSSProperties = { color: 'var(--foreground)', fontSize: 13, fontWeight: 500, textAlign: 'right' as const };
  const row = (label: string, value: React.ReactNode, full?: boolean) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, padding: '5px 0', gridColumn: full ? '1 / -1' : undefined }}>
      <span style={labelStyle}>{label}</span>
      <span style={{ ...valStyle, maxWidth: full ? 500 : 240, wordBreak: 'break-word' }}>{value || '—'}</span>
    </div>
  );
  const arr = (v: string[] | undefined) => v?.length ? v.join('、') : null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ width: '92%', maxWidth: 700, maxHeight: '85vh', background: 'rgba(255,255,255,0.98)', backdropFilter: 'blur(24px)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', animation: 'slideUp 0.3s ease-out' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #0F2057 0%, #1a3a8a 40%, #F27F22 100%)', padding: '20px 24px', color: 'white', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            {item.proposalNo && <Tag style={{ fontSize: 11, margin: 0, background: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)', color: 'white' }}>{item.proposalNo}</Tag>}
            {item.sceneCategory && <Tag style={{ fontSize: 11, margin: 0, background: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)', color: 'white' }}>{item.sceneCategory}</Tag>}
            {item.competitionProgress && <Tag style={{ fontSize: 11, margin: 0, background: 'rgba(255,255,255,0.25)', borderColor: 'rgba(255,255,255,0.4)', color: 'white' }}>{item.competitionProgress}</Tag>}
            {item.reuseValueLevel && <Tag style={{ fontSize: 11, margin: 0, background: 'rgba(242,127,34,0.3)', borderColor: 'rgba(242,127,34,0.5)', color: 'white' }}>{item.reuseValueLevel}</Tag>}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.3 }}>{item.title || '未命名方案'}</div>
          {item.briefIntro && <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>{item.briefIntro}</div>}
          <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '0 24px 24px', maxHeight: 'calc(85vh - 120px)', overflowY: 'auto' }}>
          {/* Score highlight */}
          <div style={{ display: 'flex', gap: 24, padding: '16px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            {[
              { label: '价值排名', value: item.valueRank ? `#${item.valueRank}` : '-', color: '#1a3a8a' },
              { label: '最终价值计分', value: item.finalValueScore ? fmtF(Math.round(item.finalValueScore)) : '-', color: '#F27F22' },
              { label: '月均节省总工时', value: item.totalSavedHours ? `${fmtF(Math.round(item.totalSavedHours))}h` : '-', color: '#2d5bc7' },
              { label: '总降本提效', value: item.totalEfficiencyRate ? `${(item.totalEfficiencyRate * 100).toFixed(1)}%` : '-', color: '#4a7de0' },
            ].map((m) => (
              <div key={m.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{m.label}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: m.color, fontFamily: 'SF Mono, monospace' }}>{m.value}</div>
              </div>
            ))}
          </div>

          {sectionTitle('参赛信息', '#1a3a8a')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px' }}>
            {row('核心价值', item.coreValue)}
            {row('场景来源', item.sceneSource)}
            {row('提报团队', item.team)}
            {row('组队类型', item.teamType)}
            {row('提报人', arr(item.submitter))}
            {row('组队成员', arr(item.teamMembers))}
            {row('AI工具', arr(item.aiTools))}
            {row('落地进展', item.landingProgress)}
          </div>

          {sectionTitle('AI前指标', '#1a3a8a')}
          {item.beforeProcess && row('原业务流程', item.beforeProcess, true)}
          {item.painPoints && item.painPoints.length > 0 && row('原核心痛点', item.painPoints.join('、'), true)}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px' }}>
            {row('原操作频次', item.beforeFreq ? `${item.beforeFreq}次/月` : null)}
            {row('原操作人数', item.beforePeopleCount ? `${item.beforePeopleCount}人` : null)}
            {row('单次耗时', item.beforeHoursPerTask ? `${item.beforeHoursPerTask}h` : null)}
            {row('原月均耗时', item.beforeMonthlyHours ? `${fmtF(Math.round(item.beforeMonthlyHours))}h` : null)}
          </div>

          {sectionTitle('AI后指标', '#1a3a8a')}
          {item.afterProcess && row('新业务流程', item.afterProcess, true)}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px' }}>
            {row('新操作频次', item.afterFreq ? `${item.afterFreq}次/月` : null)}
            {row('新操作人数', item.afterPeopleCount ? `${item.afterPeopleCount}人` : null)}
            {row('单次耗时', item.afterHoursPerTask ? `${item.afterHoursPerTask}h` : null)}
            {row('新月均耗时', item.afterMonthlyHours ? `${fmtF(Math.round(item.afterMonthlyHours))}h` : null)}
            {row('月均Token', item.aiCost ? `¥${fmtF(item.aiCost)}` : null)}
          </div>

          {sectionTitle('价值计分', '#F27F22')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px' }}>
            {row('月均提效节省', item.monthlySavedHours ? `${fmtF(Math.round(item.monthlySavedHours))}h` : null)}
            {row('月均降本费用', item.monthlySavedCost ? `¥${fmtF(item.monthlySavedCost)}` : null)}
            {row('降本折算工时', item.costSavedHours ? `${fmtF(Math.round(item.costSavedHours))}h` : null)}
            {row('月均节省总工时', item.totalSavedHours ? `${fmtF(Math.round(item.totalSavedHours))}h` : null)}
            {row('总降本提效', item.totalEfficiencyRate ? `${(item.totalEfficiencyRate * 100).toFixed(1)}%` : null)}
            {row('复用价值系数', item.reuseValue)}
            {row('复用价值等级', item.reuseValueLevel)}
            {row('地区系数', item.regionCoefficient)}
          </div>

          {(item.implementation || item.implementationLink) && (
            <>
              {sectionTitle('实现过程', '#2d5bc7')}
              {item.implementation && <div style={{ fontSize: 13, color: 'var(--foreground)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{item.implementation}</div>}
              {item.implementationLink && <a href={item.implementationLink} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 8, fontSize: 13, color: '#1a3a8a', textDecoration: 'underline' }}>查看实现效果 →</a>}
            </>
          )}

          {item.recordUrl && (
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              <a href={item.recordUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#1a3a8a', textDecoration: 'underline' }}>在飞书多维表格中查看 →</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// 主页面
// ══════════════════════════════════════════════
export default function CompetitionsPage() {
  const { user, isAdmin, isReviewer } = useAuth();
  const [activeTab, setActiveTab] = useState('progress');

  // ── 赛事进展 state ──
  const [progressItems, setProgressItems] = useState<ProgressEntry[]>([]);
  const [progressAllItems, setProgressAllItems] = useState<ProgressEntry[]>([]);
  const [progressPeriods, setProgressPeriods] = useState<string[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [progressStats, setProgressStats] = useState<ProgressStats | null>(null);
  const [progressLoading, setProgressLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<ProgressEntry | null>(null);
  const [hoveredEntry, setHoveredEntry] = useState<ProgressEntry | null>(null);
  const [listHover, setListHover] = useState<{ label: string; items: ProgressEntry[]; x: number; y: number } | null>(null);
  const detailTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const listTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ── 方案评审 state（原样保留）──
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [period] = useState('2605');
  const [reviews, setReviews] = useState<Record<string, { decision: string; scores?: ReviewScores; reason: string; reviewer_role?: ReviewerRole | null }>>({});
  const [reviewerRole, setReviewerRole] = useState<ReviewerRole | null>(null);
  const [roleLocked, setRoleLocked] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const [onlyPending, setOnlyPending] = useState(false);
  const { message } = App.useApp();

  // ── 赛事进展：获取数据 ──
  const fetchProgress = async () => {
    setProgressLoading(true);
    try {
      const res = await fetch('/api/competitions/progress');
      if (!res.ok) throw new Error('获取失败');
      const data = await res.json();
      setProgressAllItems(data.allItems || []);
      setProgressItems(data.items || []);
      setProgressPeriods(data.periods || []);
      setSelectedPeriod(data.currentPeriod || '');
      setProgressStats(data.stats);
    } catch {
      message.error('获取赛事进展数据失败');
    } finally {
      setProgressLoading(false);
    }
  };

  useEffect(() => { fetchProgress(); }, []);

  // 切换期数时重新过滤
  useEffect(() => {
    if (!selectedPeriod || progressAllItems.length === 0) return;
    const filtered = progressAllItems.filter((d) => d.reviewPeriod === selectedPeriod);
    setProgressItems(filtered);
    // 重新计算当期统计
    const categoryMap: Record<string, number> = {};
    const teamMap: Record<string, number> = {};
    filtered.forEach((d) => {
      const cat = d.sceneCategory || '未分类';
      categoryMap[cat] = (categoryMap[cat] || 0) + 1;
      const team = d.team || '未填写';
      teamMap[team] = (teamMap[team] || 0) + 1;
    });
    const totalSaved = filtered.reduce((s, d) => s + (d.totalSavedHours || d.monthlySavedHours || 0), 0);
    setProgressStats((prev) => prev ? {
      ...prev,
      currentPeriodCount: filtered.length,
      totalSavedHours: totalSaved,
      teamCount: Object.keys(teamMap).filter((t) => t !== '未填写').length,
      categoryMap,
      teamMap,
    } : prev);
  }, [selectedPeriod, progressAllItems]);

  // 排名排序
  const rankedEntries = useMemo(() => {
    return [...progressItems].sort((a, b) => {
      const sa = a.finalValueScore ?? a.totalSavedHours ?? a.monthlySavedHours ?? 0;
      const sb = b.finalValueScore ?? b.totalSavedHours ?? b.monthlySavedHours ?? 0;
      return sb - sa;
    });
  }, [progressItems]);

  const maxCat = useMemo(() => progressStats ? Math.max(...Object.values(progressStats.categoryMap), 1) : 1, [progressStats]);
  const maxTeam = useMemo(() => progressStats ? Math.max(...Object.values(progressStats.teamMap), 1) : 1, [progressStats]);

  // hover handlers
  const handleRowEnter = (item: ProgressEntry) => { clearTimeout(detailTimer.current); setHoveredEntry(item); };
  const handleRowLeave = () => { detailTimer.current = setTimeout(() => setHoveredEntry(null), 200); };
  const showListHover = (label: string, hoverItems: ProgressEntry[]) => (e: React.MouseEvent) => {
    clearTimeout(listTimer.current);
    let x = e.clientX + 15;
    let y = e.clientY + 15;
    if (x + 500 > window.innerWidth - 16) x = e.clientX - 500 - 15;
    if (y + 360 > window.innerHeight - 16) y = window.innerHeight - 360 - 16;
    setListHover({ label, items: hoverItems, x, y });
  };
  const hideListHover = () => { listTimer.current = setTimeout(() => setListHover(null), 200); };

  // ── 方案评审：原样保留 ──
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/competitions/sync?period=${period}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setItems((data.items ?? [])
        .filter((i: Submission) => i.status === '评审中')
        .sort((a: Submission, b: Submission) => (a.sceneCategory ?? '').localeCompare(b.sceneCategory ?? '', 'zh-CN')),
      );
      setLoaded(true);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    message.loading({ content: '正在从飞书同步，附件较多时可能需要几分钟…', key: 'sync', duration: 0 });
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5 * 60 * 1000);
      const res = await fetch(`/api/competitions/sync?period=${period}`, { method: 'POST', signal: controller.signal });
      clearTimeout(timer);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const attMsg = data.attachments ? `（附件：${data.attachments.downloaded} 新下载，${data.attachments.skipped} 已跳过）` : '';
      message.success({ content: `已同步 ${data.synced} 条方案${attMsg}`, key: 'sync' });
      await fetchData();
    } catch (err) {
      const msg = err instanceof DOMException && err.name === 'AbortError' ? '同步超时，请稍后重试' : err instanceof Error ? err.message : '同步失败';
      message.error({ content: msg, key: 'sync' });
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => { fetchData(); }, [period]);

  useEffect(() => {
    if (isReviewer) {
      fetch('/api/competitions/reviews?mine=true')
        .then(async (r) => {
          const data = await r.json();
          if (!r.ok) throw new Error(data.error || '加载评审记录失败');
          return data;
        })
        .then((data) => {
          const reviewsList: CompetitionReview[] = data.reviews ?? [];
          const LEGACY_MAP: Record<string, keyof ReviewScores> = { scenario: 'productEffectiveness', painPoint: 'dataConsistency', effectiveness: 'productUsability' };
          const map: Record<string, { decision: string; scores?: ReviewScores; reason: string; reviewer_role?: ReviewerRole | null }> = {};
          reviewsList.forEach((r) => {
            let scores = r.scores;
            if (scores) {
              const migrated: ReviewScores = {};
              for (const [k, v] of Object.entries(scores)) { migrated[LEGACY_MAP[k] ?? (k as keyof ReviewScores)] = v as number; }
              scores = migrated;
            }
            map[r.submission_id] = { decision: r.decision, scores, reason: r.reason, reviewer_role: r.reviewer_role };
          });
          setReviews(map);
          const reviewed = reviewsList.filter((r) => r.decision === 'reviewed' && r.reviewer_role);
          if (reviewed.length > 0) { setReviewerRole(reviewed[0].reviewer_role!); setRoleLocked(true); }
          else {
            const assignedRoles = user?.reviewer_roles || [];
            if (assignedRoles.length === 1) { setReviewerRole(assignedRoles[0] as ReviewerRole); setRoleLocked(true); }
            else if (assignedRoles.length > 1) { setReviewerRole(assignedRoles[0] as ReviewerRole); setRoleLocked(false); }
          }
        })
        .catch((err) => { console.error('[评审加载失败]', err); message.error(err.message || '加载评审记录失败'); });
    }
  }, [isReviewer, user]);

  const handleReview = async (submissionId: string, scores: ReviewScores, reviewerRole: ReviewerRole, reason?: string) => {
    try {
      const item = items.find((i) => i.id === submissionId);
      const res = await fetch('/api/competitions/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission_id: submissionId, scores, reviewer_role: reviewerRole, reason, proposal_no: item?.proposalNo ?? null, title: item?.title ?? '' }),
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error); }
      const data = await res.json();
      setReviews((prev) => ({ ...prev, [submissionId]: { decision: data.review.decision, scores: data.review.scores, reason: data.review.reason, reviewer_role: data.review.reviewer_role } }));
      setRoleLocked(true);
      message.success('评分已保存');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '评审失败');
    }
  };

  const userName = user?.name ?? '';
  const hardcodedTitles = HARDCODED_REVIEWER_PROPOSALS[userName] ?? [];
  const roleFiltered = reviewerRole === 'user'
    ? items.filter((i) => (userName && i.reviewers?.some((r: string) => r.includes(userName) || userName.includes(r))) || hardcodedTitles.some((t) => i.title?.includes(t)))
    : items;
  const reviewsLoaded = Object.keys(reviews).length > 0;
  const pendingCount = roleFiltered.filter((i) => reviews[i.id]?.decision !== 'reviewed').length;
  const displayItems = onlyPending && reviewsLoaded && pendingCount > 0 ? roleFiltered.filter((i) => reviews[i.id]?.decision !== 'reviewed') : roleFiltered;

  return (
    <>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* 页面标题 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #d46b08, #f27f22)', color: '#fff' }}>
              <TrophyOutlined />
            </span>
            <HighlightSweep text="HRAS AI 应用大赛" className="text-2xl font-bold" gradient="linear-gradient(135deg, #d46b08 0%, #f27f22 50%, #fa8c16 100%)" />
          </div>
          {isAdmin && (
            <a href="/admin/cho-dashboard" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #16a34a, #0891b2)', boxShadow: '0 4px 15px rgba(22,163,74,0.25)' }}>
              <BarChartOutlined /> 成效看板
            </a>
          )}
        </div>

        <Tabs defaultActiveKey="progress" activeKey={activeTab} onChange={setActiveTab} items={[
          {
            key: 'progress',
            label: <span className="flex items-center gap-1.5 text-sm font-semibold px-1"><FireOutlined />赛事进展</span>,
            children: (
              <div className="flex flex-col gap-5 mt-1">
                {progressLoading ? (
                  <div className="flex justify-center py-16"><Spin size="large" /></div>
                ) : progressStats ? (<>
                  {/* 精简横幅 */}
                  <div className="relative overflow-hidden rounded-xl px-5 py-4 sm:px-6 sm:py-5 flex items-center justify-between gap-4"
                    style={{ background: 'linear-gradient(135deg, #0F2057 0%, #1a3a8a 40%, #F27F22 100%)', boxShadow: '0 6px 30px rgba(26, 58, 138, 0.2)' }}>
                    <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full" style={{ background: 'rgba(255,255,255,0.05)', filter: 'blur(2px)' }} />
                    <div className="relative z-10 flex items-center gap-3">
                      <span className="text-2xl shrink-0" style={{ filter: 'drop-shadow(0 2px 8px rgba(242, 127, 34, 0.4))' }}>🏆</span>
                      <div>
                        <h3 className="text-base font-bold" style={{ color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>
                          AI大赛 · 数据概览
                          {selectedPeriod && <span className="ml-2 text-xs font-normal" style={{ color: 'rgba(255,255,255,0.7)' }}>{periodLabel(selectedPeriod)}</span>}
                        </h3>
                        <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.75)' }}>
                          {progressStats.total} 个参赛方案 · {progressStats.teamCount} 个团队
                        </p>
                      </div>
                    </div>
                    <div className="relative z-10 flex items-center gap-2 shrink-0">
                      <a href="https://ztn.feishu.cn/share/base/form/shrcnzpkRvRFdo6359hFYfCTpZg" target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold"
                        style={{ background: '#fff', color: '#1a3a8a', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
                        <RocketOutlined />提报入口
                      </a>
                      <a href="https://finebyme99.github.io/hras-2026/" target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
                        style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}>
                        大赛主页 <RightOutlined style={{ fontSize: 10 }} />
                      </a>
                    </div>
                  </div>

                  {/* 4 指标卡 */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard label="参赛方案" value={String(progressStats.currentPeriodCount)} sub={progressStats.total !== progressStats.currentPeriodCount ? `总计 ${progressStats.total} 个` : undefined} color="#1a3a8a" icon={<StarOutlined />}
                      onMouseEnter={showListHover('参赛方案', progressItems)} onMouseLeave={hideListHover} />
                    <MetricCard label="参赛团队" value={String(progressStats.teamCount)} sub="当期去重团队数" color="#F27F22" icon={<TeamOutlined />} />
                    <MetricCard label="预估月省工时" value={progressStats.totalSavedHours > 0 ? `${fmt(progressStats.totalSavedHours)}h` : '-'} sub="当期方案月均节省总工时" color="#2d5bc7" icon={<TrophyOutlined />} glow
                      onMouseEnter={showListHover('月省工时', progressItems.filter((d) => d.totalSavedHours || d.monthlySavedHours))} onMouseLeave={hideListHover} />
                    <MetricCard label="评审进度" value={(() => {
                      const p = progressStats.periodMap[selectedPeriod];
                      if (!p) return '-';
                      const done = p.byStatus['终审通过'] || 0;
                      return `${done}/${p.total}`;
                    })()} sub="终审通过 / 当期总数" color="#1a3a8a" icon={<ClockCircleOutlined />} />
                  </div>

                  {/* 赛事时间线 */}
                  {progressPeriods.length > 1 && (
                    <div className="glass rounded-xl p-5" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
                      <h3 className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--text-muted)' }}>赛事时间线</h3>
                      <div className="flex items-center gap-0 relative">
                        {/* 连接线 */}
                        <div className="absolute left-0 right-0 top-5 h-0.5" style={{ background: 'rgba(26,58,138,0.12)' }} />
                        {progressPeriods.map((p, i) => {
                          const info = progressStats.periodMap[p];
                          const isActive = p === selectedPeriod;
                          const isLast = i === progressPeriods.length - 1;
                          const done = info?.byStatus['终审通过'] || 0;
                          const reviewing = info?.byStatus['评审中'] || 0;
                          const statusLabel = done === (info?.total || 0) ? '已结项' : reviewing > 0 ? '评审中' : done > 0 ? '部分结项' : '进行中';
                          const statusColor = done === (info?.total || 0) ? '#16a34a' : reviewing > 0 ? '#1a3a8a' : '#F27F22';
                          return (
                            <div key={p} className="flex-1 flex flex-col items-center cursor-pointer relative z-10" onClick={() => setSelectedPeriod(p)}>
                              <div style={{
                                width: isActive ? 40 : 32, height: isActive ? 40 : 32, borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: isActive ? 'linear-gradient(135deg, #1a3a8a, #2d5bc7)' : 'rgba(255,255,255,0.8)',
                                border: isActive ? '3px solid #F27F22' : `2px solid ${statusColor}40`,
                                boxShadow: isActive ? '0 4px 16px rgba(26,58,138,0.3)' : 'none',
                                transition: 'all 0.3s ease',
                                color: isActive ? '#fff' : statusColor,
                              }}>
                                <span style={{ fontSize: isActive ? 14 : 12, fontWeight: 700, fontFamily: 'SF Mono, monospace' }}>{periodLabel(p)}</span>
                              </div>
                              <div className="mt-2 text-center">
                                <div style={{ fontSize: 10, fontWeight: 600, color: isActive ? 'var(--foreground)' : 'var(--text-muted)' }}>{statusLabel}</div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{info?.total || 0} 个方案</div>
                              </div>
                              {!isLast && <div />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 图表区：2 列 */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* 场景分类分布 */}
                    <div className="glass rounded-xl overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
                      <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.3)' }}>
                        <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>场景分类分布</h3>
                        <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>当期各职能领域的参赛分布</p>
                      </div>
                      <div className="p-5">
                        {Object.entries(progressStats.categoryMap).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                          <div key={cat} onMouseEnter={showListHover(cat, progressItems.filter((d) => d.sceneCategory === cat))} onMouseLeave={hideListHover} style={{ cursor: 'pointer' }}>
                            <HBar label={cat} value={count} max={maxCat} color={CATEGORY_COLORS[cat] || '#6b7280'} />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 团队参赛分布 */}
                    <div className="glass rounded-xl overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
                      <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.3)' }}>
                        <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>团队参赛分布</h3>
                        <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>当期各团队的方案提交情况</p>
                      </div>
                      <div className="p-5">
                        {Object.entries(progressStats.teamMap).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([team, count]) => (
                          <div key={team} onMouseEnter={showListHover(team, progressItems.filter((d) => d.team === team))} onMouseLeave={hideListHover} style={{ cursor: 'pointer' }}>
                            <HBar label={team} value={count} max={maxTeam} color="#1a3a8a" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 当期方案排名表 */}
                  <div className="glass rounded-xl overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
                    <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.3)' }}>
                      <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>当期方案一览</h3>
                      <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>按价值计分排名 · {rankedEntries.length} 个方案</p>
                    </div>
                    <div className="p-5 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr>
                            {['排名', '方案', '分类', '团队', '状态', '价值分', '月省工时'].map((h, i) => (
                              <th key={h} className={`py-2 px-3 text-xs font-medium ${i >= 5 ? 'text-right' : 'text-left'}`} style={{ color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.3)' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rankedEntries.map((item, idx) => (
                            <tr key={item.id} className="hover:bg-white/20 transition-colors" style={{ cursor: 'pointer' }} onClick={() => setSelectedEntry(item)}>
                              <td className="py-2 px-3 font-mono text-xs" style={{
                                color: idx < 3 ? '#F27F22' : 'var(--text-muted)',
                                fontWeight: idx < 3 ? 700 : 400,
                                borderBottom: '1px solid rgba(255,255,255,0.1)',
                              }}>{idx + 1}</td>
                              <td className="py-2 px-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
                                onMouseEnter={() => handleRowEnter(item)} onMouseLeave={handleRowLeave}>
                                <span className="hover:underline" style={{ color: 'var(--foreground)', cursor: 'pointer' }}>
                                  {(item.title || '-').length > 24 ? (item.title || '-').slice(0, 24) + '…' : (item.title || '-')}
                                </span>
                              </td>
                              <td className="py-2 px-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                {item.sceneCategory ? <Tag color={CATEGORY_COLORS[item.sceneCategory] || '#6b7280'} className="text-[11px]">{item.sceneCategory}</Tag> : <span style={{ color: '#cbd5e1', fontSize: 12 }}>—</span>}
                              </td>
                              <td className="py-2 px-3 text-xs" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>{item.team || '—'}</td>
                              <td className="py-2 px-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                {item.competitionProgress ? <Tag color={STATUS_LABELS[item.competitionProgress]?.color || '#6b7280'} className="text-[11px]">{item.competitionProgress}</Tag> : <span style={{ color: '#cbd5e1', fontSize: 12 }}>—</span>}
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
                </>) : (
                  <div className="text-center py-12 glass rounded-2xl" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>暂无参赛数据</p>
                  </div>
                )}
              </div>
            ),
          },
          {
            key: 'review',
            label: <span className="flex items-center gap-1.5 text-sm font-semibold px-1"><AuditOutlined />方案评审</span>,
            children: (
              <>
                {/* 工具栏 */}
                <div className="flex items-center justify-between mb-6 mt-1">
                  <div className="flex items-center gap-3">
                    <div>
                      <h3 className="text-base font-bold flex items-center gap-2.5" style={{ color: 'var(--foreground)' }}>
                        5月参赛方案
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                          style={{ background: 'rgba(242, 127, 34, 0.1)', color: '#b3540e' }}>
                          {period}
                        </span>
                      </h3>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {loaded ? `${displayItems.length} 条方案` : '加载中...'}
                        {loaded && displayItems.length > 0 && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
                            style={{ background: 'rgba(242, 127, 34, 0.08)', color: '#b3540e' }}>
                            按场景分类排列
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a href="https://ztn.feishu.cn/share/base/form/shrcnzpkRvRFdo6359hFYfCTpZg" target="_blank" rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105"
                      style={{ background: 'var(--accent)', color: '#fff' }}>
                      参与提报
                    </a>
                    <a href="https://ztn.feishu.cn/share/base/form/shrcnzQxxexe7eyuztTiCydTdz7" target="_blank" rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105"
                      style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(12px)', color: 'var(--primary)', border: '1px solid rgba(26,58,138,0.15)' }}>
                      参与许愿
                    </a>
                    {isAdmin && (
                      <button onClick={handleSync} disabled={syncing}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all hover:scale-105 disabled:opacity-50"
                        style={{ background: 'var(--primary)', boxShadow: '0 4px 15px rgba(26,58,138,0.25)' }}>
                        <SyncOutlined spin={syncing} /> 从飞书同步
                      </button>
                    )}
                  </div>
                </div>

                {/* 评委角色 + 评审进度 */}
                {isReviewer && loaded && items.length > 0 && (
                  <div className="mb-5">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 rounded-xl mb-3"
                      style={{ background: 'rgba(26,58,138,0.04)', border: '1px solid rgba(26,58,138,0.08)' }}>
                      <span className="text-xs font-semibold" style={{ color: 'var(--primary)' }}>我的角色</span>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const assignedRoles = user?.reviewer_roles || [];
                          const roleButtons = [
                            { key: 'user' as ReviewerRole, label: '用户评委', icon: <UserOutlined /> },
                            { key: 'business' as ReviewerRole, label: '业务评委', icon: <BankOutlined /> },
                            { key: 'tech' as ReviewerRole, label: '技术评委', icon: <CodeOutlined /> },
                          ];
                          if (assignedRoles.length === 0 && !isAdmin) return null;
                          const availableRoles = isAdmin ? roleButtons : roleButtons.filter((r) => assignedRoles.includes(r.key));
                          return availableRoles.map((r) => (
                            <button key={r.key} onClick={() => !roleLocked && setReviewerRole(r.key)} disabled={roleLocked}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                              style={{
                                background: reviewerRole === r.key ? 'var(--primary)' : 'rgba(255,255,255,0.6)',
                                color: reviewerRole === r.key ? '#fff' : 'var(--text-secondary)',
                                border: reviewerRole === r.key ? 'none' : '1px solid rgba(26,58,138,0.12)',
                                boxShadow: reviewerRole === r.key ? '0 4px 12px rgba(26,58,138,0.25)' : 'none',
                              }}>
                              {r.icon} {r.label}
                            </button>
                          ));
                        })()}
                        {roleLocked && <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{user?.reviewer_roles?.length === 1 ? '角色已由管理员指定' : '角色已锁定'}</span>}
                        {!reviewerRole && (user?.reviewer_roles?.length ?? 0) === 0 && !isAdmin && (
                          <span className="text-[11px]" style={{ color: '#b3540e' }}>暂未分配评委角色，请联系管理员</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center px-4 py-2 rounded-xl text-xs"
                      style={{ background: 'rgba(26,58,138,0.015)', border: '1px solid rgba(26,58,138,0.04)' }}>
                      <a href="https://ztn.feishu.cn/docx/NvPAdv4MhojKAxxMHAlctD9knhc" target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 hover:opacity-70 transition-opacity" style={{ color: 'var(--primary)' }}>
                        <BookOutlined /> 点击查看评审指南
                      </a>
                    </div>
                  </div>
                )}

                {/* 评审进度条 */}
                {activeTab === 'review' && isReviewer && loaded && displayItems.length > 0 && (() => {
                  const reviewedCount = roleFiltered.filter((i) => reviews[i.id]?.decision === 'reviewed').length;
                  const pending = roleFiltered.length - reviewedCount;
                  return (
                    <div className="fixed left-0 right-0 z-40 flex justify-center pointer-events-none" style={{ top: '56px' }}>
                      <div className="flex items-center gap-4 px-5 py-2 rounded-full text-xs pointer-events-auto max-w-3xl mx-4"
                        style={{ background: 'rgba(245,240,235,0.9)', backdropFilter: 'blur(16px)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid rgba(255,255,255,0.6)' }}>
                        <span className="font-semibold" style={{ color: 'var(--primary)' }}>评审进度</span>
                        <span style={{ color: 'var(--text-secondary)' }}>待审 <b style={{ color: 'var(--foreground)' }}>{pending}</b></span>
                        <span style={{ color: '#16a34a' }}>已评 <b>{reviewedCount}</b></span>
                        <span style={{ color: 'var(--text-muted)' }}>共 {displayItems.length}</span>
                        <span className="flex items-center gap-1.5 border-l pl-3" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                          <Switch size="small" checked={onlyPending} onChange={setOnlyPending} />
                          <span style={{ color: 'var(--text-secondary)' }}>未评审</span>
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {loading && <div className="flex justify-center py-12"><Spin size="large" /></div>}

                {!loading && loaded && displayItems.length === 0 && (
                  <div className="text-center py-12 glass rounded-2xl" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {reviewerRole === 'user' ? '暂无分配给您的评审方案，请联系管理员分配' : '暂无参赛方案，点击「从飞书同步」导入数据'}
                    </p>
                  </div>
                )}

                {displayItems.length > 0 && (
                  <div className="flex flex-col gap-4">
                    {displayItems.map((item) => (
                      <CompetitionCard key={item.id} data={item} isReviewer={isReviewer} reviewerRole={reviewerRole} existingReview={reviews[item.id] || null} onReview={handleReview} />
                    ))}
                    {isReviewer && reviewerRole && (() => {
                      const reviewedCount = displayItems.filter((i) => reviews[i.id]?.decision === 'reviewed').length;
                      const allDone = reviewedCount === displayItems.length;
                      const canFinalize = allDone && !finalized;
                      return (
                        <div className="flex items-center justify-center gap-3 pt-2 pb-1">
                          <button disabled={!canFinalize}
                            onClick={() => { setFinalized(true); setRoleLocked(true); message.success('评分已定稿，角色已锁定'); }}
                            className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105 disabled:hover:scale-100 disabled:cursor-not-allowed"
                            style={{
                              background: finalized ? 'rgba(22,163,74,0.1)' : canFinalize ? 'var(--primary)' : 'rgba(0,0,0,0.06)',
                              color: finalized ? '#16a34a' : canFinalize ? '#fff' : 'var(--text-muted)',
                              boxShadow: canFinalize ? '0 4px 16px rgba(26,58,138,0.3)' : 'none',
                              border: finalized ? '1px solid rgba(22,163,74,0.2)' : 'none',
                            }}>
                            {finalized ? <><CheckCircleOutlined className="mr-1.5" />已定稿</> : allDone ? <><LockOutlined className="mr-1.5" />提交定稿</> : `待评审完成 (${reviewedCount}/${displayItems.length})`}
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </>
            ),
          },
        ].filter((tab) => tab.key !== 'review' || isAdmin || isReviewer)} />
      </div>

      {/* 动画 + Tabs 样式 */}
      <style jsx global>{`
        @keyframes breatheGlow {
          0%, 100% { box-shadow: 0 2px 8px rgba(0,0,0,0.04), 0 0 0 0 rgba(242,127,34,0); }
          50% { box-shadow: 0 2px 8px rgba(0,0,0,0.04), 0 0 16px 4px rgba(242,127,34,0.12); }
        }
        @keyframes slideUp {
          from { transform: translateY(24px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .ant-tabs-ink-bar { background: var(--primary) !important; }
        .ant-tabs-tab.ant-tabs-tab-active .ant-tabs-tab-btn { color: var(--primary) !important; }
        .ant-tabs-tab:not(.ant-tabs-tab-active) .ant-tabs-tab-btn { color: var(--text-secondary) !important; }
        .ant-tabs-tab:not(.ant-tabs-tab-active):hover .ant-tabs-tab-btn { color: var(--primary) !important; }
        .ant-tabs-nav::before { border-bottom-color: rgba(26, 58, 138, 0.08) !important; }
      `}</style>

      {/* 方案排名表悬浮详情弹窗 */}
      {hoveredEntry && (
        <div style={{ position: 'fixed', top: '50%', left: '55%', transform: 'translate(-50%, -50%)', zIndex: 1050, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px)', borderRadius: 14, padding: '16px 20px', boxShadow: '0 12px 48px rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.7)', maxWidth: 440 }}
          onMouseEnter={() => clearTimeout(detailTimer.current)} onMouseLeave={handleRowLeave}>
          <EntryDetailPopup item={hoveredEntry} />
        </div>
      )}

      {/* 图表/卡片悬浮明细列表 */}
      {listHover && (
        <div style={{ position: 'fixed', left: listHover.x, top: listHover.y, zIndex: 1050, pointerEvents: 'none', background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px)', borderRadius: 10, padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.14)', border: '1px solid rgba(255,255,255,0.6)', maxWidth: 520 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#1a3a8a', marginBottom: 6 }}>{listHover.label} · {listHover.items.length} 个方案</div>
          <EntryHoverList items={listHover.items} />
        </div>
      )}

      {/* 点击下钻详情弹窗 */}
      {selectedEntry && <EntryDrillDownModal item={selectedEntry} onClose={() => setSelectedEntry(null)} />}
    </>
  );
}
