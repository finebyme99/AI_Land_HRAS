'use client';

import { useState } from 'react';
import { Tag } from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  ToolOutlined,
  LinkOutlined,
} from '@ant-design/icons';

export interface Submission {
  id: string;
  recordUrl?: string;
  title?: string;
  submitter?: string[];
  teamMembers?: string[];
  team?: string | string[];
  track?: string;
  sceneCategory?: string;
  aiTools?: string[];
  efficiencyRate?: number;
  monthlySavedHours?: number;
  beforeProcess?: string;
  painPoints?: string[];
  afterProcess?: string;
  beforeHoursPerPerson?: number;
  beforePeopleCount?: number;
  afterHoursPerPerson?: number;
  afterPeopleCount?: number;
  aiCost?: number;
  extraValue?: string;
  verifier?: string[];
  sourceUrl?: string;
  status?: string;
  proposalNo?: number;
}

const TRACK_COLORS: Record<string, string> = {
  '降本提效（实现已有场景降本提效）': '#1a3a8a',
  '增值创新（实现新的场景突破创新）': '#F27F22',
};

const STATUS_COLORS: Record<string, string> = {
  '待提交人补充方案': 'default',
  '待提交人调整方案': 'orange',
  '评审中': 'blue',
  '终审通过': 'green',
  '并入其他方案': 'gray',
};

function formatPercent(val?: number): string {
  if (val == null) return '-';
  return `${(val * 100).toFixed(1)}%`;
}

export default function CompetitionCard({ data }: { data: Submission }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="glass rounded-2xl p-5 sm:p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl relative overflow-hidden"
      style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
      {/* 顶部彩条 */}
      <div className="absolute top-0 left-0 w-full h-[3px]"
        style={{ background: TRACK_COLORS[data.track ?? ''] ?? 'var(--gradient-primary)' }} />

      {/* 标题 + 赛事进展 */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h3 className="text-base font-bold flex-1 min-w-0" style={{ color: 'var(--foreground)' }}>
          {data.proposalNo != null && (
            <span className="inline-block mr-1.5 px-1.5 py-0.5 rounded text-[11px] font-semibold align-middle"
              style={{ background: 'rgba(26,58,138,0.08)', color: 'var(--primary)' }}>
              #{data.proposalNo}
            </span>
          )}
          {data.title ?? '未命名方案'}
        </h3>
        {data.status && (
          <Tag color={STATUS_COLORS[data.status] ?? 'default'} className="flex-shrink-0">
            {data.status}
          </Tag>
        )}
      </div>
      {(data.submitter || (data.teamMembers && data.teamMembers.length > 0)) && (
        <div className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
          <UserOutlined className="mr-1" />
          {data.submitter?.join('、')}
          {data.teamMembers && data.teamMembers.length > 0 && (
            <span> · 团队：{data.teamMembers.join('、')}</span>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {data.team && (Array.isArray(data.team) ? data.team : [data.team]).map((t) => (
          <Tag key={t} color="blue">{t}</Tag>
        ))}
        {data.track && (
          <Tag color={data.track.includes('降本') ? 'geekblue' : 'orange'}>
            {data.track.includes('降本') ? '降本提效' : '增值创新'}
          </Tag>
        )}
        {data.sceneCategory && <Tag>{data.sceneCategory}</Tag>}
      </div>

      {/* 核心指标 — 突出 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(242, 127, 34, 0.06)' }}>
          <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
            <ClockCircleOutlined /> 月均节省工时
          </div>
          <div className="text-2xl font-extrabold" style={{ color: 'var(--accent)' }}>
            {data.monthlySavedHours != null ? `${data.monthlySavedHours}h` : '-'}
          </div>
        </div>
        <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(26, 58, 138, 0.06)' }}>
          <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
            <ThunderboltOutlined /> 提效比例
          </div>
          <div className="text-2xl font-extrabold" style={{ color: 'var(--primary)' }}>
            {formatPercent(data.efficiencyRate)}
          </div>
        </div>
      </div>

      {/* AI 工具 */}
      {data.aiTools && data.aiTools.length > 0 && (
        <div className="flex items-center gap-2 mb-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <ToolOutlined className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
          <span>{data.aiTools.join('、')}</span>
        </div>
      )}

      {/* 工时对比 */}
      {(data.beforeHoursPerPerson != null || data.afterHoursPerPerson != null) && (
        <div className="rounded-lg p-3 mb-4 text-xs" style={{ background: 'rgba(0,0,0,0.02)' }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="font-medium mb-1" style={{ color: 'var(--text-muted)' }}>改造前</div>
              <div style={{ color: 'var(--text-primary)' }}>
                {data.beforeHoursPerPerson ?? '-'}h/人 · {data.beforePeopleCount ?? '-'}人
              </div>
            </div>
            <div>
              <div className="font-medium mb-1" style={{ color: 'var(--text-muted)' }}>改造后</div>
              <div style={{ color: 'var(--text-primary)' }}>
                {data.afterHoursPerPerson ?? '-'}h/人 · {data.afterPeopleCount ?? '-'}人
              </div>
            </div>
          </div>
          {data.aiCost != null && data.aiCost > 0 && (
            <div className="mt-2 pt-2" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
              <span style={{ color: 'var(--text-muted)' }}>AI 费用：</span>
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>¥{data.aiCost}/月</span>
            </div>
          )}
        </div>
      )}

      {/* 痛点 */}
      {data.painPoints && data.painPoints.length > 0 && (
        <div className="mb-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>核心痛点</div>
          <div className="flex flex-wrap gap-1">
            {data.painPoints.map((p) => (
              <span key={p} className="px-2 py-0.5 rounded-full text-[11px]"
                style={{ background: 'rgba(239, 68, 68, 0.06)', color: '#dc2626' }}>{p}</span>
            ))}
          </div>
        </div>
      )}

      {/* 额外价值 */}
      {data.extraValue && (
        <div className="mb-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <span className="font-medium" style={{ color: 'var(--text-muted)' }}>附加价值：</span>
          <span className={expanded ? '' : 'line-clamp-1'}>{data.extraValue}</span>
          {data.extraValue.length > 50 && (
            <button onClick={() => setExpanded(!expanded)}
              className="ml-1 text-[11px] font-medium hover:underline"
              style={{ color: 'var(--primary)' }}>
              {expanded ? '收起' : '展开'}
            </button>
          )}
        </div>
      )}

      {/* 底部：确认人 + 查看详情 */}
      <div className="flex items-center justify-between pt-3 text-[11px]"
        style={{ borderTop: '1px solid rgba(255,255,255,0.4)', color: 'var(--text-muted)' }}>
        {data.verifier && data.verifier.length > 0 && (
          <span><TeamOutlined /> 工时数据确认人：{data.verifier.join('、')}</span>
        )}
        {data.recordUrl && (
          <a href={data.recordUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 hover:opacity-70 transition-opacity ml-auto"
            style={{ color: 'var(--primary)' }}>
            <LinkOutlined /> 查看详情
          </a>
        )}
      </div>
    </div>
  );
}
