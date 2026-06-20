'use client';

import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ChoDashboard from '@/components/ChoDashboard';
import { Spin, App, Tabs, Tag } from 'antd';
import {
  TrophyOutlined,
  TeamOutlined,
  StarOutlined,
  ClockCircleOutlined,
  FireOutlined,
  BarChartOutlined,
  RiseOutlined,
  BulbOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/lib/auth-context';
import HighlightSweep from '@/components/HighlightSweep';
import { PAGE_LABELS } from '@/lib/bitable/page-usage';
import {
  buildCategoryColorMap, buildStatusColorMap,
  FALLBACK_COLOR,
} from '@/lib/bitable/enums';
import type { FieldSelectOption } from '@/lib/bitable/field-map';

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

function fmt(n: number): string {
  if (n >= 1e4) return (n / 1e4).toFixed(1) + '万';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return Math.round(n).toString();
}
function fmtF(n: number): string {
  return n.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
}
// 大赛进展标签文本映射（仅2项特殊文本替换，其余保持原文）
const STATUS_TEXT: Record<string, string> = { '终审通过': '已结项' };
function periodLabel(p: string): string {
  if (p.length === 4) {
    const m = p.slice(2);
    return `${parseInt(m)}月`;
  }
  return p;
}

// ── 方案详情弹窗 ──
function EntryDrillDownModal({ item, categoryColors, statusColors, onClose }: { item: ProgressEntry; categoryColors: Record<string, string>; statusColors: Record<string, string>; onClose: () => void }) {
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
            {item.proposalNo && <Tag style={{ fontSize: 11, margin: 0, background: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)', color: 'white' }}>#{item.proposalNo}</Tag>}
            {item.sceneCategory && <Tag style={{ fontSize: 11, margin: 0, background: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)', color: 'white' }}>{item.sceneCategory}</Tag>}
            {item.competitionProgress && <Tag style={{ fontSize: 11, margin: 0, background: 'rgba(255,255,255,0.25)', borderColor: 'rgba(255,255,255,0.4)', color: 'white' }}>{STATUS_TEXT[item.competitionProgress] || item.competitionProgress}</Tag>}
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
              { label: '月均节省总工时', value: item.totalSavedHours ? `${fmtF(Math.round(item.totalSavedHours))}h` : '-', color: '#16a34a' },
              { label: '总降本提效', value: item.totalEfficiencyRate ? `${(item.totalEfficiencyRate * 100).toFixed(1)}%` : '-', color: '#1a3a8a' },
              { label: '复用价值等级', value: item.reuseValueLevel || '-', color: '#F27F22' },
            ].map((m) => (
              <div key={m.label} style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{m.label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>

          {sectionTitle('参赛信息', '#1a3a8a')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px' }}>
            {row('核心价值', item.coreValue)}
            {row('提报团队', item.team)}
            {row('组队类型', item.teamType)}
            {row('AI工具', arr(item.aiTools))}
            {row('落地进展', item.landingProgress)}
          </div>

          {sectionTitle('改造前后对比', '#2d5bc7')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px' }}>
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>改造前 · 月均耗时</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#b45309' }}>{item.beforeMonthlyHours ? `${fmtF(Math.round(item.beforeMonthlyHours))}h` : '-'}</div>
              {item.beforePeopleCount && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.beforePeopleCount}人参与</div>}
            </div>
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>改造后 · 月均耗时</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}>{item.afterMonthlyHours ? `${fmtF(Math.round(item.afterMonthlyHours))}h` : '-'}</div>
              {item.afterPeopleCount && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.afterPeopleCount}人参与</div>}
            </div>
          </div>
          {item.painPoints && item.painPoints.length > 0 && row('原核心痛点', item.painPoints.join('、'), true)}

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

// ── 亮点方案卡片 ──
function SpotlightCard({ item, rank, categoryColors, onClick }: { item: ProgressEntry; rank: number; categoryColors: Record<string, string>; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const catColor = categoryColors[item.sceneCategory || ''] || FALLBACK_COLOR;

  const rankBg = rank === 1 ? 'linear-gradient(135deg, #F27F22, #d46b08)' : rank === 2 ? 'linear-gradient(135deg, #1a3a8a, #2d5bc7)' : 'linear-gradient(135deg, #2d5bc7, #4a7de0)';
  const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉';

  return (
    <div
      className="rounded-xl cursor-pointer"
      style={{
        border: '1px solid rgba(255,255,255,0.6)',
        background: hovered ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.3)',
        backdropFilter: 'blur(12px)',
        transform: hovered ? 'translateY(-6px)' : 'translateY(0)',
        boxShadow: hovered ? `0 16px 40px rgba(26,58,138,0.15), 0 6px 16px rgba(0,0,0,0.08)` : '0 2px 8px rgba(0,0,0,0.04)',
        transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease, background 0.3s ease',
        overflow: 'hidden',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      {/* 排名 + 场景标签 */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
        <div className="flex items-center gap-2">
          <span style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: rankBg, color: '#fff', fontSize: 14, fontWeight: 700, boxShadow: `0 4px 12px ${rank === 1 ? 'rgba(242,127,34,0.3)' : 'rgba(26,58,138,0.25)'}` }}>{rankEmoji}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Top {rank}</span>
        </div>
        <Tag style={{ fontSize: 11, margin: 0, background: `${catColor}15`, borderColor: `${catColor}30`, color: catColor }}>{item.sceneCategory || '未分类'}</Tag>
      </div>

      {/* 方案标题 + 简介 */}
      <div className="px-5 py-4">
        <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.4, marginBottom: 6 }}>{item.title || '未命名方案'}</h4>
        {item.briefIntro && <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 0 }}>{item.briefIntro.length > 60 ? item.briefIntro.slice(0, 60) + '…' : item.briefIntro}</p>}
      </div>

      {/* 关键数据 */}
      <div className="flex items-center justify-between px-5 pb-4 gap-4">
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>月省总工时</div>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'SF Mono, monospace', color: '#16a34a' }}>
            {item.totalSavedHours || item.monthlySavedHours ? `${fmt(item.totalSavedHours || item.monthlySavedHours || 0)}h` : '-'}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>降本提效</div>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'SF Mono, monospace', color: '#1a3a8a' }}>
            {item.totalEfficiencyRate ? `${(item.totalEfficiencyRate * 100).toFixed(0)}%` : '-'}
          </div>
        </div>
        <div style={{ flex: 1, textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>提报团队</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{item.team || '—'}</div>
        </div>
      </div>

      {/* AI 工具 + 复用价值 */}
      <div className="flex items-center justify-between px-5 pb-4 pt-0" style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }}>
        <div className="flex items-center gap-1">
          {item.aiTools && item.aiTools.slice(0, 3).map((t) => (
            <Tag key={t} style={{ fontSize: 10, margin: 0, background: 'rgba(26,58,138,0.06)', borderColor: 'rgba(26,58,138,0.12)', color: '#1a3a8a' }}>{t}</Tag>
          ))}
        </div>
        {item.reuseValueLevel && (
          <span style={{ fontSize: 11, fontWeight: 600, color: '#F27F22' }}>
            {item.reuseValueLevel}
          </span>
        )}
      </div>
    </div>
  );
}

