'use client';

import { useState } from 'react';
import { Tag, Input, Image, App, Popconfirm } from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  ToolOutlined,
  LinkOutlined,
  CheckOutlined,
  PaperClipOutlined,
  FileOutlined,
  PlayCircleOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import type { ReviewScores, ReviewerRole } from '@/types';
import { SCORE_DIMENSIONS } from '@/types';

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
  attachments?: AttachmentFile[];
  implementation?: string;
  newOperationCount?: number;
  oldOperationCount?: number;
  teamType?: string;
  oldHoursPerTask?: number;
  newDuration?: number;
  newPeopleCount?: number;
  oldPeopleCount?: number;
  oldFrequency?: string;
  newFrequency?: string;
  reviewers?: string[];
}

export interface AttachmentFile {
  name: string;
  size?: number;
  type?: string;
  url: string;
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

interface CompetitionCardProps {
  data: Submission;
  isReviewer?: boolean;
  reviewerRole?: ReviewerRole | null;
  existingReview?: { decision: string; scores?: ReviewScores; reason: string; reviewer_role?: ReviewerRole | null } | null;
  onReview?: (submissionId: string, scores: ReviewScores, reviewerRole: ReviewerRole, reason?: string) => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
      {children}
    </div>
  );
}

/** 前后对比行 */
function MetricRow({ label, before, after, unit }: { label: string; before: React.ReactNode; after: React.ReactNode; unit?: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr_40px_1fr] gap-2 items-center text-xs py-1.5"
      style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-right font-medium" style={{ color: 'var(--text-primary)' }}>
        {before ?? '-'}{unit && <span className="text-[10px] ml-0.5" style={{ color: 'var(--text-muted)' }}>{unit}</span>}
      </span>
      <SwapOutlined className="text-center" style={{ color: 'var(--primary)', fontSize: 10 }} />
      <span className="font-medium" style={{ color: '#16a34a' }}>
        {after ?? '-'}{unit && <span className="text-[10px] ml-0.5" style={{ color: 'var(--text-muted)' }}>{unit}</span>}
      </span>
    </div>
  );
}

