'use client';

import { useMemo } from 'react';
import {
  ALL_COMPETITION_PERIODS,
  buildCompetitionTimelinePeriods,
  isAllCompetitionPeriod,
} from '@/lib/competition-periods';

export interface CompetitionPeriodStats {
  total: number;
  byStatus: Record<string, number>;
}

interface CompetitionPeriodTimelineProps {
  activePeriods: string[];
  selectedPeriod: string;
  periodMap: Record<string, CompetitionPeriodStats>;
  allCount: number;
  onSelect: (period: string) => void;
  onFutureClick?: (period: string) => void;
  title?: string;
  hint?: string;
}

export default function CompetitionPeriodTimeline({
  activePeriods,
  selectedPeriod,
  periodMap,
  allCount,
  onSelect,
  onFutureClick,
  title = '赛事时间线',
  hint = '点击节点查看该周期参赛方案 ↓',
}: CompetitionPeriodTimelineProps) {
  const timelinePeriods = useMemo(() => buildCompetitionTimelinePeriods(activePeriods), [activePeriods]);

  if (activePeriods.length === 0) return null;

  return (
    <div className="glass rounded-xl" style={{ borderColor: 'rgba(255,255,255,0.6)', padding: '16px 20px 20px' }}>
      <div className="flex items-center gap-2 mb-2">
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>{title}</span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: 'rgba(242,127,34,0.1)', color: '#F27F22', border: '1px solid rgba(242,127,34,0.2)' }}>
          {hint}
        </span>
      </div>

      <div className="flex" style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 30, height: 1.5, background: 'linear-gradient(90deg, rgba(26,58,138,0.4) 0%, rgba(26,58,138,0.15) 50%, rgba(148,163,184,0.1) 100%)' }} />

        {timelinePeriods.map((periodValue) => {
          const isAll = isAllCompetitionPeriod(periodValue);
          const isActive = isAll || activePeriods.includes(periodValue);
          const isFuture = !isAll && !isActive;
          const isSelected = periodValue === selectedPeriod;
          const info = periodMap[periodValue];
          const done = info?.byStatus['终审通过'] || 0;
          const reviewing = info?.byStatus['评审中'] || 0;
          const statusLabel = done === (info?.total || 0) && info?.total > 0 ? '已结项' : reviewing > 0 ? '评审中' : '';
          const tickColor = isSelected ? '#F27F22' : isActive ? '#1a3a8a' : '#94a3b8';
          const tickWidth = isSelected ? 3 : isActive ? 2.5 : 1;
          const tickHeight = isActive ? 20 : 10;

          return (
            <div
              key={periodValue}
              style={{
                flex: isAll ? 0.9 : isActive ? 1.2 : 0.7,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: isActive ? 'pointer' : 'default',
              }}
              className="hover:-translate-y-0.5 transition-transform"
              onClick={() => {
                if (isFuture) {
                  onFutureClick?.(periodValue);
                  return;
                }
                onSelect(periodValue);
              }}
            >
              <div style={{
                fontSize: isAll ? 13 : isActive ? 16 : 12,
                fontWeight: isActive ? 800 : 400,
                fontFamily: isAll ? undefined : 'SF Mono, Menlo, monospace',
                color: isSelected ? '#F27F22' : isActive ? '#1a3a8a' : '#94a3b8',
                marginBottom: 4,
                lineHeight: 1,
              }}>
                {isAll ? '全部' : periodValue}
              </div>

              <div style={{
                width: tickWidth,
                height: tickHeight,
                background: tickColor,
                borderRadius: 1,
                transition: 'all 0.3s ease',
              }} />

              <div style={{ marginTop: 6, textAlign: 'center' }}>
                {isAll ? (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{allCount}个方案</div>
                ) : isFuture ? (
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
  );
}

export { ALL_COMPETITION_PERIODS };