// ── 场景分类卡片 ──
function CategoryCard({ category, count, maxCount, items, categoryColors, onClick }: { category: string; count: number; maxCount: number; items: ProgressEntry[]; categoryColors: Record<string, string>; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const color = categoryColors[category] || FALLBACK_COLOR;
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;

  // 计算该分类的总省工时
  const savedHours = items.reduce((s, d) => s + (d.totalSavedHours || d.monthlySavedHours || 0), 0);

  return (
    <div
      className="rounded-xl cursor-pointer"
      style={{
        border: `1px solid ${color}30`,
        background: hovered ? `${color}15` : `${color}08`,
        backdropFilter: 'blur(8px)',
        transition: 'all 0.25s ease',
        overflow: 'hidden',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span style={{ fontSize: 14, fontWeight: 700, color }}>{category}</span>
          <span style={{ fontSize: 20, fontWeight: 800, fontFamily: 'SF Mono, monospace', color }}>{count}</span>
        </div>
        {/* 进度条 */}
        <div style={{ height: 4, background: `${color}20`, borderRadius: 2, marginBottom: 8 }}>
          <div style={{ height: '100%', borderRadius: 2, width: `${Math.max(pct, 2)}%`, background: `linear-gradient(90deg, ${color}, ${color}88)`, transition: 'width 0.6s ease' }} />
        </div>
        <div className="flex items-center justify-between">
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>个方案</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
            {savedHours > 0 ? `月省 ${fmt(savedHours)}h` : ''}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── 指标卡 ──
function MetricCard({ label, value, sub, color, icon, glow }: {
  label: string; value: string; sub?: string; color: string; icon: React.ReactNode; glow?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div className="rounded-xl p-5" style={{
      border: '1px solid rgba(255,255,255,0.6)',
      background: hovered ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.3)',
      backdropFilter: 'blur(12px)',
      transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
      boxShadow: hovered ? '0 12px 28px rgba(26,58,138,0.12), 0 4px 12px rgba(0,0,0,0.06)' : '0 2px 8px rgba(0,0,0,0.04)',
      transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease, background 0.3s ease',
      animation: glow && !hovered ? 'breatheGlow 3s ease-in-out infinite' : 'none',
    }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div className="flex items-center justify-between mb-2">
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
        <span style={{ color, fontSize: 14, opacity: 0.5 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1, color }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ══════════════════════════════════════════════
// 主页面
// ══════════════════════════════════════════════
export default function CompetitionsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center min-h-[60vh]"><Spin size="large" /></div>}>
      <CompetitionsPageInner />
    </Suspense>
  );
}

function CompetitionsPageInner() {
  const { isAdmin } = useAuth();
  const searchParams = useSearchParams();
  const initialTab = searchParams?.get('tab') ?? 'progress';
  const [activeTab, setActiveTab] = useState(
    ['progress', 'effect'].includes(initialTab) ? initialTab : 'progress'
  );

  // ── 赛事进展 state ──
  const [progressItems, setProgressItems] = useState<ProgressEntry[]>([]);
  const [progressAllItems, setProgressAllItems] = useState<ProgressEntry[]>([]);
  const [progressPeriods, setProgressPeriods] = useState<string[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [progressStats, setProgressStats] = useState<ProgressStats | null>(null);
  const [progressLoading, setProgressLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<ProgressEntry | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { message } = App.useApp();

  // ── fieldOptions（用于动态构建颜色映射）──
  const [fieldOptions, setFieldOptions] = useState<Record<string, FieldSelectOption[]>>({});
  const categoryColors = useMemo(() => buildCategoryColorMap(fieldOptions.sceneCategory), [fieldOptions]);
  const statusColors = useMemo(() => buildStatusColorMap(fieldOptions.competitionProgress), [fieldOptions]);

  // ── 获取数据 ──
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

  // ── 获取 fieldOptions（用于动态颜色映射）──
  const fetchFieldOptions = async () => {
    try {
      const res = await fetch('/api/wish-pool');
      if (res.ok) {
        const data = await res.json();
        setFieldOptions(data.fieldOptions || {});
      }
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchProgress(); fetchFieldOptions(); }, []);

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

  // 排名排序（Top 亮点 + 全量列表）
  const rankedEntries = useMemo(() => {
    return [...progressItems].sort((a, b) => {
      const sa = a.finalValueScore ?? a.totalSavedHours ?? a.monthlySavedHours ?? 0;
      const sb = b.finalValueScore ?? b.totalSavedHours ?? b.monthlySavedHours ?? 0;
      return sb - sa;
    });
  }, [progressItems]);

  const spotlightEntries = useMemo(() => rankedEntries.slice(0, 3), [rankedEntries]);

  const maxCat = useMemo(() => progressStats ? Math.max(...Object.values(progressStats.categoryMap), 1) : 1, [progressStats]);

  // 状态统计（简化版，给参赛者看）
  const statusSummary = useMemo(() => {
    if (!progressStats || !selectedPeriod) return null;
    const p = progressStats.periodMap[selectedPeriod];
    if (!p) return null;
    const done = p.byStatus['终审通过'] || 0;
    const reviewing = p.byStatus['评审中'] || 0;
    return { total: p.total, done, reviewing };
  }, [progressStats, selectedPeriod]);

  return (
    <>
      <div className="px-[100px]" style={{ paddingTop: 20 }}>
        <Tabs defaultActiveKey="progress" activeKey={activeTab} onChange={setActiveTab} items={[
          {
            key: 'progress',
            label: <span className="flex items-center gap-1.5 text-sm font-semibold px-1"><FireOutlined />赛事进展</span>,
            children: (
              <div className="flex flex-col gap-5 mt-1">
                {progressLoading ? (
                  <div className="flex justify-center py-16"><Spin size="large" /></div>
                ) : progressStats ? (<>
                  {/* 大赛横幅 */}
                  <div className="competition-banner">
                    {/* 网格纹理背景 */}
                    <div className="competition-banner-grid" />
                    {/* 渐变光晕 */}
                    <div className="competition-banner-glow" />

                    <div className="competition-banner-inner">
                      {/* 左栏 */}
                      <div className="competition-banner-left">
                        {/* Badge */}
                        <div className="competition-banner-badge">
                          <span className="competition-banner-badge-dot" />
                          <span>HRAS · AI"智"造赛</span>
                        </div>

                        {/* 主标题 */}
                        <div className="competition-banner-title">
                          <div className="competition-banner-title-line1">AI 重构效率</div>
                          <div className="competition-banner-title-line2">创意定义价值</div>
                        </div>

                        {/* 副标题 */}
                        <div className="competition-banner-subtitle">
                          AI 浪潮势不可挡，HRAS 全员乘势而上
                        </div>

                        {/* 流程示意条 */}
                        <div className="competition-banner-flow">
                          <span className="competition-banner-flow-node-light">我来执行</span>
                          <span className="competition-banner-flow-arrow">→</span>
                          <span className="competition-banner-flow-node-accent">我创造 + AI 执行</span>
                        </div>

                        {/* 操作按钮行 - 仅管理员可见 */}
                        {isAdmin && (
                          <div className="flex items-center gap-2 mt-4">
                            <a href="https://ztn.feishu.cn/share/base/form/shrcnVgQV6C0ZAh3nZX6htenC5c" target="_blank" rel="noopener noreferrer"
                              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all hover:opacity-90"
                              style={{ background: 'var(--primary)' }}>
                              立即提报
                            </a>
                            <a href="https://ztn.feishu.cn/share/base/form/shrcnPYqHe7ySrBxA9DbXijzhUb" target="_blank" rel="noopener noreferrer"
                              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90"
                              style={{ color: 'var(--primary)', border: '1px solid var(--primary)' }}>
                              AI许愿
                            </a>
                          </div>
                        )}
                      </div>

                      {/* 右栏 */}
                      <div className="competition-banner-right">
                        <div className="competition-banner-card competition-banner-card-1">
                          <div className="competition-banner-card-label">赛事目标</div>
                          <div className="competition-banner-card-main">鼓励全员 AI 落地实际工作场景</div>
                          <div className="competition-banner-card-sub">实现 提效降本 · 创新破局 · 共创共享</div>
                        </div>
                        <div className="competition-banner-card competition-banner-card-2">
                          <div className="competition-banner-card-label">覆盖人群</div>
                          <div className="competition-banner-card-main"><b>HRAS 全体</b>（ZT + GF + WX）</div>
                        </div>
                        <div className="competition-banner-card competition-banner-card-3">
                          <div className="competition-banner-card-label">提报时间</div>
                          <div className="competition-banner-card-main">全时段不限</div>
                          <div className="competition-banner-card-sub">随时提报，不限月份</div>
                        </div>
                        <div className="competition-banner-card competition-banner-card-4">
                          <div className="competition-banner-card-label">评审时间</div>
                          <div className="competition-banner-card-main">每月26日-月底</div>
                          <div className="competition-banner-card-sub">评审当月1-25日参赛项目，次月1日公示结果</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 4 指标卡 */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard label="参赛方案" value={String(progressStats.currentPeriodCount)} sub={progressStats.total !== progressStats.currentPeriodCount ? `累计 ${progressStats.total} 个` : undefined} color="#1a3a8a" icon={<StarOutlined />} />
                    <MetricCard label="参赛团队" value={String(progressStats.teamCount)} sub="当期去重团队数" color="#F27F22" icon={<TeamOutlined />} />
                    <MetricCard label="预估月省工时" value={progressStats.totalSavedHours > 0 ? `${fmt(progressStats.totalSavedHours)}h` : '-'} sub="当期方案月均节省总工时" color="#16a34a" icon={<RiseOutlined />} glow />
                    <MetricCard label="评审完成率" value={(() => {
                      if (!statusSummary) return '-';
                      const pct = statusSummary.total > 0 ? Math.round((statusSummary.done / statusSummary.total) * 100) : 0;
                      return `${pct}%`;
                    })()} sub={statusSummary ? `${statusSummary.done} 已结项 / ${statusSummary.total} 总数` : undefined} color="#1a3a8a" icon={<CheckCircleOutlined />} />
                  </div>

                  {/* 赛事时间线 */}
                  {progressPeriods.length > 1 && (
                    <div className="glass rounded-xl p-5" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
                      <h3 className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--text-muted)' }}>赛事时间线</h3>
                      <div className="flex items-center gap-0 relative">
                        <div className="absolute left-0 right-0 top-5 h-0.5" style={{ background: 'rgba(26,58,138,0.12)' }} />
                        {progressPeriods.map((p, i) => {
                          const info = progressStats.periodMap[p];
                          const isActive = p === selectedPeriod;
                          const isLast = i === progressPeriods.length - 1;
                          const done = info?.byStatus['终审通过'] || 0;
                          const reviewing = info?.byStatus['评审中'] || 0;
                          const statusLabel = done === (info?.total || 0) ? '已结项' : '评审中';
                          const statusColor = done === (info?.total || 0) ? '#16a34a' : '#1a3a8a';
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

                  {/* 亮点方案 - Top 3 */}
                  {spotlightEntries.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <BulbOutlined style={{ color: '#F27F22' }} />
                        <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>亮点方案</h3>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>当期价值排名 Top 3</span>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {spotlightEntries.map((item, idx) => (
                          <SpotlightCard key={item.id} item={item} rank={idx + 1} categoryColors={categoryColors} onClick={() => setSelectedEntry(item)} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 场景分类分布 - 卡片式 */}
                  {progressStats && Object.keys(progressStats.categoryMap).length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <BarChartOutlined style={{ color: '#1a3a8a' }} />
                        <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>场景分类</h3>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>各职能领域的参赛分布</span>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {Object.entries(progressStats.categoryMap).sort((a, b) => b[1] - a[1]).map(([cat, count]) => {
                          const catItems = progressItems.filter((d) => d.sceneCategory === cat);
                          return (
                            <CategoryCard
                              key={cat}
                              category={cat}
                              count={count}
                              maxCount={maxCat}
                              items={catItems}
                              categoryColors={categoryColors}
                              onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 方案一览 - 精简表格 */}
                  <div className="glass rounded-xl overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
                    <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.3)' }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>方案一览</h3>
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {selectedCategory ? `${selectedCategory} · ${rankedEntries.filter((d) => d.sceneCategory === selectedCategory).length} 个` : `${rankedEntries.length} 个方案`}
                          </span>
                        </div>
                        {selectedCategory && (
                          <button onClick={() => setSelectedCategory(null)} className="text-xs font-medium px-2 py-1 rounded-md" style={{ color: 'var(--primary)', background: 'rgba(26,58,138,0.06)' }}>
                            清除筛选
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="p-5 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr>
                            {['排名', '方案', '场景', '团队', '状态', '月省工时', '降本提效'].map((h, i) => (
                              <th key={h} className={`py-2 px-3 text-xs font-medium ${i >= 5 ? 'text-right' : 'text-left'}`} style={{ color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.3)' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(selectedCategory ? rankedEntries.filter((d) => d.sceneCategory === selectedCategory) : rankedEntries).map((item, idx) => (
                            <tr key={item.id} className="hover:bg-white/20 transition-colors" style={{ cursor: 'pointer' }} onClick={() => setSelectedEntry(item)}>
                              <td className="py-2 px-3 font-mono text-xs" style={{
                                color: idx < 3 ? '#F27F22' : 'var(--text-muted)',
                                fontWeight: idx < 3 ? 700 : 400,
                                borderBottom: '1px solid rgba(255,255,255,0.1)',
                              }}>{idx + 1}</td>
                              <td className="py-2 px-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                <span className="hover:underline" style={{ color: 'var(--foreground)', cursor: 'pointer' }}>
                                  {(item.title || '-').length > 28 ? (item.title || '-').slice(0, 28) + '…' : (item.title || '-')}
                                </span>
                              </td>
                              <td className="py-2 px-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                {item.sceneCategory ? <Tag color={categoryColors[item.sceneCategory] || FALLBACK_COLOR} className="text-[11px]">{item.sceneCategory}</Tag> : <span style={{ color: '#cbd5e1', fontSize: 12 }}>—</span>}
                              </td>
                              <td className="py-2 px-3 text-xs" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>{item.team || '—'}</td>
                              <td className="py-2 px-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                {item.competitionProgress ? <Tag color={statusColors[item.competitionProgress] || FALLBACK_COLOR} className="text-[11px]">{STATUS_TEXT[item.competitionProgress] || item.competitionProgress}</Tag> : <span style={{ color: '#cbd5e1', fontSize: 12 }}>—</span>}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: '#16a34a', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                {item.totalSavedHours || item.monthlySavedHours ? `${fmt(item.totalSavedHours || item.monthlySavedHours || 0)}h` : '-'}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-xs" style={{ color: '#1a3a8a', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                {item.totalEfficiencyRate ? `${(item.totalEfficiencyRate * 100).toFixed(0)}%` : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 状态分布概览（给参赛者看的进度条） */}
                  {statusSummary && (
                    <div className="glass rounded-xl p-5" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
                      <h3 className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--text-muted)' }}>评审进度</h3>
                      <div style={{ height: 20, borderRadius: 10, background: 'rgba(255,255,255,0.3)', overflow: 'hidden', display: 'flex' }}>
                        {statusSummary.done > 0 && (
                          <div style={{ width: `${(statusSummary.done / statusSummary.total) * 100}%`, background: 'linear-gradient(90deg, #16a34a, #22c55e)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 600, minWidth: 20 }}>
                            {statusSummary.done}
                          </div>
                        )}
                        {statusSummary.reviewing > 0 && (
                          <div style={{ width: `${(statusSummary.reviewing / statusSummary.total) * 100}%`, background: 'linear-gradient(90deg, #1a3a8a, #2d5bc7)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 600, minWidth: 20 }}>
                            {statusSummary.reviewing}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-3">
                        <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          <span style={{ width: 12, height: 12, borderRadius: 4, background: '#16a34a', display: 'inline-block' }} />
                          已结项 {statusSummary.done}
                        </span>
                        <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          <span style={{ width: 12, height: 12, borderRadius: 4, background: '#1a3a8a', display: 'inline-block' }} />
                          评审中 {statusSummary.reviewing}
                        </span>
                        <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>共 {statusSummary.total} 个方案</span>
                      </div>
                    </div>
                  )}
                </>) : (
                  <div className="text-center py-12 glass rounded-2xl" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>暂无参赛数据</p>
                  </div>
                )}
              </div>
            ),
          },
          ...(isAdmin ? [{
            key: 'effect',
            label: <span className="flex items-center gap-1.5 text-sm font-semibold px-1"><BarChartOutlined />{PAGE_LABELS.choDashboard}</span>,
            children: <ChoDashboard />,
          }] : []),
        ]} />
      </div>

      {/* 动画 + Tabs 样式 + Banner 样式 */}
      <style jsx global>{`
        @keyframes breatheGlow {
          0%, 100% { box-shadow: 0 2px 8px rgba(0,0,0,0.04), 0 0 0 0 rgba(242,127,34,0); }
          50% { box-shadow: 0 2px 8px rgba(0,0,0,0.04), 0 0 16px 4px rgba(242,127,34,0.12); }
        }
        @keyframes slideUp {
          from { transform: translateY(24px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        /* ── Banner 入场动画 ── */
        @keyframes bannerLeftIn {
          from { transform: translateX(-16px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes bannerCardIn {
          from { transform: translateY(10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        /* ── Banner 容器（glassmorphism + AI岛风格） ── */
        .competition-banner {
          position: relative;
          overflow: hidden;
          border-radius: 20px;
          background: var(--glass-bg);
          backdrop-filter: blur(var(--glass-blur));
          -webkit-backdrop-filter: blur(var(--glass-blur));
          border: 1px solid var(--glass-border);
          box-shadow: var(--shadow-md);
        }
        .competition-banner-grid {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(26,58,138,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(26,58,138,0.03) 1px, transparent 1px);
          background-size: 60px 60px;
          z-index: 0;
        }
        .competition-banner-glow {
          position: absolute;
          right: -40px;
          top: -40px;
          width: 220px;
          height: 220px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(242,127,34,0.12) 0%, rgba(26,58,138,0.06) 40%, transparent 70%);
          pointer-events: none;
          z-index: 0;
        }
        .competition-banner-inner {
          position: relative;
          z-index: 1;
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          gap: 36px;
          padding: 32px 36px;
          font-family: 'Noto Sans SC', sans-serif;
        }

        /* ── 左栏 ── */
        .competition-banner-left {
          flex: 55;
          display: flex;
          flex-direction: column;
          gap: 14px;
          animation: bannerLeftIn 0.5s ease both;
        }
        .competition-banner-right {
          flex: 45;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        /* ── Badge ── */
        .competition-banner-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 5px 12px;
          border-radius: 999px;
          background: rgba(255,255,255,0.5);
          border: 1px solid var(--glass-border);
          font-size: 13px;
          font-weight: 500;
          color: var(--text-secondary);
          backdrop-filter: blur(10px);
        }
        .competition-banner-badge-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #16a34a;
          display: inline-block;
        }

        /* ── 标题 ── */
        .competition-banner-title {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .competition-banner-title-line1 {
          font-size: 40px;
          font-weight: 900;
          line-height: 1.15;
          color: var(--foreground);
        }
        .competition-banner-title-line2 {
          font-size: 40px;
          font-weight: 900;
          line-height: 1.15;
          background: linear-gradient(135deg, var(--primary), var(--accent));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* ── 副标题 ── */
        .competition-banner-subtitle {
          font-size: 15px;
          font-weight: 400;
          color: var(--text-secondary);
          line-height: 1.4;
        }

        /* ── 流程示意条 ── */
        .competition-banner-flow {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .competition-banner-flow-node-light {
          padding: 5px 14px;
          border-radius: 999px;
          background: rgba(255,255,255,0.45);
          border: 1px solid var(--glass-border);
          font-size: 12px;
          font-weight: 500;
          color: var(--text-muted);
          backdrop-filter: blur(8px);
        }
        .competition-banner-flow-arrow {
          font-size: 14px;
          color: var(--accent);
          font-weight: 600;
        }
        .competition-banner-flow-node-accent {
          padding: 5px 14px;
          border-radius: 999px;
          background: var(--gradient-primary);
          font-size: 12px;
          font-weight: 600;
          color: #fff;
          box-shadow: 0 3px 10px rgba(26,58,138,0.2);
        }

        /* ── 操作按钮 ── */
        .competition-banner-actions {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-top: 2px;
        }
        .competition-banner-btn-primary {
          display: inline-flex;
          align-items: center;
          padding: 11px 26px;
          border-radius: 999px;
          background: var(--gradient-primary);
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          box-shadow: 0 4px 16px rgba(26,58,138,0.25);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .competition-banner-btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(26,58,138,0.3);
        }
        .competition-banner-btn-secondary {
          display: inline-flex;
          align-items: center;
          padding: 11px 26px;
          border-radius: 999px;
          background: rgba(255,255,255,0.5);
          border: 1.5px solid var(--primary);
          color: var(--primary);
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          box-shadow: 0 2px 6px rgba(0,0,0,0.04);
          transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
        }
        .competition-banner-btn-secondary:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(26,58,138,0.12);
          background: rgba(255,255,255,0.65);
        }

        /* ── 信息卡片 ── */
        .competition-banner-card {
          border-radius: 14px;
          background: rgba(255,255,255,0.45);
          border: 1px solid var(--glass-border);
          backdrop-filter: blur(10px);
          padding: 14px 20px;
          transition: transform 0.25s ease, box-shadow 0.25s ease;
          animation: bannerCardIn 0.5s ease both;
        }
        .competition-banner-card:hover {
          transform: translateY(-3px);
          box-shadow: var(--shadow-md);
        }
        .competition-banner-card-1 { animation-delay: 0.0s; }
        .competition-banner-card-2 { animation-delay: 0.1s; }
        .competition-banner-card-3 { animation-delay: 0.2s; }
        .competition-banner-card-4 { animation-delay: 0.3s; }
        .competition-banner-card-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          margin-bottom: 3px;
        }
        .competition-banner-card-main {
          font-size: 14px;
          font-weight: 700;
          color: var(--foreground);
          line-height: 1.35;
        }
        .competition-banner-card-main b {
          font-weight: 700;
        }
        .competition-banner-card-sub {
          font-size: 12px;
          font-weight: 400;
          color: var(--text-muted);
          margin-top: 2px;
          line-height: 1.3;
        }

      `}</style>

      {/* 点击下钻详情弹窗 */}
      {selectedEntry && <EntryDrillDownModal item={selectedEntry} categoryColors={categoryColors} statusColors={statusColors} onClose={() => setSelectedEntry(null)} />}
    </>
  );
}