export default function CompetitionCard({ data, isReviewer, reviewerRole, existingReview, onReview }: CompetitionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [comment, setComment] = useState(existingReview?.reason ?? '');
  const [scores, setScores] = useState<ReviewScores>(existingReview?.scores ?? {});
  const { message } = App.useApp();

  const hasExisting = existingReview?.decision === 'reviewed';
  // 已评审用当时的角色决定维度，未评审用页面顶部选择的角色
  const effectiveRole = hasExisting ? existingReview?.reviewer_role ?? reviewerRole : reviewerRole;
  const activeDims = effectiveRole ? SCORE_DIMENSIONS[effectiveRole] : [];

  const totalScore = activeDims.reduce((sum, dim) => {
    const val = scores[dim.key];
    return sum + (val != null ? val * dim.weight : 0);
  }, 0);

  const maxScore = activeDims.reduce((sum, dim) => sum + 5 * dim.weight, 0);

  const allScored = activeDims.length > 0 && activeDims.every((dim) => scores[dim.key] != null);

  const handleScoreChange = (key: keyof ReviewScores, value: number) => {
    setScores((prev) => ({ ...prev, [key]: value }));
  };

  const handleConfirmSubmit = () => {
    onReview?.(data.id, scores, reviewerRole!, comment.trim() || undefined);
  };

  return (
    <div className="glass rounded-2xl p-5 sm:p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl relative overflow-hidden"
      style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
      {/* 顶部彩条 */}
      <div className="absolute top-0 left-0 w-full h-[3px]"
        style={{ background: TRACK_COLORS[data.track ?? ''] ?? 'var(--gradient-primary)' }} />

      {/* ① 标题 + 编号 + 赛事进展 */}
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

      {/* ② 提交人 + 标签 */}
      <div className="flex items-center justify-between gap-2 mb-4">
        {(data.submitter || (data.teamMembers && data.teamMembers.length > 0)) && (
          <div className="text-xs min-w-0 truncate" style={{ color: 'var(--text-muted)' }}>
            <UserOutlined className="mr-1" />
            {data.submitter?.join('、')}
            {data.teamMembers && data.teamMembers.length > 0 && (
              <span> · 团队：{data.teamMembers.join('、')}</span>
            )}
          </div>
        )}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {data.team && (Array.isArray(data.team) ? data.team : [data.team]).map((t) => (
            <Tag key={t} color="blue" className="text-[11px]">{t}</Tag>
          ))}
          {data.track && (
            <Tag color={data.track.includes('降本') ? 'geekblue' : 'orange'} className="text-[11px]">
              {data.track.includes('降本') ? '降本提效' : '增值创新'}
            </Tag>
          )}
          {data.sceneCategory && <Tag className="text-[11px]">{data.sceneCategory}</Tag>}
        </div>
      </div>

      {/* 主体：左右两栏 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-4">

        {/* 左栏：场景 + 痛点 + 解决方法 */}
        <div>
          {/* ④ 场景描述 */}
          {data.beforeProcess && (
            <div className="mb-4">
              <SectionLabel>场景描述</SectionLabel>
              <div className="text-xs leading-relaxed whitespace-pre-line" style={{ color: 'var(--text-primary)' }}>
                {expanded ? data.beforeProcess : (
                  data.beforeProcess.length > 200 ? `${data.beforeProcess.slice(0, 200)}...` : data.beforeProcess
                )}
                {data.beforeProcess.length > 200 && (
                  <button onClick={() => setExpanded(!expanded)}
                    className="ml-1 text-[11px] font-medium hover:underline"
                    style={{ color: 'var(--primary)' }}>
                    {expanded ? '收起' : '展开'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ⑤ 核心痛点 */}
          {data.painPoints && data.painPoints.length > 0 && (
            <div className="mb-4">
              <SectionLabel>核心痛点</SectionLabel>
              <div className="flex flex-wrap gap-1">
                {data.painPoints.map((p) => (
                  <span key={p} className="px-2 py-0.5 rounded-full text-[11px]"
                    style={{ background: 'rgba(239, 68, 68, 0.06)', color: '#dc2626' }}>{p}</span>
                ))}
              </div>
            </div>
          )}

          {/* ⑥ 解决方案/最新流程 */}
          {(data.afterProcess || data.implementation || (data.aiTools && data.aiTools.length > 0)) && (
            <div className="mb-4">
              <SectionLabel>解决方案/最新流程</SectionLabel>
              {data.afterProcess && (
                <div className="text-xs leading-relaxed mb-2 whitespace-pre-line" style={{ color: 'var(--text-primary)' }}>
                  {data.afterProcess}
                </div>
              )}
              {data.implementation && (
                <div className="text-xs leading-relaxed mb-2 whitespace-pre-line" style={{ color: 'var(--text-secondary)' }}>
                  <span className="font-medium" style={{ color: 'var(--text-muted)' }}>实现步骤：</span>
                  {data.implementation}
                </div>
              )}
              {data.aiTools && data.aiTools.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <ToolOutlined className="flex-shrink-0 text-[10px]" style={{ color: 'var(--text-muted)' }} />
                  {data.aiTools.map((tool) => (
                    <Tag key={tool} color="purple" className="text-[11px]">{tool}</Tag>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 右栏：过程对比 + 结果 */}
        <div>
          {/* ⑦ 量化数据对比 */}
          <div className="mb-4">
            <SectionLabel>量化数据对比</SectionLabel>
            <div className="rounded-lg p-3" style={{ background: 'rgba(0,0,0,0.02)' }}>
              {/* 表头 */}
              <div className="grid grid-cols-[120px_1fr_40px_1fr] gap-2 text-[10px] font-semibold uppercase tracking-wider pb-1.5 mb-1"
                style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', color: 'var(--text-muted)' }}>
                <span>指标</span>
                <span className="text-right">改造前</span>
                <span></span>
                <span>改造后</span>
              </div>
              {/* 对比行 */}
              {data.beforeHoursPerPerson != null && (
                <MetricRow label="每人月均投入工时" before={data.beforeHoursPerPerson} after={data.afterHoursPerPerson} unit="h" />
              )}
              {data.beforePeopleCount != null && (
                <MetricRow label="月均投入人数" before={data.beforePeopleCount} after={data.afterPeopleCount} unit="人" />
              )}
              {data.oldFrequency && (
                <MetricRow label="工作频率" before={data.oldFrequency} after={data.newFrequency} />
              )}
              {data.oldOperationCount != null && (
                <MetricRow label="操作次数" before={data.oldOperationCount} after={data.newOperationCount} unit="次" />
              )}
              {data.oldHoursPerTask != null && (
                <MetricRow label="单次工时" before={data.oldHoursPerTask} after={data.newDuration} unit="h" />
              )}
              {data.oldPeopleCount != null && (
                <MetricRow label="执行人数" before={data.oldPeopleCount} after={data.newPeopleCount} unit="人" />
              )}
              {/* 合计节省工时 + 提效% */}
              {(data.monthlySavedHours != null || data.efficiencyRate != null) && (
                <div className="flex items-center justify-between gap-3 pt-2 mt-1">
                  <div className="flex-1 grid grid-cols-[120px_1fr] gap-2 items-center text-xs">
                    <span className="font-semibold" style={{ color: 'var(--foreground)' }}>月均节省工时</span>
                    <span className="font-bold" style={{ color: '#16a34a' }}>
                      {data.monthlySavedHours != null ? <>{data.monthlySavedHours}<span className="text-[10px] ml-0.5" style={{ color: 'var(--text-muted)' }}>h/月</span></> : '-'}
                    </span>
                  </div>
                  {data.efficiencyRate != null && (
                    <div className="flex-shrink-0 px-3 py-1.5 rounded-lg text-center"
                      style={{ background: 'rgba(22,163,74,0.1)' }}>
                      <div className="text-[10px] font-medium mb-0.5" style={{ color: 'var(--text-muted)' }}>提效</div>
                      <div className="text-lg font-extrabold leading-none" style={{ color: '#16a34a' }}>
                        +{(data.efficiencyRate * 100).toFixed(2)}%
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* AI 费用 */}
              {data.aiCost != null && data.aiCost > 0 && (
                <div className="grid grid-cols-[120px_1fr_40px_1fr] gap-2 items-center text-xs pt-2">
                  <span style={{ color: 'var(--text-muted)' }}>AI 月均费用</span>
                  <span></span>
                  <span></span>
                  <span className="font-medium" style={{ color: 'var(--primary)' }}>¥{data.aiCost}</span>
                </div>
              )}
            </div>
          </div>

          {/* ⑧ 附加价值 */}
          {data.extraValue && (
            <div className="mb-3">
              <SectionLabel>附加价值</SectionLabel>
              <div className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {data.extraValue}
              </div>
            </div>
          )}

          {/* ⑨ 工时数据确认人 */}
          {data.verifier && data.verifier.length > 0 && (
            <div className="text-[11px] mb-1" style={{ color: 'var(--text-muted)' }}>
              <TeamOutlined className="mr-1" />
              工时数据确认人：{data.verifier.join('、')}
            </div>
          )}

          {/* ⑩ 查看源记录 */}
          {data.recordUrl && (
            <a href={data.recordUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] hover:opacity-70 transition-opacity"
              style={{ color: 'var(--primary)' }}>
              <LinkOutlined /> 查看源记录
            </a>
          )}
        </div>
      </div>

      {/* ⑨ 附件 */}
      {data.attachments && data.attachments.length > 0 && (
        <div className="mb-3">
          <SectionLabel>
            <PaperClipOutlined /> 附件（{data.attachments.length}）
          </SectionLabel>
          <div className="flex flex-wrap items-center gap-2">
            <Image.PreviewGroup>
              {data.attachments.filter((a) => a.type?.startsWith('image/')).map((img) => (
                <Image
                  key={img.name}
                  src={img.url}
                  alt={img.name}
                  width={48}
                  height={48}
                  className="rounded-lg object-cover cursor-pointer"
                  style={{ border: '1px solid rgba(0,0,0,0.06)' }}
                  preview={{ mask: <span style={{ fontSize: 11 }}>预览</span> }}
                />
              ))}
            </Image.PreviewGroup>
            {data.attachments.filter((a) => !a.type?.startsWith('image/')).map((f) => (
              <a key={f.name} href={f.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg hover:opacity-70 transition-opacity"
                style={{ background: 'rgba(0,0,0,0.03)', color: f.type?.startsWith('video/') ? 'var(--primary)' : 'var(--text-secondary)' }}>
                {f.type?.startsWith('video/') ? <PlayCircleOutlined /> : <FileOutlined />}
                <span className="max-w-[120px] truncate">{f.name}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* 评委评审区域 */}
      {isReviewer && (
        <div className="mt-4 -mx-5 sm:-mx-6 -mb-5 sm:-mb-6 px-5 sm:px-6 pt-4 pb-5 rounded-b-2xl"
          style={{ background: 'rgba(26,58,138,0.03)', borderTop: '1px solid rgba(26,58,138,0.08)' }}>
          {/* 已评审：显示评分明细（不可修改） */}
          {hasExisting && existingReview ? (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Tag color="green" className="text-xs">已评审</Tag>
                <span className="text-xs font-semibold" style={{ color: 'var(--primary)' }}>
                  总分 {totalScore.toFixed(1)} / {maxScore}
                </span>
                <span className="text-[11px] ml-auto" style={{ color: 'var(--text-muted)' }}>
                  {existingReview.reviewer_role === 'user' ? '用户评委' : existingReview.reviewer_role === 'business' ? '业务评委' : '技术评委'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-2">
                {activeDims.map((dim) => {
                  const val = scores[dim.key];
                  return (
                    <div key={dim.key} className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg"
                      style={{ background: 'rgba(0,0,0,0.02)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{dim.label}</span>
                      <span className="font-semibold" style={{ color: val != null && val >= 4 ? '#16a34a' : val != null && val <= 2 ? '#dc2626' : 'var(--foreground)' }}>
                        {val ?? '-'} <span className="text-[10px] font-normal" style={{ color: 'var(--text-muted)' }}>×{dim.weight}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
              {existingReview.reason && (
                <div className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
                  评语：{existingReview.reason}
                </div>
              )}
            </div>
          ) : !reviewerRole ? (
            <div className="text-center py-4 text-xs" style={{ color: 'var(--text-muted)' }}>
              请先在页面顶部选择评委角色后再评分
            </div>
          ) : (
            /* 评分表单 */
            <div>
              {/* 评分维度 */}
              <div className="space-y-3 mb-3">
                {activeDims.map((dim) => (
                  <div key={dim.key} className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.5)' }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                        {dim.label}
                        <span className="text-[10px] font-normal ml-1.5" style={{ color: 'var(--text-muted)' }}>
                          权重 ×{dim.weight}
                        </span>
                      </span>
                      <span className="text-sm font-bold" style={{ color: scores[dim.key] != null ? (scores[dim.key]! >= 4 ? '#16a34a' : scores[dim.key]! <= 2 ? '#dc2626' : 'var(--primary)') : 'var(--text-muted)' }}>
                        {scores[dim.key] ?? '-'}
                      </span>
                    </div>
                    <div className="flex gap-1 mb-1.5">
                      {[1, 2, 3, 4, 5].map((v) => (
                        <button
                          key={v}
                          onClick={() => handleScoreChange(dim.key, v)}
                          className="flex-1 h-7 rounded text-xs font-medium transition-all"
                          style={{
                            background: scores[dim.key] === v
                              ? v >= 4 ? 'rgba(22,163,74,0.15)' : v <= 2 ? 'rgba(220,38,38,0.12)' : 'rgba(26,58,138,0.12)'
                              : 'rgba(0,0,0,0.03)',
                            color: scores[dim.key] === v
                              ? v >= 4 ? '#16a34a' : v <= 2 ? '#dc2626' : 'var(--primary)'
                              : 'var(--text-muted)',
                            border: scores[dim.key] === v
                              ? `1px solid ${v >= 4 ? 'rgba(22,163,74,0.3)' : v <= 2 ? 'rgba(220,38,38,0.25)' : 'rgba(26,58,138,0.25)'}`
                              : '1px solid transparent',
                          }}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-between text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      <span>1分：{dim.lowSignal}</span>
                      <span>5分：{dim.highSignal}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* 总分预览 */}
              <div className="flex items-center justify-between mb-3 px-3 py-2 rounded-lg"
                style={{ background: 'rgba(26,58,138,0.04)', border: '1px solid rgba(26,58,138,0.08)' }}>
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>加权总分</span>
                <span className="text-lg font-bold" style={{ color: 'var(--primary)' }}>
                  {totalScore.toFixed(1)}
                  <span className="text-xs font-normal ml-1" style={{ color: 'var(--text-muted)' }}>/ {maxScore}</span>
                </span>
              </div>

              {/* 评语 + 提交 */}
              <Input.TextArea
                rows={2}
                placeholder="评语（选填）"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={100}
                style={{ marginBottom: 8 }}
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {comment.length}/100
                </span>
                <Popconfirm
                  title="确认提交评分"
                  description={<span>总分 <b>{totalScore.toFixed(1)}</b> / {maxScore}，提交后不可修改</span>}
                  onConfirm={handleConfirmSubmit}
                  okText="确认提交"
                  cancelText="再想想"
                  disabled={!allScored}
                >
                  <button
                    disabled={!allScored}
                    className="px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
                    style={{
                      background: allScored ? 'var(--primary)' : 'rgba(0,0,0,0.08)',
                      color: allScored ? '#fff' : 'var(--text-muted)',
                      boxShadow: allScored ? '0 4px 12px rgba(26,58,138,0.25)' : 'none',
                    }}
                  >
                    <CheckOutlined className="mr-1" /> 提交评分
                  </button>
                </Popconfirm>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
