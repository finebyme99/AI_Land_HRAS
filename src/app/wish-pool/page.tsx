'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Spin, Tag, App, Table, Modal, Tooltip, type TableColumnsType } from 'antd';
import {
  SyncOutlined,
  StarOutlined,
  TrophyOutlined,
  RocketOutlined,
  BarChartOutlined,
  RiseOutlined,
  ThunderboltOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  QuestionCircleOutlined,
  StarFilled,
} from '@ant-design/icons';
import { useAuth } from '@/lib/auth-context';

// ── 类型定义 ──
interface WishItem {
  id: string;
  recordUrl?: string;
  proposalNo?: string;
  title?: string;
  briefIntro?: string;
  sceneCategory?: string;
  coreValue?: string;
  sceneSource?: string;
  regionCoefficient?: string;
  regionCoefficientValue?: number;
  landingProgress?: string;
  competitionProgress?: string;
  reviewPeriod?: string;
  plannedStartDate?: string;
  pilotDate?: string;
  rolloutDate?: string;
  fullLaunchDate?: string;
  progressRecord?: string;
  bizOwner?: string[];
  aiOwner?: string[];
  submitter?: string[];
  teamMembers?: string[];
  creator?: string[];
  team?: string;
  teamType?: string;
  aiTools?: string[];
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
  aiCost?: number;
  reuseValue?: string;
  reuseValueNumber?: number;
  reuseValueLevel?: string;
  totalEfficiencyRate?: number;
  finalValueScore?: number;
  valueRank?: number;
  implementation?: string;
  implementationLink?: string;
  valueStarLevel?: number | null;
}

interface Stats {
  total: number;
  avgScore: number;
  withScoreCount: number;
  progressMap: Record<string, number>;
  contestMap: Record<string, number>;
  categoryMap: Record<string, number>;
  teamMap: Record<string, number>;
  landedCount: number;
  totalMonthlySavedHours: number;
  totalMonthlySavedCost: number;
}

// ── 常量 ──
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
  数据补充中: '#cbd5e1',
  未标记: '#cbd5e1',
};

const LANDING_PROGRESS_OPTIONS = ['待启动', '训练验证中', '试点上线', '推广上线', '全面上线', '关闭', '数据补充中'];
const SCENE_CATEGORY_OPTIONS = ['数据分析', '招聘管理', '薪酬绩效', '培训管理', '组织与人才发展', '文化氛围', '核算与报账', '基础人事支持', '行政管理', '日常工作', '考勤管理', '其他（请补充）', '人才发展'];

const SORT_OPTIONS = [
  { value: 'finalValueScore', label: '最终价值计分' },
  { value: 'monthlySavedHours', label: '月均提效节省工时' },
  { value: 'totalSavedHours', label: '月均节省总工时' },
  { value: 'monthlySavedCost', label: '月均降本费用' },
  { value: 'reuseValueNumber', label: '复用价值系数' },
];

// ── 工具函数 ──
function fmt(n: number): string {
  if (n >= 1e4) return (n / 1e4).toFixed(1) + '万';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return Math.round(n).toString();
}

function fmtF(n: number): string {
  return n.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
}

