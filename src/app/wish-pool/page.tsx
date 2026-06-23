'use client';

import { Suspense, useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Spin, Tag, App, Tabs } from 'antd';
import {
  SyncOutlined,
  RocketOutlined,
  BarChartOutlined,
  RiseOutlined,
  ThunderboltOutlined,
  DownloadOutlined,
  EyeOutlined,
  HourglassOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/lib/auth-context';
import type { FieldSelectOption } from '@/lib/bitable/field-map';
import { FIELD_LABELS } from '@/lib/bitable/labels';
import { summarizeValueMetrics } from '@/lib/bitable/metrics';
import { applyExportImageCloneLayout, getExportImageCaptureWidth } from '@/lib/export-image-style';
import {
  partitionProgressStates, buildProgressColorMap,
  buildCategoryColorMap, FALLBACK_COLOR,
} from '@/lib/bitable/enums';
import {
  DetailListBlock,
  WishItem,
  fmt, fmtF, fmtCost,
} from '@/components/DetailListBlock';

// ── WishItem 类型已从 DetailListBlock 共享组件 import ──

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

// ── 常量与工具函数已从 DetailListBlock 共享组件 import ──

// ── 水平条形图 ──
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

// ── 统计卡片 ──
function StatCard({ icon, label, value, sub, color, highlight }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color: string; highlight?: boolean;
}) {
  return (
    <div
      className="glass rounded-xl p-4 flex flex-col items-center text-center"
      style={{
        borderColor: highlight ? 'rgba(26,58,138,0.3)' : 'rgba(255, 255, 255, 0.6)',
        background: highlight ? 'rgba(26,58,138,0.04)' : undefined,
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

// ── 饼图（SVG donut）──
function ProgressDonut({ progressMap, total, landedStates, pendingStates, progressColors }: {
  progressMap: Record<string, number>; total: number;
  landedStates: string[]; pendingStates: string[]; progressColors: Record<string, string>;
}) {
  const landedTotal = landedStates.reduce((s, k) => s + (progressMap[k] || 0), 0);
  const pendingTotal = pendingStates.reduce((s, k) => s + (progressMap[k] || 0), 0);
  const allStates = [...landedStates, ...pendingStates];
  const segments = allStates.map((state) => ({
    state,
    count: progressMap[state] || 0,
    color: progressColors[state] || '#cbd5e1',
    group: landedStates.includes(state) ? '已落地' : '待实现',
  }));

  // SVG arc calculation
  const cx = 100, cy = 100, outerR = 80, innerR = 55;
  let cumAngle = 0;
  const arcs = segments.map((seg) => {
    const angle = total > 0 ? (seg.count / total) * 360 : 0;
    const startAngle = cumAngle;
    cumAngle += angle;
    return { ...seg, startAngle, endAngle: cumAngle, angle };
  });

  const describeArc = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
  };
  const polarToCartesian = (cx: number, cy: number, r: number, angle: number) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  return (
    <div className="flex items-center gap-6">
      <svg width={200} height={200} viewBox="0 0 200 200">
        {/* 外圈 segments */}
        {arcs.map((arc, i) => {
          if (arc.angle < 0.5) return null;
          const outerPath = describeArc(cx, cy, outerR, arc.startAngle, arc.endAngle);
          const startInner = polarToCartesian(cx, cy, innerR, arc.startAngle);
          const endInner = polarToCartesian(cx, cy, innerR, arc.endAngle);
          return (
            <path key={i}
              d={`${outerPath} L ${startInner.x} ${startInner.y} A ${innerR} ${innerR} 0 ${arc.angle > 180 ? 1 : 0} 1 ${endInner.x} ${endInner.y} Z`}
              fill={arc.color} opacity={0.85}
              style={{ transition: 'opacity 0.2s' }}
            />
          );
        })}
        {/* 中心文字 */}
        <text x={cx} y={cy - 8} textAnchor="middle" style={{ fontSize: 14, fontWeight: 800, fill: '#1a3a8a', fontFamily: 'SF Mono, monospace' }}>{landedTotal}</text>
        <text x={cx} y={cy + 8} textAnchor="middle" style={{ fontSize: 9, fill: '#64748b' }}>已落地</text>
        <text x={cx} y={cy + 22} textAnchor="middle" style={{ fontSize: 9, fill: '#94a3b8' }}>待实现 {pendingTotal}</text>
      </svg>
      {/* Legend */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-block w-3 h-3 rounded-full" style={{ background: '#1a3a8a' }} />
          <span className="text-xs font-semibold" style={{ color: '#1a3a8a' }}>已落地 {landedTotal}</span>
        </div>
        {landedStates.map((s) => (
          <div key={s} className="flex items-center gap-2 ml-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: progressColors[s] }} />
            <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{s} {progressMap[s] || 0}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 mb-2 mt-2">
          <span className="inline-block w-3 h-3 rounded-full" style={{ background: '#94a3b8' }} />
          <span className="text-xs font-semibold" style={{ color: '#94a3b8' }}>待实现 {pendingTotal}</span>
        </div>
        {pendingStates.map((s) => (
          <div key={s} className="flex items-center gap-2 ml-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: progressColors[s] }} />
            <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{s} {progressMap[s] || 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 场景详情悬浮弹窗 ──
function SceneDetailPopup({ item, categoryColors, progressColors }: { item: WishItem; categoryColors: Record<string, string>; progressColors: Record<string, string> }) {
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
      <div style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          {item.proposalNo && <Tag style={{ fontSize: 10, margin: 0, background: 'rgba(26,58,138,0.1)', borderColor: 'rgba(26,58,138,0.2)', color: '#1a3a8a' }}>{item.proposalNo}</Tag>}
          {item.sceneCategory && <Tag color={categoryColors[item.sceneCategory] || FALLBACK_COLOR} style={{ fontSize: 10, margin: 0 }}>{item.sceneCategory}</Tag>}
          {item.landingProgress && <Tag color={progressColors[item.landingProgress] || FALLBACK_COLOR} style={{ fontSize: 10, margin: 0 }}>{item.landingProgress}</Tag>}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.3 }}>{item.title || '未命名场景'}</div>
        {item.briefIntro && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{item.briefIntro}</div>}
      </div>

      {sectionTitle('场景信息', '#1a3a8a')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
        {row('核心价值', item.coreValue)}{row('场景来源', item.sceneSource)}
        {row('业务负责人', arr(item.bizOwner))}{row('AI负责人', arr(item.aiOwner))}
        {row('计划启动', item.plannedStartDate?.slice(0, 10))}
      </div>

      {sectionTitle('AI前指标', '#1a3a8a')}
      {item.beforeProcess && row('原业务流程', item.beforeProcess.length > 80 ? item.beforeProcess.slice(0, 80) + '…' : item.beforeProcess, true)}
      {item.painPoints && item.painPoints.length > 0 && row('原核心痛点', item.painPoints.join('、'), true)}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
        {row('原操作频次', item.beforeFreq ? `${item.beforeFreq}次/月` : null)}
        {row('原操作人数', item.beforePeopleCount ? `${item.beforePeopleCount}人` : null)}
        {row('单次耗时', item.beforeHoursPerTask ? `${item.beforeHoursPerTask}h` : null)}
        {row('原月均耗时', item.beforeMonthlyHours ? `${fmtF(Math.round(item.beforeMonthlyHours))}h` : null)}
      </div>

      {sectionTitle('价值计分指标', '#F27F22')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
        {row(FIELD_LABELS.monthlySavedHours, item.monthlySavedHours ? `${fmtF(Math.round(item.monthlySavedHours))}h` : null)}
        {row(FIELD_LABELS.monthlySavedCost, item.monthlySavedCost ? fmtCost(item.monthlySavedCost) : null)}
        {row(FIELD_LABELS.costSavedHours, item.costSavedHours ? `${fmtF(Math.round(item.costSavedHours))}h` : null)}
        {row(FIELD_LABELS.totalSavedHours, item.totalSavedHours ? `${fmtF(Math.round(item.totalSavedHours))}h` : null)}
        {row(FIELD_LABELS.totalEfficiencyRate, item.totalEfficiencyRate ? `${(item.totalEfficiencyRate * 100).toFixed(1)}%` : null)}
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

// ── 悬浮明细列表 ──
function SceneHoverList({ items, progressColors }: { items: WishItem[]; progressColors: Record<string, string> }) {
  return (
    <div style={{ maxHeight: 360, overflowY: 'auto', overflowX: 'auto' }}>
      <table style={{ fontSize: 11, borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
        <thead>
          <tr>
            {['场景', FIELD_LABELS.team, FIELD_LABELS.landingProgress, FIELD_LABELS.totalSavedHours, FIELD_LABELS.reuseValue, '地区'].map((h) => (
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
                {item.landingProgress ? <Tag color={progressColors[item.landingProgress] || FALLBACK_COLOR} style={{ fontSize: 10, margin: 0, lineHeight: '16px' }}>{item.landingProgress}</Tag> : <span style={{ color: '#cbd5e1' }}>—</span>}
              </td>
              <td style={{ padding: '4px 8px', color: 'var(--text-secondary)', fontFamily: 'SF Mono, monospace' }}>{item.totalSavedHours || item.monthlySavedHours ? `${fmt(item.totalSavedHours || item.monthlySavedHours || 0)}h` : '—'}</td>
              <td style={{ padding: '4px 8px', color: 'var(--text-secondary)' }}>{item.reuseValue || '—'}</td>
              <td style={{ padding: '4px 8px', color: 'var(--text-secondary)' }}>{item.regionCoefficient || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── 下钻详情弹窗 ──
function SceneDrillDownModal({ item, onClose }: { item: WishItem; onClose: () => void }) {
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
      <div style={{ width: '92%', maxWidth: 720, maxHeight: '85vh', background: 'rgba(255,255,255,0.98)', backdropFilter: 'blur(24px)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', animation: 'slideUp 0.3s ease-out' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ background: 'linear-gradient(135deg, #1a3a8a, #2d5bc7)', padding: '20px 24px', color: 'white', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            {item.proposalNo && <Tag style={{ fontSize: 11, margin: 0, background: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)', color: 'white' }}>{item.proposalNo}</Tag>}
            {item.sceneCategory && <Tag style={{ fontSize: 11, margin: 0, background: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)', color: 'white' }}>{item.sceneCategory}</Tag>}
            {item.landingProgress && <Tag style={{ fontSize: 11, margin: 0, background: 'rgba(255,255,255,0.25)', borderColor: 'rgba(255,255,255,0.4)', color: 'white' }}>{item.landingProgress}</Tag>}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.3 }}>{item.title || '未命名场景'}</div>
          <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
        <div style={{ padding: '0 24px 24px', maxHeight: 'calc(85vh - 120px)', overflowY: 'auto' }}>
          <div style={{ display: 'flex', gap: 24, padding: '16px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>最终价值计分</div><div style={{ fontSize: 28, fontWeight: 800, color: '#F27F22', fontFamily: 'SF Mono, monospace' }}>{item.finalValueScore ? fmtF(Math.round(item.finalValueScore)) : '-'}</div></div>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>价值排名</div><div style={{ fontSize: 28, fontWeight: 800, color: '#1a3a8a', fontFamily: 'SF Mono, monospace' }}>{item.valueRank ? `#${item.valueRank}` : '-'}</div></div>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>月均节省总工时</div><div style={{ fontSize: 28, fontWeight: 800, color: '#2d5bc7', fontFamily: 'SF Mono, monospace' }}>{item.totalSavedHours ? `${fmtF(Math.round(item.totalSavedHours))}h` : '-'}</div></div>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{FIELD_LABELS.totalEfficiencyRate}</div><div style={{ fontSize: 28, fontWeight: 800, color: '#4a7de0', fontFamily: 'SF Mono, monospace' }}>{item.totalEfficiencyRate ? `${(item.totalEfficiencyRate * 100).toFixed(1)}%` : '-'}</div></div>
          </div>

          {sectionTitle('场景信息', '#1a3a8a')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px' }}>
            {row('核心价值', item.coreValue)}{row('场景来源', item.sceneSource)}
            {row('业务负责人', arr(item.bizOwner))}{row('AI负责人', arr(item.aiOwner))}
            {row('提报团队', item.team)}{row('AI工具', arr(item.aiTools))}
            {row('计划启动', item.plannedStartDate?.slice(0, 10))}{row('试点上线', item.pilotDate?.slice(0, 10))}
            {row('推广上线', item.rolloutDate?.slice(0, 10))}{row('全面上线', item.fullLaunchDate?.slice(0, 10))}
          </div>

          {sectionTitle('AI前指标', '#1a3a8a')}
          {item.beforeProcess && row('原业务流程', item.beforeProcess, true)}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px' }}>
            {row('原操作频次', item.beforeFreq ? `${item.beforeFreq}次/月` : null)}{row('原操作人数', item.beforePeopleCount ? `${item.beforePeopleCount}人` : null)}
            {row('原单次耗时', item.beforeHoursPerTask ? `${item.beforeHoursPerTask}h` : null)}{row('原月均耗时', item.beforeMonthlyHours ? `${fmtF(Math.round(item.beforeMonthlyHours))}h` : null)}
          </div>

          {sectionTitle('AI后指标', '#1a3a8a')}
          {item.afterProcess && row('新业务流程', item.afterProcess, true)}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px' }}>
            {row('新操作频次', item.afterFreq ? `${item.afterFreq}次/月` : null)}{row('新操作人数', item.afterPeopleCount ? `${item.afterPeopleCount}人` : null)}
            {row('新单次耗时', item.afterHoursPerTask ? `${item.afterHoursPerTask}h` : null)}{row('新月均耗时', item.afterMonthlyHours ? `${fmtF(Math.round(item.afterMonthlyHours))}h` : null)}
          </div>

          {sectionTitle('价值计分指标', '#F27F22')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px' }}>
            {row(FIELD_LABELS.monthlySavedHours, item.monthlySavedHours ? `${fmtF(Math.round(item.monthlySavedHours))}h` : null)}
            {row(FIELD_LABELS.monthlySavedCost, item.monthlySavedCost ? fmtCost(item.monthlySavedCost) : null)}
            {row(FIELD_LABELS.costSavedHours, item.costSavedHours ? `${fmtF(Math.round(item.costSavedHours))}h` : null)}
            {row(FIELD_LABELS.totalSavedHours, item.totalSavedHours ? `${fmtF(Math.round(item.totalSavedHours))}h` : null)}
            {row('地区系数', item.regionCoefficient)}{row('复用价值系数', item.reuseValue)}
          </div>

          {(item.implementation || item.implementationLink) && (
            <>
              {sectionTitle('AI实现过程', '#2d5bc7')}
              {item.implementation && <div style={{ fontSize: 13, color: 'var(--foreground)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{item.implementation}</div>}
              {item.implementationLink && <a href={item.implementationLink} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 8, fontSize: 13, color: '#1a3a8a' }}>查看实现效果 →</a>}
            </>
          )}

          {item.recordUrl && (
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              <a href={item.recordUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#1a3a8a' }}>在飞书多维表格中查看 →</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 核心公式区块 ──
function FormulaSection() {
  return (
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
          <span className="text-[10px]" style={{ color: '#9ca3af' }}>按全球HR时薪均值折算</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626' }}>3</span>
          <span className="text-[11px] font-semibold" style={{ color: '#991b1b' }}>{FIELD_LABELS.totalSavedHours}</span>
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
          <span className="text-[11px] font-semibold" style={{ color: '#1a3a8a' }}>地区系数</span>
          <span className="text-[11px] font-mono" style={{ color: 'var(--foreground)' }}>国内 ×1 · 海外 ×2 · 全球 ×1.5</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] font-semibold" style={{ color: '#1a3a8a' }}>复用系数</span>
          <span className="text-[11px] font-mono" style={{ color: 'var(--foreground)' }}>个人 ×1 · BU内 ×2 · 跨BU ×3 · 全集团 ×4</span>
        </div>
      </div>
    </div>
  );
}

// ── DetailListBlock 已提取为共享组件，从 @/components/DetailListBlock import ──

// ── 主页面内容 ──
function WishPoolContent() {
  const { hasPermission } = useAuth();
  const canSyncSnapshot = hasPermission('competition.sync');
  const canExportImage = hasPermission('wishpool.export-image');
  const { message } = App.useApp();

  const [items, setItems] = useState<WishItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [fieldDescriptions, setFieldDescriptions] = useState<Record<string, string>>({});
  const [fieldOptions, setFieldOptions] = useState<Record<string, FieldSelectOption[]>>({});

  // ── 动态枚举（从飞书 fieldOptions 构建，不硬编码）──
  const landedStates = useMemo(() => partitionProgressStates(fieldOptions.landingProgress).landed, [fieldOptions]);
  const pendingStates = useMemo(() => partitionProgressStates(fieldOptions.landingProgress).pending, [fieldOptions]);
  const categoryColors = useMemo(() => buildCategoryColorMap(fieldOptions.sceneCategory), [fieldOptions]);
  const progressColors = useMemo(() => buildProgressColorMap(fieldOptions.landingProgress), [fieldOptions]);

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview');
  const [hoveredRow, setHoveredRow] = useState<WishItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<WishItem | null>(null);
  const [listHover, setListHover] = useState<{ label: string; items: WishItem[]; x: number; y: number } | null>(null);

  const detailTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const listTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // 悬浮处理
  const handleRowEnter = (item: WishItem) => { clearTimeout(detailTimer.current); setHoveredRow(item); };
  const handleRowLeave = () => { detailTimer.current = setTimeout(() => setHoveredRow(null), 200); };
  const handleDetailEnter = () => { clearTimeout(detailTimer.current); };
  const handleDetailLeave = () => { setHoveredRow(null); };
  const showListHover = (label: string, hoverItems: WishItem[]) => (e: React.MouseEvent) => {
    clearTimeout(listTimer.current);
    let x = e.clientX + 15, y = e.clientY + 15;
    if (x + 520 > window.innerWidth - 16) x = e.clientX - 535;
    if (y + 400 > window.innerHeight - 16) y = window.innerHeight - 416;
    setListHover({ label, items: hoverItems, x, y });
  };
  const hideListHover = () => { listTimer.current = setTimeout(() => setListHover(null), 200); };
  const handleListEnter = () => { clearTimeout(listTimer.current); };
  const handleListLeave = () => { setListHover(null); };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/wish-pool');
      if (!res.ok) throw new Error('获取失败');
      const data = await res.json();
      setItems(data.items || []);
      setStats(data.stats);
      setFieldDescriptions(data.fieldDescriptions || {});
      setFieldOptions(data.fieldOptions || {});
    } catch { message.error('获取场景池数据失败'); }
    finally { setLoading(false); }
  }, [message]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchData(); }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchData]);

  const handleRefresh = async () => {
    setSyncing(true);
    try {
      // 第一步：同步飞书字段映射（含 options 选项列表），确保筛选枚举是最新的
      const syncRes = await fetch('/api/wish-pool/sync', { method: 'POST' });
      if (!syncRes.ok) throw new Error('快照同步失败');
      // 第二步：重新拉取数据 + 已更新的 fieldOptions
      await fetchData();
      message.success('快照已刷新');
    } catch { message.error('同步失败，请稍后重试'); }
    finally { setSyncing(false); }
  };

  // ── 导出图片 ──
  const handleExportImage = async () => {
    setExporting(true);
    try {
      const html2canvas = (await import('html2canvas-pro')).default;
      const element = document.getElementById('wish-pool-export');
      if (!element) return;
      await new Promise((r) => setTimeout(r, 100));
      const realTable = element.querySelector('.ant-table table') as HTMLElement | null;
      const realTableContent = element.querySelector('.ant-table-content') as HTMLElement | null;
      const contentWidth = Math.max(
        realTable?.scrollWidth ?? 0,
        realTableContent?.scrollWidth ?? 0,
        element.scrollWidth,
      );
      const captureWidth = getExportImageCaptureWidth(contentWidth);
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#f8fafc',
        logging: false,
        windowWidth: captureWidth,
        windowHeight: element.scrollHeight + 400,
        onclone: (clonedDoc) => {
          const clonedEl = clonedDoc.getElementById('wish-pool-export');
          if (!clonedEl) return;
          applyExportImageCloneLayout(clonedEl, { width: contentWidth });
        },
      });
      const link = document.createElement('a');
      link.download = `场景池_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch { message.error('导出失败'); }
    finally { setExporting(false); }
  };

  // ── 已落地/待实现数据 ──
  const landedItems = useMemo(() => items.filter((d) => landedStates.includes(d.landingProgress || '')), [items, landedStates]);
  const pendingItems = useMemo(() => items.filter((d) => pendingStates.includes(d.landingProgress || '')), [items, pendingStates]);

  // ── Summary ──
  const overviewSummary = useMemo(() => {
    const valueSummary = summarizeValueMetrics(items);
    return {
      total: items.length,
      landedCount: stats?.landedCount ?? 0,
      totalSavedEff: valueSummary.totalSavedEfficiency,
      totalSavedCostDisplay: valueSummary.totalMonthlySavedCostDisplay,
    };
  }, [items, stats]);

  // ── 统计图 ──
  const maxCat = useMemo(() => stats ? Math.max(...Object.values(stats.categoryMap), 1) : 1, [stats]);
  const maxTeam = useMemo(() => stats ? Math.max(...Object.values(stats.teamMap), 1) : 1, [stats]);

  return (
    <>
      <style jsx global>{`
        @keyframes breatheGlow {
          0%, 100% { box-shadow: 0 2px 8px rgba(0,0,0,0.04), 0 0 0 0 rgba(26,58,138,0); }
          50% { box-shadow: 0 2px 8px rgba(0,0,0,0.04), 0 0 16px 4px rgba(26,58,138,0.12); }
        }
        @keyframes slideUp {
          from { transform: translateY(24px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .cho-frozen-rank { position: sticky !important; left: 0 !important; z-index: 3 !important; }
        .cho-group-result > .ant-table-cell { background: #e0e7ff !important; border-left: 3px solid #4f46e5 !important; border-top: 3px solid #4f46e5 !important; color: #3730a3 !important; }
        .cho-group-reuse > .ant-table-cell { background: #fff7ed !important; border-left: 3px solid #ea580c !important; border-top: 3px solid #ea580c !important; color: #c2410c !important; }
        .cho-col-result { background: rgba(224, 231, 255, 0.25) !important; }
        .cho-col-reuse { background: rgba(255, 237, 213, 0.3) !important; }
        .cho-table-row:hover .cho-col-result { background: rgba(224, 231, 255, 0.45) !important; }
        .cho-table-row:hover .cho-col-reuse { background: rgba(255, 237, 213, 0.55) !important; }
        .cho-table-row td { border-bottom: 1px solid rgba(0, 0, 0, 0.04) !important; padding: 10px 8px !important; }
        .ant-table-thead > tr > th { padding: 7px 8px !important; font-size: 11px !important; font-weight: 600 !important; }
      `}</style>

      <div className="px-[100px]" style={{ paddingTop: 20 }}>
        {loading ? (
          <div className="flex justify-center items-center min-h-[40vh]"><Spin size="large" /></div>
        ) : stats ? (
          <div id="wish-pool-export">
            {/* 操作栏 */}
            <div className="flex items-center gap-2 mb-2" data-export-exclude>
              {canSyncSnapshot && (
                <button onClick={handleRefresh} disabled={syncing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all hover:scale-105 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #1a3a8a, #2d5bc7)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <SyncOutlined spin={syncing} /> 同步快照
                </button>
              )}
              {canExportImage && (
                <button onClick={handleExportImage} disabled={exporting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105 disabled:opacity-50"
                  style={{ background: 'white', color: '#1a3a8a', border: '1px solid #d1d5db' }}>
                  <DownloadOutlined spin={exporting} /> 导出图片
                </button>
              )}
            </div>

            {/* 三视图 Tabs */}
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              size="small"
              items={[
                {
                  key: 'overview',
                  label: <span className="flex items-center gap-1"><EyeOutlined /> 数据总览</span>,
                  children: (
                    <div className="space-y-4" data-export-stack>
                      {/* 统计卡 */}
                      <div className="glass rounded-2xl p-5" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <StatCard icon={<BarChartOutlined />} label="场景总数" value={String(overviewSummary.total)} color="#1a3a8a" />
                          <StatCard icon={<RocketOutlined />} label="已落地场景数" value={String(overviewSummary.landedCount)} sub="所有上线状态" color="#2d5bc7" />
                          <StatCard icon={<RiseOutlined />} label={FIELD_LABELS.monthlySavedHours} value={overviewSummary.totalSavedEff > 0 ? `${overviewSummary.totalSavedEff}h` : '—'} sub="= 原月均 - 新月均" color="#1a3a8a" highlight />
                          <StatCard icon={<ThunderboltOutlined />} label={FIELD_LABELS.monthlySavedCost} value={overviewSummary.totalSavedCostDisplay} sub="不含人力成本" color="#4a7de0" />
                        </div>
                      </div>

                      {/* 条形图 + 饼图 */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* 按场景分类 */}
                        <div className="glass rounded-xl overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
                          <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.3)' }}>
                            <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>按场景分类</h3>
                          </div>
                          <div className="p-4">
                            {Object.entries(stats.categoryMap).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                              <div key={cat} onMouseEnter={showListHover(cat, items.filter((d) => d.sceneCategory === cat))} onMouseLeave={hideListHover} style={{ cursor: 'pointer' }}>
                                <HBar label={cat} value={count} max={maxCat} color={categoryColors[cat] || FALLBACK_COLOR} />
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
                            {Object.entries(stats.teamMap).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([team, count]) => (
                              <div key={team} onMouseEnter={showListHover(team, items.filter((d) => d.team === team))} onMouseLeave={hideListHover} style={{ cursor: 'pointer' }}>
                                <HBar label={team} value={count} max={maxTeam} color="#1a3a8a" />
                              </div>
                            ))}
                          </div>
                        </div>
                        {/* 落地进展分布饼图 */}
                        <div className="glass rounded-xl overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
                          <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.3)' }}>
                            <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>落地进展分布</h3>
                          </div>
                          <div className="p-4 flex justify-center">
                            <ProgressDonut progressMap={stats.progressMap} total={stats.total} landedStates={landedStates} pendingStates={pendingStates} progressColors={progressColors} />
                          </div>
                        </div>
                      </div>

                      <FormulaSection />

                      {/* 数据总览明细列表 */}
                      <DetailListBlock
                        baseList={items}
                        label="场景"
                        emptyText="暂无场景数据"
                        showMetrics
                        fieldDescriptions={fieldDescriptions}
                        fieldOptions={fieldOptions}
                        progressColors={progressColors}
                        onRowEnter={handleRowEnter}
                        onRowLeave={handleRowLeave}
                        onSelectItem={setSelectedItem}
                      />
                    </div>
                  ),
                },
                {
                  key: 'landed',
                  label: <span className="flex items-center gap-1"><RocketOutlined /> 已落地场景明细</span>,
                  children: (
                    <div className="space-y-2" data-export-stack>
                      <DetailListBlock
                        baseList={landedItems}
                        label="已落地场景"
                        emptyText="暂无已落地场景"
                        showMetrics
                        fieldDescriptions={fieldDescriptions}
                        fieldOptions={fieldOptions}
                        progressColors={progressColors}
                        onRowEnter={handleRowEnter}
                        onRowLeave={handleRowLeave}
                        onSelectItem={setSelectedItem}
                      />
                      <FormulaSection />
                    </div>
                  ),
                },
                {
                  key: 'pending',
                  label: <span className="flex items-center gap-1"><HourglassOutlined /> 待实现场景明细</span>,
                  children: (
                    <div className="space-y-2" data-export-stack>
                      <DetailListBlock
                        baseList={pendingItems}
                        label="待实现场景"
                        emptyText="暂无待实现场景"
                        showMetrics={false}
                        labelColor="#94a3b8"
                        showPendingDates
                        fieldDescriptions={fieldDescriptions}
                        fieldOptions={fieldOptions}
                        progressColors={progressColors}
                        onRowEnter={handleRowEnter}
                        onRowLeave={handleRowLeave}
                        onSelectItem={setSelectedItem}
                      />
                      <FormulaSection />
                    </div>
                  ),
                },
              ]}
            />
          </div>
        ) : null}

        {/* 悬浮弹窗 */}
        {hoveredRow && (
          <div style={{ position: 'fixed', top: '50%', left: '55%', transform: 'translate(-50%, -50%)', zIndex: 1050, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px)', borderRadius: 14, padding: '16px 20px', boxShadow: '0 12px 48px rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.7)', maxWidth: 460 }}
            onMouseEnter={handleDetailEnter} onMouseLeave={handleDetailLeave}>
            <SceneDetailPopup item={hoveredRow} categoryColors={categoryColors} progressColors={progressColors} />
          </div>
        )}
        {listHover && (
          <div style={{ position: 'fixed', left: listHover.x, top: listHover.y, zIndex: 1050, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px)', borderRadius: 10, padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.14)', border: '1px solid rgba(255,255,255,0.6)', maxWidth: 560 }}
            onMouseEnter={handleListEnter} onMouseLeave={handleListLeave}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#1a3a8a', marginBottom: 6 }}>{listHover.label} · {listHover.items.length} 个场景</div>
            <SceneHoverList items={listHover.items} progressColors={progressColors} />
          </div>
        )}
        {selectedItem && <SceneDrillDownModal item={selectedItem} onClose={() => setSelectedItem(null)} />}
      </div>
    </>
  );
}

// ── 导出（Suspense 包裹 useSearchParams）──
export default function WishPoolPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center min-h-[60vh]"><Spin size="large" /></div>}>
      <WishPoolContent />
    </Suspense>
  );
}
