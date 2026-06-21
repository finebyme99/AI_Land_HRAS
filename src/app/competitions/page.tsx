'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ChoDashboard from '@/components/ChoDashboard';
import { Spin, App, Tabs, Tag, Tooltip } from 'antd';
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
  ThunderboltOutlined,
  DollarOutlined,
  SyncOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/lib/auth-context';
import { PAGE_LABELS } from '@/lib/bitable/page-usage';
import {
  buildCategoryColorMap, buildStatusColorMap, reuseLevelStyle,
  FALLBACK_COLOR,
} from '@/lib/bitable/enums';
import type { FieldSelectOption } from '@/lib/bitable/field-map';
import {
  DetailListBlock,
  WishItem,
  fmt, fmtF, numOrDash, fmtCost, FmtHeader,
} from '@/components/DetailListBlock';

// ── 大赛进展标签文本映射（仅特殊文本替换）──
const STATUS_TEXT: Record<string, string> = { '终审通过': '已结项' };
function periodLabel(p: string): string {
  if (p.length === 4) {
    const m = p.slice(2);
    return `${parseInt(m)}月`;
  }
  return p;
}

// ── 方案详情弹窗（4分组布局） ──
function EntryDrillDownModal({ item, categoryColors, statusColors, fieldDescriptions, onClose }: { item: WishItem; categoryColors: Record<string, string>; statusColors: Record<string, string>; fieldDescriptions: Record<string, string>; onClose: () => void }) {
  const catColor = categoryColors[item.sceneCategory || ''] || FALLBACK_COLOR;
  const arr = (v: string[] | undefined) => v?.length ? v.join('、') : null;
  const members = [...new Set([...(item.submitter || []), ...(item.teamMembers || [])])];

  // 带问号tooltip的字段标签（zIndex高于弹窗，防止被遮挡）
  const labelWithTip = (label: string, fieldKey: string) => (
    <span className="inline-flex items-center gap-1" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
      {label}
      {fieldDescriptions[fieldKey] && (
        <Tooltip title={fieldDescriptions[fieldKey]} placement="top" overlayStyle={{ zIndex: 99999 }}>
          <QuestionCircleOutlined style={{ fontSize: 10, color: '#9ca3af', cursor: 'help' }} />
        </Tooltip>
      )}
    </span>
  );

  // 价值星级专属tooltip（AI岛计算逻辑，不走飞书fieldDescriptions）
  const STAR_TOOLTIP = '按最终价值计分排名百分位：前20%=5★，前40%=4★，前60%=3★，前80%=2★，后20%=1★';

  // 分组标题
  const groupHeader = (title: string, accentColor: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 8 }}>
      <div style={{ width: 3, height: 14, borderRadius: 2, background: accentColor }} />
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)' }}>{title}</span>
    </div>
  );

  // 标签-值行（2列grid内，值紧跟标签左对齐）
  const fieldRow = (label: string | React.ReactNode, value: React.ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid rgba(0,0,0,0.04)', gap: 8 }}>
      <div style={{ flexShrink: 0 }}>{typeof label === 'string' ? <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span> : label}</div>
      <span style={{ fontSize: 12, color: 'var(--foreground)', fontWeight: 500, textAlign: 'left', wordBreak: 'break-word' }}>{value || '—'}</span>
    </div>
  );

  // 宽值行（跨列，值紧跟标签左对齐）
  const wideRow = (label: string | React.ReactNode, value: React.ReactNode) => (
    <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'flex-start', padding: '4px 0', borderBottom: '1px solid rgba(0,0,0,0.04)', gap: 8 }}>
      <div style={{ flexShrink: 0 }}>{typeof label === 'string' ? <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span> : label}</div>
      <span style={{ fontSize: 12, color: 'var(--foreground)', fontWeight: 500, textAlign: 'left', wordBreak: 'break-word' }}>{value || '—'}</span>
    </div>
  );

  // ── 改造前后对比行 ──
  const beforeAfterRow = (label: string, before: React.ReactNode, after: React.ReactNode) => {
    const hasChange = before !== '—' && after !== '—' && before !== after;
    return (
      <div style={{ display: 'flex', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 100, flexShrink: 0 }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 500, color: hasChange ? '#b45309' : 'var(--foreground)', width: 100, textAlign: 'left' }}>{before}</span>
        <span style={{ fontSize: 11, color: hasChange ? '#16a34a' : 'var(--text-muted)', fontWeight: hasChange ? 700 : 400, flexShrink: 0 }}>→</span>
        <span style={{ fontSize: 12, fontWeight: 500, color: hasChange ? '#16a34a' : 'var(--foreground)', width: 100, textAlign: 'left' }}>{after}</span>
      </div>
    );
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ width: '92%', maxWidth: 680, maxHeight: '85vh', background: 'rgba(255,255,255,0.98)', backdropFilter: 'blur(24px)', borderRadius: 16, overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', animation: 'slideUp 0.3s ease-out' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #0F2057 0%, #1a3a8a 40%, #F27F22 100%)', padding: '16px 24px', color: 'white', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            {item.proposalNo && <Tag style={{ fontSize: 11, margin: 0, background: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)', color: 'white' }}>#{item.proposalNo}</Tag>}
            {item.sceneCategory && <Tag style={{ fontSize: 11, margin: 0, background: `${catColor}40`, borderColor: `${catColor}60`, color: 'white' }}>{item.sceneCategory}</Tag>}
            {item.competitionProgress && <Tag style={{ fontSize: 11, margin: 0, background: 'rgba(255,255,255,0.25)', borderColor: 'rgba(255,255,255,0.4)', color: 'white' }}>{STATUS_TEXT[item.competitionProgress] || item.competitionProgress}</Tag>}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.3 }}>{item.title || '未命名方案'}</div>
          <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 16, width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '12px 24px 24px' }}>

          {/* ── 分组一：参赛信息 ── */}
          {groupHeader('参赛信息', '#1a3a8a')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
            {fieldRow('提报团队', item.team)}
            {fieldRow('提报人', arr(item.submitter))}
            {wideRow('团队成员', members.length > 0 ? (members.length > 6 ? `${members.slice(0, 6).join('、')}等${members.length}人` : members.join('、')) : null)}
          </div>

          {/* ── 分组二：场景信息 ── */}
          {groupHeader('场景信息', '#2d5bc7')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
            {fieldRow(labelWithTip('场景分类', 'sceneCategory'), item.sceneCategory)}
            {fieldRow(labelWithTip('核心价值', 'coreValue'), item.coreValue)}
            {wideRow(labelWithTip('一句话简介', 'briefIntro'), item.briefIntro)}
            {wideRow(labelWithTip('核心痛点', 'painPoints'), arr(item.painPoints))}
            {fieldRow(labelWithTip('AI工具', 'aiTools'), arr(item.aiTools))}
            {wideRow(labelWithTip('AI实现效果', 'implementationLink'), item.implementationLink ? <a href={item.implementationLink} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#1a3a8a', textDecoration: 'underline' }}>查看实现效果 →</a> : null)}
          </div>

          {/* ── 分组三：量化数据 ── */}
          {groupHeader('量化数据', '#16a34a')}
          {/* 改造前后对比表 */}
          <div style={{ background: 'rgba(0,0,0,0.02)', borderRadius: 8, padding: '4px 12px', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '4px 0', marginBottom: 2 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', width: 100, flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: '#b45309', width: 100 }}>改造前</span>
              <span style={{ fontSize: 11, width: 20, textAlign: 'center', flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: '#16a34a', width: 100 }}>改造后</span>
            </div>
            {beforeAfterRow('操作频次', item.beforeFreq || '—', item.afterFreq || '—')}
            {beforeAfterRow('单次操作耗时', item.beforeHoursPerTask ? `${item.beforeHoursPerTask}h` : '—', item.afterHoursPerTask ? `${item.afterHoursPerTask}h` : '—')}
            {beforeAfterRow('操作人数', item.beforePeopleCount ? `${item.beforePeopleCount}人` : '—', item.afterPeopleCount ? `${item.afterPeopleCount}人` : '—')}
            {beforeAfterRow('月均耗时', item.beforeMonthlyHours ? `${fmtF(Math.round(item.beforeMonthlyHours))}h` : '—', item.afterMonthlyHours ? `${fmtF(Math.round(item.afterMonthlyHours))}h` : '—')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
            {fieldRow(labelWithTip('降本费用', 'monthlySavedCost'), fmtCost(item.monthlySavedCost))}
            {fieldRow(labelWithTip('月均Token费用', 'aiCost'), item.aiCost ? `¥${fmtF(Math.round(item.aiCost))}` : '—')}
            {wideRow(labelWithTip('降本费用说明', 'costReductionNote'), item.costReductionNote)}
          </div>
          {/* 突出高亮：月均节省总工时 + 提效比例 */}
          <div style={{ display: 'flex', gap: 0, marginTop: 8 }}>
            <div style={{ flex: 1, textAlign: 'center', padding: '12px 0', background: 'rgba(26,58,138,0.06)', borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>月均节省总工时</div>
              <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'SF Mono, Menlo, monospace', color: '#1a3a8a' }}>
                {item.totalSavedHours ? `${fmtF(Math.round(item.totalSavedHours))}h` : '—'}
              </div>
            </div>
            <div style={{ flex: 1, textAlign: 'center', padding: '12px 0', background: 'rgba(16,163,74,0.06)', borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>降本提效比例</div>
              <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'SF Mono, Menlo, monospace', color: '#16a34a' }}>
                {item.totalEfficiencyRate ? `${(item.totalEfficiencyRate * 100).toFixed(1)}%` : '—'}
              </div>
            </div>
          </div>

          {/* ── 分组四：价值计分 ── */}
          {groupHeader('价值计分', '#F27F22')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
            {fieldRow(labelWithTip('推广复用价值系数', 'reuseValue'), item.reuseValue || (item.reuseValueNumber ? `×${item.reuseValueNumber}` : null))}
            {fieldRow(labelWithTip('场景归属地区系数', 'regionCoefficient'), item.regionCoefficient || (item.regionCoefficientValue ? `${item.regionCoefficientValue}` : null))}
            {fieldRow(labelWithTip('最终价值计分', 'finalValueScore'), item.finalValueScore ? fmtF(Math.round(item.finalValueScore)) : '—')}
            {fieldRow(
              <span className="inline-flex items-center gap-1" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                价值星级
                <Tooltip title={STAR_TOOLTIP} placement="top" overlayStyle={{ zIndex: 99999 }}>
                  <QuestionCircleOutlined style={{ fontSize: 10, color: '#9ca3af', cursor: 'help' }} />
                </Tooltip>
              </span>,
              item.valueStarLevel ? `${'★'.repeat(item.valueStarLevel)}${'☆'.repeat(5 - item.valueStarLevel)}` : '—'
            )}
          </div>

          {item.recordUrl && (
            <div style={{ marginTop: 20, paddingTop: 12, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              <a href={item.recordUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#1a3a8a', textDecoration: 'underline' }}>在飞书多维表格中查看 →</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 亮点项目卡片 ──
function SpotlightCard({ item, rank, categoryColors, onClick }: { item: WishItem; rank: number; categoryColors: Record<string, string>; onClick: () => void }) {
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
      </div>

      {/* AI 工具 + 复用价值 */}
      <div className="flex items-center justify-between px-5 pb-2">
        <div className="flex items-center gap-1.5">
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

      {/* 团队 + 项目成员 */}
      <div className="flex items-center gap-2 px-5 pb-4">
        {item.team && <Tag style={{ fontSize: 10, margin: 0, background: 'rgba(242,127,34,0.08)', borderColor: 'rgba(242,127,34,0.2)', color: '#F27F22', fontWeight: 600 }}>{item.team}</Tag>}
        {(() => {
          const members = [...new Set([...(item.submitter || []), ...(item.teamMembers || [])])];
          if (members.length === 0) return null;
          const display = members.length > 4 ? `${members.slice(0, 4).join('、')}等${members.length}人` : members.join('、');
          return <span style={{ fontSize: 10, color: 'var(--foreground)', fontWeight: 500 }}>{display}</span>;
        })()}
      </div>
    </div>
  );
}

// ── 指标卡（ChoDashboard 风格）──
function StatCard({ label, value, sub, color, icon }: {
  label: string; value: string; sub?: string; color: string; icon: React.ReactNode;
}) {
  return (
    <div className="glass rounded-xl p-4 flex flex-col items-center text-center" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-1 text-lg" style={{ background: `${color}15`, color }}>{icon}</div>
      <div className="text-xl font-bold font-mono mt-0.5" style={{ color }}>{value}</div>
      <div className="text-[10px] font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</div>
      {sub && <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</div>}
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

  // ── 赛事数据 state ──
  const [allItems, setAllItems] = useState<WishItem[]>([]);
  const [currentItems, setCurrentItems] = useState<WishItem[]>([]);
  const [activePeriods, setActivePeriods] = useState<string[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [progressLoading, setProgressLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<WishItem | null>(null);
  const [syncing, setSyncing] = useState(false);
  const { message } = App.useApp();

  // ── fieldOptions + fieldDescriptions + summary ──
  const [fieldOptions, setFieldOptions] = useState<Record<string, FieldSelectOption[]>>({});
  const [fieldDescriptions, setFieldDescriptions] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<{
    count: number; totalPeople: number; totalSavedEfficiency: number;
    totalMonthlySavedCostDisplay: string; totalMonthlySavedHoursSum: number;
  } | null>(null);
  const [globalSummary, setGlobalSummary] = useState<{
    count: number; totalPeople: number; totalSavedEfficiency: number;
    totalMonthlySavedCostDisplay: string; totalMonthlySavedHoursSum: number;
  } | null>(null);
  const [periodMap, setPeriodMap] = useState<Record<string, { total: number; byStatus: Record<string, number> }>>({});

  const categoryColors = useMemo(() => buildCategoryColorMap(fieldOptions.sceneCategory), [fieldOptions]);
  const statusColors = useMemo(() => buildStatusColorMap(fieldOptions.competitionProgress), [fieldOptions]);
  const progressColors = useMemo(() => buildStatusColorMap(fieldOptions.landingProgress), [fieldOptions]);

  // ── 获取数据 ──
  const fetchProgress = async () => {
    setProgressLoading(true);
    try {
      const res = await fetch('/api/competitions/progress');
      if (!res.ok) throw new Error('获取失败');
      const data = await res.json();
      setAllItems(data.allItems || []);
      setCurrentItems(data.items || []);
      setActivePeriods(data.periods || []);
      setSelectedPeriod(data.currentPeriod || '');
      setFieldOptions(data.fieldOptions || {});
      setFieldDescriptions(data.fieldDescriptions || {});
      setSummary(data.summary);
      setGlobalSummary(data.globalSummary);
      setPeriodMap(data.stats?.periodMap || {});
    } catch {
      message.error('获取赛事进展数据失败');
    } finally {
      setProgressLoading(false);
    }
  };

  useEffect(() => { fetchProgress(); }, []);

  // ── 同步 ──
  const handleSync = async () => {
    if (!selectedPeriod || syncing) return;
    setSyncing(true);
    try {
      const res = await fetch(`/api/competitions/sync?period=${selectedPeriod}`, { method: 'POST' });
      if (!res.ok) throw new Error('同步失败');
      message.success('同步完成，数据已刷新');
      await fetchProgress();
    } catch {
      message.error('同步失败，请稍后重试');
    } finally {
      setSyncing(false);
    }
  };

  // ── 切换期数时重新过滤 ──
  useEffect(() => {
    if (!selectedPeriod || allItems.length === 0) return;
    const filtered = allItems.filter((d) => d.reviewPeriod === selectedPeriod);
    setCurrentItems(filtered);
  }, [selectedPeriod, allItems]);

  // ── 当期 summary（随 selectedPeriod 变化重新计算）──
  const currentSummary = useMemo(() => {
    if (currentItems.length === 0) return null;
    const count = currentItems.length;
    const totalPeople = currentItems.reduce((s, d) => s + (d.beforePeopleCount ?? 0), 0);
    const totalSavedEfficiency = Math.round(currentItems.reduce((s, d) => s + (d.monthlySavedHours ?? 0), 0) * 10) / 10;
    const totalMonthlySavedCost = currentItems.reduce((s, d) => {
      if (!d.monthlySavedCost) return s;
      const n = typeof d.monthlySavedCost === 'number' ? d.monthlySavedCost : parseFloat(String(d.monthlySavedCost).replace(/[^0-9.\-]/g, ''));
      return s + (n > 0 ? n : 0);
    }, 0);
    const totalMonthlySavedCostDisplay = totalMonthlySavedCost > 0 ? `¥${Math.round(totalMonthlySavedCost)}` : '—';
    const totalMonthlySavedHoursSum = Math.round(currentItems.reduce((s, d) => s + (d.totalSavedHours ?? 0), 0) * 10) / 10;
    return { count, totalPeople, totalSavedEfficiency, totalMonthlySavedCostDisplay, totalMonthlySavedHoursSum };
  }, [currentItems]);

  // ── allTimelinePeriods：活跃 + 未来周期 ──
  const allTimelinePeriods = useMemo(() => {
    if (activePeriods.length === 0) return [];
    // 从最后一个活跃周期的下一个月开始，到 YY12
    const lastActive = activePeriods[activePeriods.length - 1];
    const lastYY = parseInt(lastActive.slice(0, 2));
    const lastMM = parseInt(lastActive.slice(2));
    const future: string[] = [];
    for (let mm = lastMM + 1; mm <= 12; mm++) {
      future.push(`${lastYY}${String(mm).padStart(2, '0')}`);
    }
    return [...activePeriods, ...future];
  }, [activePeriods]);

  // ── 排名排序 ──
  const rankedEntries = useMemo(() => {
    return [...currentItems].sort((a, b) => {
      const sa = a.finalValueScore ?? a.totalSavedHours ?? a.monthlySavedHours ?? 0;
      const sb = b.finalValueScore ?? b.totalSavedHours ?? b.monthlySavedHours ?? 0;
      return sb - sa;
    });
  }, [currentItems]);

  const spotlightEntries = useMemo(() => rankedEntries.slice(0, 3), [rankedEntries]);

  // ── 当前期的评审进度 ──
  const statusSummary = useMemo(() => {
    if (!selectedPeriod || !periodMap[selectedPeriod]) return null;
    const p = periodMap[selectedPeriod];
    const done = p.byStatus['终审通过'] || 0;
    const reviewing = p.byStatus['评审中'] || 0;
    return { total: p.total, done, reviewing };
  }, [selectedPeriod, periodMap]);

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
                ) : (<>

                  {/* ── Banner ── */}
                  <div className="glass rounded-2xl" style={{ borderColor: 'rgba(255,255,255,0.6)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24 }}>
                    {/* 左侧：标题+副标题+按钮 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.2 }}>
                        <span>AI 重构效率 </span>
                        <span className="gradient-text">创意定义价值</span>
                      </div>
                      <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        欢迎每一位勇于拥抱变化、重塑流程、迎击时代浪潮的探索者
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-2">
                          <a href="https://ztn.feishu.cn/share/base/form/shrcnVgQV6C0ZAh3nZX6htenC5c" target="_blank" rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:opacity-90"
                            style={{ background: '#1a3a8a' }}>
                            <TrophyOutlined /> 立即提报
                          </a>
                          <a href="https://ztn.feishu.cn/share/base/form/shrcnPYqHe7ySrBxA9DbXijzhUb" target="_blank" rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90"
                            style={{ color: '#1a3a8a', border: '1px solid #1a3a8a' }}>
                            <StarOutlined /> AI许愿
                          </a>
                          <button onClick={handleSync} disabled={syncing}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                            style={{ color: syncing ? 'var(--text-muted)' : '#F27F22', border: `1px solid ${syncing ? 'var(--text-muted)' : '#F27F22'}`, opacity: syncing ? 0.5 : 1 }}>
                            <SyncOutlined spin={syncing} /> {syncing ? '同步中…' : '同步数据'}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 右侧：4项信息横向排列 */}
                    <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
                      {[
                        { label: '赛事目标', value: '全员AI落地降本提效', accent: '#1a3a8a' },
                        { label: '覆盖范围', value: 'HRAS 全体', accent: '#2d5bc7' },
                        { label: '提报时间', value: '不限时', accent: '#16a34a' },
                        { label: '评审节奏', value: '每月26日-月底', accent: '#F27F22' },
                      ].map((info) => (
                        <div key={info.label} style={{ textAlign: 'center', padding: '8px 12px', background: `${info.accent}08`, borderRadius: 8 }}>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>{info.label}</div>
                          <div style={{ fontSize: 12, color: info.accent, fontWeight: 700 }}>{info.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── 5 指标卡 ── */}
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <StatCard label="参赛方案" value={String(currentSummary?.count ?? 0)} sub={globalSummary && globalSummary.count !== currentSummary?.count ? `累计 ${globalSummary.count} 个` : undefined} color="#1a3a8a" icon={<BulbOutlined />} />
                    <StatCard label="覆盖人数" value={currentSummary?.totalPeople ? String(currentSummary.totalPeople) : '0'} color="#2d5bc7" icon={<TeamOutlined />} />
                    <StatCard label="月均提效工时" value={currentSummary?.totalSavedEfficiency ? `${fmt(currentSummary.totalSavedEfficiency)}h` : '—'} sub="月均提效节省工时" color="#16a34a" icon={<RiseOutlined />} />
                    <StatCard label="月均降本费用" value={currentSummary?.totalMonthlySavedCostDisplay ?? '—'} sub="不含人力成本" color="#d97706" icon={<DollarOutlined />} />
                    <StatCard label="月均节省总工时" value={currentSummary?.totalMonthlySavedHoursSum ? `${fmt(currentSummary.totalMonthlySavedHoursSum)}h` : '—'} sub="提效+降本折算" color="#1a3a8a" icon={<ClockCircleOutlined />} />
                  </div>

                  {/* ── 赛事时间线（极简横向企业发展史风格）── */}
                  {allTimelinePeriods.length > 1 && (
                    <div className="glass rounded-xl" style={{ borderColor: 'rgba(255,255,255,0.6)', padding: '16px 20px 20px' }}>
                      {/* 标题行：赛事时间线 + hint胶囊 */}
                      <div className="flex items-center gap-2 mb-2">
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>赛事时间线</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: 'rgba(242,127,34,0.1)', color: '#F27F22', border: '1px solid rgba(242,127,34,0.2)' }}>
                          点击节点查看该周期参赛方案 ↓
                        </span>
                      </div>

                      {/* 时间线主体（flex row，节点竖排） */}
                      <div className="flex" style={{ position: 'relative' }}>
                        {/* 细横轴（穿过竖线刻度位置） */}
                        <div style={{ position: 'absolute', left: 0, right: 0, top: 30, height: 1.5, background: 'linear-gradient(90deg, rgba(26,58,138,0.4) 0%, rgba(26,58,138,0.15) 50%, rgba(148,163,184,0.1) 100%)' }} />

                        {allTimelinePeriods.map((p) => {
                          const isActive = activePeriods.includes(p);
                          const isFuture = !isActive;
                          const isSelected = p === selectedPeriod;
                          const info = periodMap[p];
                          const done = info?.byStatus['终审通过'] || 0;
                          const reviewing = info?.byStatus['评审中'] || 0;
                          const statusLabel = done === (info?.total || 0) && info?.total > 0 ? '已结项' : reviewing > 0 ? '评审中' : '';
                          const tickColor = isSelected ? '#F27F22' : isActive ? '#1a3a8a' : '#94a3b8';
                          const tickWidth = isSelected ? 3 : isActive ? 2.5 : 1;
                          const tickHeight = isActive ? 20 : 10;

                          return (
                            <div key={p}
                              style={{
                                flex: isActive ? 1.2 : 0.7,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                cursor: isActive ? 'pointer' : 'default',
                              }}
                              className="hover:-translate-y-0.5 transition-transform"
                              onClick={() => {
                                if (isFuture) {
                                  message.info('该评审周期尚未开启');
                                  return;
                                }
                                setSelectedPeriod(p);
                              }}
                            >
                              {/* 评审周期大号文字（轴上方） */}
                              <div style={{
                                fontSize: isActive ? 16 : 12,
                                fontWeight: isActive ? 800 : 400,
                                fontFamily: 'SF Mono, Menlo, monospace',
                                color: isSelected ? '#F27F22' : isActive ? '#1a3a8a' : '#94a3b8',
                                letterSpacing: -0.5,
                                marginBottom: 4,
                                lineHeight: 1,
                              }}>
                                {p}
                              </div>

                              {/* 粗竖线刻度（穿出横轴） */}
                              <div style={{
                                width: tickWidth,
                                height: tickHeight,
                                background: tickColor,
                                borderRadius: 1,
                                transition: 'all 0.3s ease',
                              }} />

                              {/* 轴下方信息 */}
                              <div style={{ marginTop: 6, textAlign: 'center' }}>
                                {isFuture ? (
                                  <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>待开启</span>
                                ) : (
                                  <>
                                    {statusLabel && <div style={{ fontSize: 10, fontWeight: 600, color: statusLabel === '已结项' ? '#16a34a' : '#1a3a8a' }}>{statusLabel}</div>}
                                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{info?.total || 0}个方案</div>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── 亮点项目 Top 3 ── */}
                  {spotlightEntries.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <BulbOutlined style={{ color: '#F27F22' }} />
                        <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>亮点项目</h3>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: 'rgba(242,127,34,0.1)', color: '#F27F22', border: '1px solid rgba(242,127,34,0.2)' }}>
                          点击展示项目详情
                        </span>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {spotlightEntries.map((item, idx) => (
                          <SpotlightCard key={item.id} item={item} rank={idx + 1} categoryColors={categoryColors} onClick={() => setSelectedEntry(item)} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── 方案一览（DetailListBlock）── */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>方案一览</h3>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {rankedEntries.length} 个方案
                      </span>
                    </div>
                    <DetailListBlock
                      baseList={currentItems}
                      label="方案"
                      emptyText="暂无参赛数据"
                      showMetrics={true}
                      labelColor="#1a3a8a"
                      fieldDescriptions={fieldDescriptions}
                      fieldOptions={fieldOptions}
                      progressColors={progressColors}
                      categoryColors={categoryColors}
                      onRowEnter={() => {}}
                      onRowLeave={() => {}}
                      onSelectItem={(item) => setSelectedEntry(item)}
                    />
                  </div>

                </>)}
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

      {/* 动画 */}
      <style jsx global>{`
        @keyframes slideUp {
          from { transform: translateY(24px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      {/* 详情弹窗 */}
      {selectedEntry && <EntryDrillDownModal item={selectedEntry} categoryColors={categoryColors} statusColors={statusColors} fieldDescriptions={fieldDescriptions} onClose={() => setSelectedEntry(null)} />}
    </>
  );
}