function numOrDash(v: number | null | undefined, unit: string, decimals = 0): string {
  if (v == null) return '—';
  const n = decimals === 0 ? String(Math.round(v)) : v.toFixed(decimals);
  return `${n}${unit}`;
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${Math.round(v * 100)}%`;
}

function fmtCost(v: number | string | null | undefined): string {
  if (v == null || v === '') return '—';
  const num = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  if (!num || num <= 0) return '—';
  return `¥${fmtF(Math.round(num))}`;
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

// ── 水平条形图组件 ──
function HBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
      <span style={{ width: 90, textAlign: 'right', fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 14, background: 'rgba(255,255,255,0.3)', borderRadius: 7, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 7, width: `${Math.max(pct, 1)}%`, background: `linear-gradient(90deg, ${color}, ${color}88)`, transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ width: 50, fontSize: 10, fontFamily: 'SF Mono, monospace', color: 'var(--text-secondary)', flexShrink: 0 }}>{value}个</span>
    </div>
  );
}

// ── 统计卡片（与ChoDashboard StatCard风格一致）──
function StatCard({ icon, label, value, sub, color, highlight }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color: string; highlight?: boolean;
}) {
  return (
    <div
      className="glass rounded-xl p-4 flex flex-col items-center text-center"
      style={{
        borderColor: highlight ? 'rgba(22,163,74,0.3)' : 'rgba(255, 255, 255, 0.6)',
        background: highlight ? 'rgba(22,163,74,0.06)' : undefined,
        animation: highlight ? 'breatheGlow 3s ease-in-out infinite' : 'none',
      }}
    >
      <span className="text-lg mb-1" style={{ color }}>{icon}</span>
      <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-xl font-bold font-mono mt-0.5" style={{ color }}>{value}</span>
      {sub && <span className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</span>}
    </div>
  );
}

// ── 筛选行（单选 pill，与ChoDashboard FilterRow风格一致）──
function FilterRow({ label, icon, options, value, onChange }: {
  label: string; icon?: React.ReactNode;
  options: { value: string; label: string; count: number }[];
  value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
        {icon} {label}
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

// ── 落地进展多选筛选行 ──
function MultiSelectFilterRow({ label, icon, options, values, onChange }: {
  label: string; icon?: React.ReactNode;
  options: { value: string; label: string; count: number }[];
  values: string[]; onChange: (v: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
        {icon} {label}
      </span>
      {options.map((opt) => {
        const isSelected = values.includes(opt.value);
        return (
          <button
            key={opt.value}
            onClick={() => {
              if (isSelected) {
                onChange(values.filter((v) => v !== opt.value));
              } else {
                onChange([...values, opt.value]);
              }
            }}
            className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-all inline-flex items-center gap-1"
            style={{
              background: isSelected ? 'var(--primary)' : 'rgba(0,0,0,0.04)',
              color: isSelected ? '#fff' : 'var(--text-secondary)',
            }}
          >
            {isSelected && <span style={{ fontSize: 9 }}>✓</span>}
            {opt.label} <span className="opacity-60">({opt.count})</span>
          </button>
        );
      })}
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
        {row('月均降本费用', item.monthlySavedCost ? fmtCost(item.monthlySavedCost) : null)}
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
    <div style={{ maxHeight: 360, overflowY: 'auto', overflowX: 'auto' }}>
      <table style={{ fontSize: 11, borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
        <thead>
          <tr>
            {['场景', '提报团队', '落地进展', '月省总工时', '复用价值', '地区'].map((h) => (
              <th key={h} style={{ padding: '4px 8px', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.3)', textAlign: 'left' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <td style={{ padding: '4px 8px', color: 'var(--foreground)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title || '-'}</td>
              <td style={{ padding: '4px 8px', color: 'var(--text-secondary)' }}>{item.team || '—'}</td>
              <td style={{ padding: '4px 8px' }}>
                {item.landingProgress ? <Tag color={PROGRESS_COLORS[item.landingProgress] || '#6b7280'} style={{ fontSize: 10, margin: 0, lineHeight: '16px' }}>{item.landingProgress}</Tag> : <span style={{ color: '#cbd5e1' }}>—</span>}
              </td>
              <td style={{ padding: '4px 8px', color: 'var(--text-secondary)', fontFamily: 'SF Mono, monospace' }}>{item.totalSavedHours || item.monthlySavedHours ? `${fmt(item.totalSavedHours || item.monthlySavedHours || 0)}h` : '—'}</td>
              <td style={{ padding: '4px 8px', color: 'var(--text-secondary)' }}>{item.reuseValueLevel || '—'}</td>
              <td style={{ padding: '4px 8px', color: 'var(--text-secondary)' }}>{item.regionCoefficient || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── 点击下钻详情弹窗 ──
function SceneDrillDownModal({ item, onClose }: { item: WishItem; onClose: () => void }) {
  const sectionTitle = (text: string, color: string) => (
    <div style={{
      fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.5,
      borderBottom: `2px solid ${color}30`, paddingBottom: 6, marginBottom: 12, marginTop: 20,
    }}>{text}</div>
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
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        style={{
          width: '92%', maxWidth: 720, maxHeight: '85vh', background: 'rgba(255,255,255,0.98)',
          backdropFilter: 'blur(24px)', borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)', animation: 'slideUp 0.3s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gradient Header */}
        <div style={{ background: 'linear-gradient(135deg, #1a3a8a, #2d5bc7)', padding: '20px 24px', color: 'white', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            {item.proposalNo && <Tag style={{ fontSize: 11, margin: 0, background: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)', color: 'white' }}>{item.proposalNo}</Tag>}
            {item.sceneCategory && <Tag style={{ fontSize: 11, margin: 0, background: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)', color: 'white' }}>{item.sceneCategory}</Tag>}
            {item.landingProgress && <Tag style={{ fontSize: 11, margin: 0, background: 'rgba(255,255,255,0.25)', borderColor: 'rgba(255,255,255,0.4)', color: 'white' }}>{item.landingProgress}</Tag>}
            {item.reuseValueLevel && <Tag style={{ fontSize: 11, margin: 0, background: 'rgba(242,127,34,0.3)', borderColor: 'rgba(242,127,34,0.5)', color: 'white' }}>{item.reuseValueLevel}</Tag>}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.3 }}>{item.title || '未命名场景'}</div>
          {item.briefIntro && <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>{item.briefIntro}</div>}
          <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '0 24px 24px', maxHeight: 'calc(85vh - 120px)', overflowY: 'auto' }}>
          {/* Score highlight */}
          <div style={{ display: 'flex', gap: 24, padding: '16px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>价值排名</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#1a3a8a', fontFamily: 'SF Mono, monospace' }}>{item.valueRank ? `#${item.valueRank}` : '-'}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>最终价值计分</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#F27F22', fontFamily: 'SF Mono, monospace' }}>{item.finalValueScore ? fmtF(Math.round(item.finalValueScore)) : '-'}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>月均节省总工时</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#2d5bc7', fontFamily: 'SF Mono, monospace' }}>{item.totalSavedHours ? `${fmtF(Math.round(item.totalSavedHours))}h` : '-'}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>总降本提效</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#4a7de0', fontFamily: 'SF Mono, monospace' }}>{item.totalEfficiencyRate ? `${(item.totalEfficiencyRate * 100).toFixed(1)}%` : '-'}</div>
            </div>
          </div>

          {/* 场景信息 */}
          {sectionTitle('场景信息', '#1a3a8a')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px' }}>
            {row('核心价值', item.coreValue)}
            {row('场景来源', item.sceneSource)}
            {row('业务负责人', arr(item.bizOwner))}
            {row('AI负责人', arr(item.aiOwner))}
            {row('提报团队', item.team)}
            {row('提报组队类型', item.teamType)}
            {row('提报人', arr(item.submitter))}
            {row('组队成员', arr(item.teamMembers))}
            {row('AI工具', arr(item.aiTools))}
            {row('计划启动', item.plannedStartDate?.slice(0, 10))}
            {row('试点上线', item.pilotDate?.slice(0, 10))}
            {row('推广上线', item.rolloutDate?.slice(0, 10))}
            {row('全面上线', item.fullLaunchDate?.slice(0, 10))}
          </div>

          {/* AI前指标 */}
          {sectionTitle('AI前指标', '#1a3a8a')}
          {item.beforeProcess && row('原业务流程', item.beforeProcess, true)}
          {item.painPoints && item.painPoints.length > 0 && row('原核心痛点', item.painPoints.join('、'), true)}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px' }}>
            {row('原操作频率', item.beforeFrequency)}
            {row('原操作次数', item.beforeOperationCount ? `${item.beforeOperationCount}次` : null)}
            {row('原操作频次', item.beforeFreq ? `${item.beforeFreq}次/月` : null)}
            {row('原操作人数', item.beforePeopleCount ? `${item.beforePeopleCount}人` : null)}
            {row('原单次耗时', item.beforeHoursPerTask ? `${item.beforeHoursPerTask}h` : null)}
            {row('原月均耗时', item.beforeMonthlyHours ? `${fmtF(Math.round(item.beforeMonthlyHours))}h` : null)}
          </div>

          {/* AI后指标 */}
          {sectionTitle('AI后指标', '#1a3a8a')}
          {item.afterProcess && row('新业务流程', item.afterProcess, true)}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px' }}>
            {row('新操作频率', item.afterFrequency)}
            {row('新操作次数', item.afterOperationCount ? `${item.afterOperationCount}次` : null)}
            {row('新操作频次', item.afterFreq ? `${item.afterFreq}次/月` : null)}
            {row('新操作人数', item.afterPeopleCount ? `${item.afterPeopleCount}人` : null)}
            {row('新单次耗时', item.afterHoursPerTask ? `${item.afterHoursPerTask}h` : null)}
            {row('新月均耗时', item.afterMonthlyHours ? `${fmtF(Math.round(item.afterMonthlyHours))}h` : null)}
            {row('月均Token费用', item.aiCost ? `¥${fmtF(item.aiCost)}` : null)}
          </div>

          {/* 价值计分指标 */}
          {sectionTitle('价值计分指标', '#F27F22')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px' }}>
            {row('月均提效节省', item.monthlySavedHours ? `${fmtF(Math.round(item.monthlySavedHours))}h` : null)}
            {row('月均降本费用', item.monthlySavedCost ? fmtCost(item.monthlySavedCost) : null)}
            {item.costReductionNote && row('降本费用说明', item.costReductionNote, true)}
            {row('降本折算工时', item.costSavedHours ? `${fmtF(Math.round(item.costSavedHours))}h` : null)}
            {row('月均节省总工时', item.totalSavedHours ? `${fmtF(Math.round(item.totalSavedHours))}h` : null)}
            {row('总降本提效', item.totalEfficiencyRate ? `${(item.totalEfficiencyRate * 100).toFixed(1)}%` : null)}
            {row('地区系数', item.regionCoefficient)}
            {row('复用价值系数', item.reuseValue)}
            {row('复用价值等级', item.reuseValueLevel)}
          </div>

          {/* 实现过程 */}
          {(item.implementation || item.implementationLink) && (
            <>
              {sectionTitle('AI实现过程', '#2d5bc7')}
              {item.implementation && <div style={{ fontSize: 13, color: 'var(--foreground)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{item.implementation}</div>}
              {item.implementationLink && (
                <a href={item.implementationLink} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 8, fontSize: 13, color: '#1a3a8a', textDecoration: 'underline' }}>
                  查看实现效果 →
                </a>
              )}
            </>
          )}

          {/* 进展记录 */}
          {item.progressRecord && (
            <>
              {sectionTitle('进展记录', '#64748b')}
              <div style={{ fontSize: 13, color: 'var(--foreground)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{item.progressRecord}</div>
            </>
          )}

          {/* Link to Feishu */}
          {item.recordUrl && (
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              <a href={item.recordUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#1a3a8a', textDecoration: 'underline' }}>
                在飞书多维表格中查看 →
              </a>
            </div>
          )}
        </div>
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
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<WishItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<WishItem | null>(null);
  const [listHover, setListHover] = useState<{ label: string; items: WishItem[]; x: number; y: number } | null>(null);
  const [filterExpanded, setFilterExpanded] = useState(true);
  const [sortBy, setSortBy] = useState('finalValueScore');
  const [titleWidth, setTitleWidth] = useState(260);

  // 篩选状态：落地进展多选，默认=试点/推广/全面
  const [landingProgressFilters, setLandingProgressFilters] = useState<string[]>(['试点上线', '推广上线', '全面上线']);
  const [sceneCategoryFilter, setSceneCategoryFilter] = useState<string>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');

  const detailTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const listTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // 悬浮处理
  const handleRowEnter = (item: WishItem) => {
    clearTimeout(detailTimer.current);
    setHoveredRow(item);
  };
  const handleRowLeave = () => {
    detailTimer.current = setTimeout(() => setHoveredRow(null), 200);
  };
  const handleDetailEnter = () => { clearTimeout(detailTimer.current); };
  const handleDetailLeave = () => { setHoveredRow(null); };

  const showListHover = (label: string, hoverItems: WishItem[]) => (e: React.MouseEvent) => {
    clearTimeout(listTimer.current);
    const offsetX = 15;
    const offsetY = 15;
    let x = e.clientX + offsetX;
    let y = e.clientY + offsetY;
    const estimatedWidth = 520;
    const estimatedHeight = 400;
    if (x + estimatedWidth > window.innerWidth - 16) x = e.clientX - estimatedWidth - offsetX;
    if (y + estimatedHeight > window.innerHeight - 16) y = window.innerHeight - estimatedHeight - 16;
    setListHover({ label, items: hoverItems, x, y });
  };
  const hideListHover = () => { listTimer.current = setTimeout(() => setListHover(null), 200); };
  const handleListEnter = () => { clearTimeout(listTimer.current); };
  const handleListLeave = () => { setListHover(null); };

  // 权限检查
  useEffect(() => {
    if (!authLoading && !isAdmin) router.replace('/');
  }, [authLoading, isAdmin, router]);

  // 获取数据
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/wish-pool');
      if (!res.ok) throw new Error('获取失败');
      const data = await res.json();
      setItems(data.items || []);
      setStats(data.stats);
    } catch {
      message.error('获取场景池数据失败');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { if (isAdmin) fetchData(); }, [isAdmin, fetchData]);

  const handleRefresh = async () => {
    setSyncing(true);
    await fetchData();
    setSyncing(false);
    message.success('数据已刷新');
  };

  // ── 筛选+排序后的数据 ──
  const tableData = useMemo(() => {
    let list = items;
    // 落地进展多选筛选
    if (landingProgressFilters.length > 0) {
      list = list.filter((d) => landingProgressFilters.includes(d.landingProgress || ''));
    }
    if (sceneCategoryFilter !== 'all') list = list.filter((d) => d.sceneCategory === sceneCategoryFilter);
    if (teamFilter !== 'all') list = list.filter((d) => d.team === teamFilter);
    // 排序
    const sorted = [...list].sort((a, b) => {
      switch (sortBy) {
        case 'finalValueScore': return (b.finalValueScore ?? -1) - (a.finalValueScore ?? -1);
        case 'monthlySavedHours': return (b.monthlySavedHours ?? -1) - (a.monthlySavedHours ?? -1);
        case 'totalSavedHours': return (b.totalSavedHours ?? -1) - (a.totalSavedHours ?? -1);
        case 'monthlySavedCost':
          const aCost = typeof a.monthlySavedCost === 'number' ? a.monthlySavedCost : parseFloat(String(a.monthlySavedCost || '0').replace(/[^0-9.\-]/g, '')) || 0;
          const bCost = typeof b.monthlySavedCost === 'number' ? b.monthlySavedCost : parseFloat(String(b.monthlySavedCost || '0').replace(/[^0-9.\-]/g, '')) || 0;
          return bCost - aCost;
        case 'reuseValueNumber': return (b.reuseValueNumber ?? -1) - (a.reuseValueNumber ?? -1);
        default: return 0;
      }
    });
    return sorted.map((s, i) => ({ ...s, seq: i + 1 }));
  }, [items, landingProgressFilters, sceneCategoryFilter, teamFilter, sortBy]);

  // ── Summary（基于筛选后的数据）──
  const summary = useMemo(() => {
    const totalSavedEfficiency = Math.round(tableData.reduce((sum, s) => sum + (s.monthlySavedHours ?? 0), 0) * 10) / 10;
    const totalMonthlySavedCost = tableData.reduce((sum, s) => {
      if (!s.monthlySavedCost) return sum;
      const num = typeof s.monthlySavedCost === 'number' ? s.monthlySavedCost : parseFloat(String(s.monthlySavedCost).replace(/[^0-9.\-]/g, ''));
      return sum + (num > 0 ? num : 0);
    }, 0);
    const totalMonthlySavedCostDisplay = totalMonthlySavedCost > 0 ? `¥${fmtF(Math.round(totalMonthlySavedCost))}` : '—';
    const totalMonthlySavedHoursSum = Math.round(tableData.reduce((sum, s) => sum + (s.totalSavedHours ?? 0), 0) * 10) / 10;
    const landedInFiltered = tableData.filter((d) => ['试点上线', '推广上线', '全面上线'].includes(d.landingProgress || '')).length;
    return {
      count: tableData.length,
      totalSavedEfficiency,
      totalMonthlySavedCostDisplay,
      totalMonthlySavedHoursSum,
      landedInFiltered,
    };
  }, [tableData]);

  // ── 统计图数据 ──
  const maxCat = useMemo(() => stats ? Math.max(...Object.values(stats.categoryMap), 1) : 1, [stats]);
  const maxTeam = useMemo(() => stats ? Math.max(...Object.values(stats.teamMap), 1) : 1, [stats]);

  // ── 筛选选项及计数 ──
  const landingProgressOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach((d) => { const p = d.landingProgress || '未标记'; counts[p] = (counts[p] || 0) + 1; });
    return LANDING_PROGRESS_OPTIONS.map((v) => ({ value: v, label: v, count: counts[v] ?? 0 }));
  }, [items]);

  const categoryOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach((d) => { const c = d.sceneCategory || '未分类'; counts[c] = (counts[c] || 0) + 1; });
    return [{ value: 'all', label: '全部', count: items.length }, ...SCENE_CATEGORY_OPTIONS.map((v) => ({ value: v, label: v, count: counts[v] ?? 0 }))];
  }, [items]);

  const teamOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach((d) => { const t = d.team || '未填写'; counts[t] = (counts[t] || 0) + 1; });
    const teams = Object.keys(counts).sort();
    return [{ value: 'all', label: '全部', count: items.length }, ...teams.map((t) => ({ value: t, label: t, count: counts[t] ?? 0 }))];
  }, [items]);

  // ── Table columns ──
  const columns: TableColumnsType<typeof tableData[number]> = [
    {
      title: '序号',
      dataIndex: 'seq',
      key: 'seq',
      width: 50,
      align: 'center',
      fixed: 'left',
      className: 'cho-frozen-rank',
      render: (seq: number) => <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{seq}</span>,
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
            <span>名称</span>
            <div
              className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-300"
              style={{ zIndex: 10 }}
              onMouseDown={(e) => {
                e.preventDefault();
                const startX = e.clientX;
                const startWidth = titleWidth;
                const onMouseMove = (e: MouseEvent) => setTitleWidth(Math.max(120, startWidth + e.clientX - startX));
                const onMouseUp = () => { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); };
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
            onClick={() => setSelectedItem(record)}
            className="text-xs font-medium truncate text-left hover:underline w-full"
            style={{ color: 'var(--primary)' }}
            onMouseEnter={() => handleRowEnter(record)}
            onMouseLeave={handleRowLeave}
          >
            {title || '—'}
          </button>
          <div className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{record.team || '—'}</div>
        </div>
      ),
    },
    {
      title: <FmtHeader label="价值星级" tip="按最终价值计分排名百分位分配：前20%=5星，前40%=4星，前60%=3星，前80%=2星，后20%=1星" />,
      dataIndex: 'valueStarLevel',
      key: 'valueStarLevel',
      width: 100,
      align: 'center',
      render: (v: number | null) => {
        if (v == null) return <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>;
        const starColor = v >= 4 ? '#F27F22' : v >= 3 ? '#2d5bc7' : '#94a3b8';
        return (
          <span className="inline-flex items-center gap-0.5">
            {Array.from({ length: v }, (_, i) => (
              <StarFilled key={i} style={{ fontSize: 11, color: starColor }} />
            ))}
            {Array.from({ length: 5 - v }, (_, i) => (
              <StarOutlined key={i} style={{ fontSize: 11, color: '#cbd5e1' }} />
            ))}
          </span>
        );
      },
    },
    {
      title: '落地进展',
      dataIndex: 'landingProgress',
      key: 'landingProgress',
      width: 120,
      align: 'center',
      render: (v: string | null) => {
        if (!v) return <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>;
        return <Tag color={PROGRESS_COLORS[v] || '#6b7280'} className="text-[11px]" style={{ margin: 0 }}>{v}</Tag>;
      },
    },
    {
      title: <FmtHeader label="计划启动/大赛进展" tip="计划启动日期和大赛进展状态" />,
      key: 'progressInfo',
      width: 180,
      align: 'center',
      render: (_: unknown, r: typeof tableData[number]) => (
        <div className="text-[11px]">
          <div style={{ color: 'var(--text-muted)' }}>{r.plannedStartDate ? `启动 ${r.plannedStartDate.slice(0, 7)}` : '—'}</div>
          <div className="mt-0.5">
            {r.competitionProgress ? (
              <Tag style={{ fontSize: 10, margin: 0, background: r.competitionProgress === '终审通过' ? 'rgba(242,127,34,0.1)' : 'rgba(26,58,138,0.08)', borderColor: r.competitionProgress === '终审通过' ? 'rgba(242,127,34,0.2)' : 'rgba(26,58,138,0.15)', color: r.competitionProgress === '终审通过' ? '#d97706' : '#1a3a8a' }}>{r.competitionProgress}</Tag>
            ) : <span style={{ color: '#cbd5e1' }}>—</span>}
          </div>
        </div>
      ),
    },
    // ── 改造成效 ──
    {
      title: <FmtHeader label="改造成效" tip="量化改造效果的4个核心指标" />,
      key: 'result-group',
      className: 'cho-group-result',
      children: [
        {
          title: <FmtHeader label="提效" tip="月均提效节省工时 = 原月均 - 新月均" />,
          dataIndex: 'monthlySavedHours', key: 'sh', width: 100, align: 'center', className: 'cho-col-result',
          render: (v: number | null) => <span className="font-mono text-xs font-bold" style={{ color: v != null && v > 0 ? '#16a34a' : 'var(--text-muted)' }}>{numOrDash(v, 'h')}</span>,
        },
        {
          title: <FmtHeader label="降本" tip="月均降本费用（不含人力成本）" />,
          dataIndex: 'monthlySavedCost', key: 'mc', width: 100, align: 'center', className: 'cho-col-result',
          render: (v: number | string | null) => <span className="font-mono text-xs" style={{ color: (typeof v === 'number' ? v : parseFloat(String(v || '0').replace(/[^0-9.\-]/g, ''))) > 0 ? '#d97706' : 'var(--text-muted)' }}>{fmtCost(v)}</span>,
        },
        {
          title: <FmtHeader label="节省工时" tip="= 月均提效节省工时 + 月均降本折算工时" />,
          dataIndex: 'totalSavedHours', key: 'tsh', width: 110, align: 'center', className: 'cho-col-result',
          render: (v: number | null) => <span className="font-mono text-xs font-bold" style={{ color: v != null && v > 0 ? '#16a34a' : 'var(--text-muted)' }}>{numOrDash(v, 'h')}</span>,
        },
      ],
    },
    // ── 复用价值 ──
    {
      title: <FmtHeader label="复用价值" tip="方案可复用的范围和地区系数" />,
      key: 'reuse-group',
      className: 'cho-group-reuse',
      children: [
        {
          title: <FmtHeader label="复用价值系数" tip="跨团队/BU 复用范围" />,
          dataIndex: 'reuseValue', key: 'rm', width: 180, align: 'center', className: 'cho-col-reuse',
          render: (v: string | null, record) => {
            if (!v) return <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>;
            const level = record.reuseValueLevel;
            const levelStyle: Record<string, { bg: string; fg: string; border: string }> = {
              '低价值': { bg: 'rgba(34,197,94,0.08)', fg: '#16a34a', border: 'rgba(34,197,94,0.2)' },
              '中价值': { bg: 'rgba(20,184,166,0.1)', fg: '#0d9488', border: 'rgba(20,184,166,0.25)' },
              '高价值': { bg: 'rgba(245,158,11,0.12)', fg: '#d97706', border: 'rgba(245,158,11,0.3)' },
              '极高价值': { bg: 'rgba(234,88,12,0.15)', fg: '#c2410c', border: 'rgba(234,88,12,0.35)' },
            };
            const s = levelStyle[level ?? ''] ?? { bg: 'rgba(0,0,0,0.04)', fg: 'var(--text-secondary)', border: 'rgba(0,0,0,0.08)' };
            return (
              <span className="inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap" style={{ background: s.bg, color: s.fg, border: `1px solid ${s.border}` }}>
                {v}
              </span>
            );
          },
        },
        {
          title: <FmtHeader label="地区系数" tip="场景归属地区系数" />,
          dataIndex: 'regionCoefficient', key: 'rc', width: 100, align: 'center', className: 'cho-col-reuse',
          render: (v: string | null) => <span className="text-xs font-medium" style={{ color: v ? 'var(--foreground)' : 'var(--text-muted)' }}>{v || '—'}</span>,
        },
      ],
    },
  ];

  // ── Guard ──
  if (authLoading) return <div className="flex justify-center items-center min-h-[60vh]"><Spin size="large" /></div>;
  if (!isAdmin) return null;

  return (
    <>
      <style jsx global>{`
        @keyframes breatheGlow {
          0%, 100% { box-shadow: 0 2px 8px rgba(0,0,0,0.04), 0 0 0 0 rgba(242,127,34,0); }
          50% { box-shadow: 0 2px 8px rgba(0,0,0,0.04), 0 0 16px 4px rgba(242,127,34,0.12); }
        }
        @keyframes slideUp {
          from { transform: translateY(24px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        /* 表格样式（与ChoDashboard一致） */
        .cho-frozen-rank {
          position: sticky !important;
          left: 0 !important;
          z-index: 3 !important;
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

      <div className="px-[100px]" style={{ paddingTop: 20 }}>
        {/* ─── 区块一：关键指标区 ─── */}
        {loading ? (
          <div className="flex justify-center items-center min-h-[40vh]"><Spin size="large" /></div>
        ) : stats ? (
          <div className="space-y-6">
            {/* 操作栏（与ChoDashboard风格一致） */}
            <div className="glass rounded-xl px-4 py-3 mb-2 flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
              <button
                onClick={handleRefresh}
                disabled={syncing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all hover:scale-105 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #d46b08, #f27f22)', boxShadow: '0 4px 15px rgba(242,127,34,0.3)' }}
              >
                <SyncOutlined spin={syncing} /> 刷新
              </button>
              <button
                onClick={() => setFilterExpanded(!filterExpanded)}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all hover:bg-gray-100"
                style={{ color: 'var(--text-muted)' }}
              >
                {filterExpanded ? '收起筛选' : '展开筛选'}
                <span className="text-[10px]">{filterExpanded ? '▲' : '▼'}</span>
              </button>
            </div>

            {/* 篮选面板 */}
            {filterExpanded && (
              <div className="glass rounded-xl px-4 py-3 mb-2" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
                <div className="space-y-2">
                  {/* 排序 */}
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
                  {/* 落地进展多选 */}
                  <MultiSelectFilterRow
                    label="落地进展"
                    icon={<RocketOutlined />}
                    options={landingProgressOptions}
                    values={landingProgressFilters}
                    onChange={setLandingProgressFilters}
                  />
                  {/* 场景分类 */}
                  <FilterRow
                    label="场景分类"
                    options={categoryOptions}
                    value={sceneCategoryFilter}
                    onChange={setSceneCategoryFilter}
                  />
                  {/* 提报团队 */}
                  <FilterRow
                    label="提报团队"
                    icon={<TeamOutlined />}
                    options={teamOptions}
                    value={teamFilter}
                    onChange={setTeamFilter}
                  />
                </div>
              </div>
            )}

            {/* 顶部统计卡 */}
            <div className="glass rounded-2xl p-5 mb-2" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard icon={<BarChartOutlined />} label="场景总数" value={String(summary.count)} color="var(--primary)" />
                <StatCard icon={<RocketOutlined />} label="已落地场景数" value={String(summary.landedInFiltered)} sub="试点+推广+全面上线" color="#16a34a" />
                <StatCard icon={<RiseOutlined />} label="月均提效工时" value={summary.totalSavedEfficiency > 0 ? `${summary.totalSavedEfficiency}h` : '—'} sub="= 原月均 - 新月均" color="#16a34a" highlight />
                <StatCard icon={<ThunderboltOutlined />} label="月均降本费用" value={summary.totalMonthlySavedCostDisplay} sub="不含人力成本" color="#d97706" />
              </div>
            </div>

            {/* 条形图区（缩小高度） */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* 按场景分类 */}
              <div className="glass rounded-xl overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
                <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.3)' }}>
                  <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>按场景分类</h3>
                </div>
                <div className="p-4">
                  {Object.entries(stats.categoryMap)
                    .sort((a, b) => b[1] - a[1])
                    .map(([cat, count]) => (
                      <div key={cat} onMouseEnter={showListHover(cat, items.filter((d) => d.sceneCategory === cat))} onMouseLeave={hideListHover} style={{ cursor: 'pointer' }}>
                        <HBar label={cat} value={count} max={maxCat} color={CATEGORY_COLORS[cat] || '#6b7280'} />
                      </div>
                    ))}
                </div>
              </div>
              {/* 按提报团队 */}
              <div className="glass rounded-xl overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
                <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.3)' }}>
                  <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>按提报团队</h3>
                </div>
                <div className="p-4">
                  {Object.entries(stats.teamMap)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10)
                    .map(([team, count]) => (
                      <div key={team} onMouseEnter={showListHover(team, items.filter((d) => d.team === team))} onMouseLeave={hideListHover} style={{ cursor: 'pointer' }}>
                        <HBar label={team} value={count} max={maxTeam} color="#1a3a8a" />
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* ─── 区块二：场景明细表 ─── */}
            <div className="glass rounded-2xl overflow-hidden cho-table-wrap" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
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

            {/* ─── 区块三：数据口径说明 ─── */}
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
                  <span className="text-[10px]" style={{ color: '#9ca3af' }}>定义：按全球HR时薪均值折算为工时数</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626' }}>3</span>
                  <span className="text-[11px] font-semibold" style={{ color: '#991b1b' }}>月节省总工时</span>
                  <span className="text-[11px] font-mono" style={{ color: '#b91c1c' }}>= 月均提效节省工时 + 月均降本折算工时</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'rgba(124,58,237,0.1)', color: '#7c3aed' }}>4</span>
                  <span className="text-[11px] font-semibold" style={{ color: '#5b21b6' }}>最终价值计分</span>
                  <span className="text-[11px] font-mono" style={{ color: '#6d28d9' }}>= 月均节省总工时 × 归属地区人力成本系数 × 复用价值系数</span>
                </div>
              </div>
              <div className="mt-3 pt-3 space-y-1" style={{ borderTop: '1px solid rgba(220,38,38,0.1)' }}>
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] font-semibold" style={{ color: '#F27F22' }}>地区系数</span>
                  <span className="text-[11px] font-mono" style={{ color: 'var(--foreground)' }}>国内 ×1 · 海外 ×2 · 全球 ×1.5</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] font-semibold" style={{ color: '#F27F22' }}>复用系数</span>
                  <span className="text-[11px] font-mono" style={{ color: 'var(--foreground)' }}>个人 ×1 · BU内 ×2 · 跨BU ×3 · 全集团 ×4</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* 悬浮弹窗 */}
        {hoveredRow && (
          <div
            style={{ position: 'fixed', top: '50%', left: '55%', transform: 'translate(-50%, -50%)', zIndex: 1050, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px)', borderRadius: 14, padding: '16px 20px', boxShadow: '0 12px 48px rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.7)', maxWidth: 460 }}
            onMouseEnter={handleDetailEnter}
            onMouseLeave={handleDetailLeave}
          >
            <SceneDetailPopup item={hoveredRow} />
          </div>
        )}

        {listHover && (
          <div
            style={{ position: 'fixed', left: listHover.x, top: listHover.y, zIndex: 1050, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px)', borderRadius: 10, padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.14)', border: '1px solid rgba(255,255,255,0.6)', maxWidth: 560 }}
            onMouseEnter={handleListEnter}
            onMouseLeave={handleListLeave}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: '#1a3a8a', marginBottom: 6 }}>{listHover.label} · {listHover.items.length} 个场景</div>
            <SceneHoverList items={listHover.items} />
          </div>
        )}

        {selectedItem && <SceneDrillDownModal item={selectedItem} onClose={() => setSelectedItem(null)} />}
      </div>
    </>
  );
}
