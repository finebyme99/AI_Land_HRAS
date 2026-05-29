'use client';

import { useState } from 'react';
import { Tag, Button, Modal, Input, Checkbox, Tooltip, Image, App } from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  ToolOutlined,
  LinkOutlined,
  CheckOutlined,
  CloseOutlined,
  PaperClipOutlined,
  FileOutlined,
  PlayCircleOutlined,
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
  attachments?: AttachmentFile[];
  // 新增字段（本期不展示，备用）
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

function formatPercent(val?: number): string {
  if (val == null) return '-';
  return `${(val * 100).toFixed(1)}%`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
      {children}
    </div>
  );
}

interface CompetitionCardProps {
  data: Submission;
  isReviewer?: boolean;
  existingReview?: { decision: string; reason: string; is_benchmark?: boolean } | null;
  onReview?: (submissionId: string, decision: 'approved' | 'rejected', reason?: string, is_benchmark?: boolean) => void;
}

export default function CompetitionCard({ data, isReviewer, existingReview, onReview }: CompetitionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [benchmarkChecked, setBenchmarkChecked] = useState(existingReview?.is_benchmark ?? false);
  const { message } = App.useApp();

  const handleApprove = () => {
    if (existingReview?.decision === 'approved') {
      message.warning('请勿重复操作，已通过');
      return;
    }
    onReview?.(data.id, 'approved', undefined, benchmarkChecked);
  };

  const handleReject = () => {
    if (!rejectReason.trim()) return;
    if (existingReview?.decision === 'rejected') {
      message.warning('请勿重复操作，已驳回');
      setRejectModalOpen(false);
      setRejectReason('');
      return;
    }
    onReview?.(data.id, 'rejected', rejectReason.trim());
    setRejectModalOpen(false);
    setRejectReason('');
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

      {/* ② 提交人 + 团队 */}
      {(data.submitter || (data.teamMembers && data.teamMembers.length > 0)) && (
        <div className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
          <UserOutlined className="mr-1" />
          {data.submitter?.join('、')}
          {data.teamMembers && data.teamMembers.length > 0 && (
            <span> · 团队：{data.teamMembers.join('、')}</span>
          )}
        </div>
      )}

      {/* ③ 标签：团队 + 赛道 + 场景分类 */}
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

      {/* ④ 场景：原场景与流程 */}
      {data.beforeProcess && (
        <div className="mb-4">
          <SectionLabel>场景描述</SectionLabel>
          <div className="text-xs leading-relaxed" style={{ color: 'var(--text-primary)' }}>
            {expanded ? data.beforeProcess : (
              data.beforeProcess.length > 120 ? `${data.beforeProcess.slice(0, 120)}...` : data.beforeProcess
            )}
            {data.beforeProcess.length > 120 && (
              <button onClick={() => setExpanded(!expanded)}
                className="ml-1 text-[11px] font-medium hover:underline"
                style={{ color: 'var(--primary)' }}>
                {expanded ? '收起' : '展开'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ⑤ 痛点 */}
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

      {/* ⑥ 解决方法：现工作流程 + AI 工具 */}
      {(data.afterProcess || (data.aiTools && data.aiTools.length > 0)) && (
        <div className="mb-4">
          <SectionLabel>解决方法</SectionLabel>
          {data.afterProcess && (
            <div className="text-xs leading-relaxed mb-2" style={{ color: 'var(--text-primary)' }}>
              {data.afterProcess}
            </div>
          )}
          {data.aiTools && data.aiTools.length > 0 && (
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <ToolOutlined className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
              <span>{data.aiTools.join('、')}</span>
            </div>
          )}
        </div>
      )}

      {/* ⑦ 结果数据：核心指标 + 工时对比 */}
      <div className="mb-4">
        <SectionLabel>结果数据</SectionLabel>
        {/* 核心指标 */}
        <div className="grid grid-cols-2 gap-3 mb-3">
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
        {/* 工时对比 */}
        {(data.beforeHoursPerPerson != null || data.afterHoursPerPerson != null) && (
          <div className="rounded-lg p-3 text-xs" style={{ background: 'rgba(0,0,0,0.02)' }}>
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
        {/* 其他价值 */}
        {data.extraValue && (
          <div className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <span className="font-medium" style={{ color: 'var(--text-muted)' }}>附加价值：</span>
            {data.extraValue}
          </div>
        )}
      </div>

      {/* ⑧ 附件 */}
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

      {/* 底部：确认人 + 源记录 */}
      <div className="flex items-center justify-between pt-3 text-[11px]"
        style={{ borderTop: '1px solid rgba(255,255,255,0.4)', color: 'var(--text-muted)' }}>
        {data.verifier && data.verifier.length > 0 && (
          <span><TeamOutlined /> 工时数据确认人：{data.verifier.join('、')}</span>
        )}
        {data.recordUrl && (
          <a href={data.recordUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 hover:opacity-70 transition-opacity ml-auto"
            style={{ color: 'var(--primary)' }}>
            <LinkOutlined /> 查看源记录
          </a>
        )}
      </div>

      {/* 评委评审区域 */}
      {isReviewer && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px dashed rgba(0,0,0,0.08)' }}>
          {existingReview ? (
            <div className="flex items-center gap-2">
              <Tag color={existingReview.decision === 'approved' ? 'green' : 'red'} className="text-xs">
                {existingReview.decision === 'approved' ? '已通过' : '已驳回'}
              </Tag>
              {existingReview.decision === 'approved' && existingReview.is_benchmark && (
                <Tag color="gold" className="text-xs">标杆案例</Tag>
              )}
              {existingReview.decision === 'rejected' && existingReview.reason && (
                <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                  {existingReview.reason}
                </span>
              )}
              <div className="ml-auto flex gap-1.5">
                <Button size="small" type="text" icon={<CheckOutlined />}
                  style={{ color: '#16a34a' }}
                  onClick={handleApprove} />
                <Button size="small" type="text" icon={<CloseOutlined />}
                  style={{ color: '#dc2626' }}
                  onClick={() => setRejectModalOpen(true)} />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-end gap-2">
              <Tooltip title="广受评委认可的标杆案例，会推举在全HRAS宣讲，应具备三要素：落地成效显著、可推广复用、有启发性">
                <Checkbox checked={benchmarkChecked} onChange={(e) => setBenchmarkChecked(e.target.checked)}>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>推荐为标杆案例</span>
                </Checkbox>
              </Tooltip>
              <div className="flex items-center gap-2">
                <Button size="small" icon={<CheckOutlined />}
                  style={{ color: '#16a34a', borderColor: '#16a34a' }}
                  onClick={handleApprove}>
                  通过
                </Button>
                <Button size="small" danger icon={<CloseOutlined />}
                  onClick={() => setRejectModalOpen(true)}>
                  驳回调整
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <Modal
        title="驳回调整 — 填写理由"
        open={rejectModalOpen}
        onOk={handleReject}
        onCancel={() => { setRejectModalOpen(false); setRejectReason(''); }}
        okText="确认驳回"
        cancelText="取消"
        okButtonProps={{ danger: true, type: 'primary', disabled: !rejectReason.trim(), style: { color: '#fff' } }}
      >
        <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
          请说明需要调整的原因，以便提交人改进方案。
        </p>
        <Input.TextArea
          rows={4}
          placeholder="请输入驳回理由（必填）"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          maxLength={500}
          showCount
          style={{ marginBottom: 8 }}
        />
      </Modal>
    </div>
  );
}
