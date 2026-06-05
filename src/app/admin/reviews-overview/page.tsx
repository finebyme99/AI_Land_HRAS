'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Spin, App, Select, Tag } from 'antd';
import { TrophyOutlined, AuditOutlined, TeamOutlined, ArrowRightOutlined, RiseOutlined } from '@ant-design/icons';
import { useAuth } from '@/lib/auth-context';
import HighlightSweep from '@/components/HighlightSweep';

type Role = 'user' | 'business' | 'tech';

interface ReviewDTO {
  id: string;
  reviewerName: string;
  reviewerRole: Role | null;
  decision: string;
  scores: Record<string, number>;
  weightedScore: number;
  reason: string;
}

interface SubmissionDTO {
  id: string;
  title: string;
  team: string;
  authorName: string;
  proposalNo: number | null;
  submittedAt: string;
  status: 'reviewed' | 'pending';
  totalScore: number | null;
  reviewCount: number;
  roleScores: Record<Role, number | null>;
  reviews: ReviewDTO[];
  // 方案详情（弹窗用）
  track: string;
  sceneCategory: string;
  aiTools: string[];
  monthlySavedHours: number | null;
  efficiencyRate: number | null;
  beforeProcess: string;
  painPoints: string[];
  afterProcess: string;
  demoLink: string;
  recordUrl: string;
  aiCost: string;
  extraValue: string;
  teamMembers: string;
  implementation: string;
  verifier: string;
}

interface OverviewResponse {
  period: string;
  summary: { total: number; reviewed: number; pending: number; avgScore: number | null };
  submissions: SubmissionDTO[];
}

const PERIOD_OPTIONS = [
  { value: '2605', label: '5 月 (2605)' },
  { value: '2606', label: '6 月 (2606)' },
  { value: '2604', label: '4 月 (2604)' },
  { value: '2603', label: '3 月 (2603)' },
];

const ROLE_LABEL: Record<Role, string> = {
  user: '用户评委',
  business: '业务评委',
  tech: '技术评委',
};

const ROLE_COLOR: Record<Role, string> = {
  user: 'blue',
  business: 'orange',
  tech: 'purple',
};

const ROLE_DIM_LABEL: Record<string, string> = {
  productEffectiveness: '产品实用性',
  dataConsistency: '数据一致性',
  productUsability: '产品易用性',
  replicability: '可复用性',
  dataReliability: '数据详实度',
  breakthrough: '突破开创性',
  techDepth: '技术实现深度',
  engineeringQuality: '工程质量与可落地性',
};

/** 各角色维度满分（5 分制 × 各自权重求和）
 *  - user: 5×1.5 + 5×1.2 + 5×1.2 = 19.5
 *  - business: 5×1.5 + 5×1.2 + 5×1.2 = 19.5
 *  - tech: 5×1.2 + 5×1.0 = 11
 *  - 总分上限: 19.5 + 19.5 + 11 = 50
 */
const ROLE_MAX: Record<Role, number> = { user: 19.5, business: 19.5, tech: 11 };
const TOTAL_MAX = 50;

export default function ReviewsOverviewPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [period, setPeriod] = useState('2605');
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [modalSub, setModalSub] = useState<SubmissionDTO | null>(null);
  const [detailSub, setDetailSub] = useState<SubmissionDTO | null>(null);

  useEffect(() => {
    if (!authLoading && !isAdmin) router.replace('/');
  }, [authLoading, isAdmin, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/competitions/overview?period=${period}`);
      if (!res.ok) throw new Error((await res.json()).error || '加载失败');
      const json: OverviewResponse = await res.json();
      setData(json);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [period, message]);

  useEffect(() => { if (isAdmin) fetchData(); }, [isAdmin, fetchData]);

  const teams = useMemo(() => {
    const set = new Set<string>();
    (data?.submissions ?? []).forEach((s) => s.team && set.add(s.team));
    return Array.from(set).sort();
  }, [data]);

  const visibleSubs = useMemo(() => {
    let list = data?.submissions ?? [];
    if (teamFilter !== 'all') list = list.filter((s) => s.team === teamFilter);
    // 默认按总分降序
    list = [...list].sort((a, b) => (b.totalScore ?? -1) - (a.totalScore ?? -1));
    return list;
  }, [data, teamFilter]);

  if (authLoading) {
    return <div className="flex justify-center items-center min-h-[60vh]"><Spin size="large" /></div>;
  }
  if (!isAdmin) return null;

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* 标题 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0F2057, #1a3a8a)', color: '#fff' }}>
            <AuditOutlined />
          </span>
          <HighlightSweep text="HRAS AI 大赛 · 评审一览" className="text-2xl font-bold" gradient="linear-gradient(135deg, #0F2057 0%, #1a3a8a 50%, #2d5aa0 100%)" />
        </div>
        <Select
          value={period}
          onChange={setPeriod}
          options={PERIOD_OPTIONS}
          style={{ width: 160 }}
          size="middle"
        />
      </div>

      {/* 顶部汇总条 */}
      {data && (
        <div className="glass rounded-xl px-5 py-3 mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm"
          style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
          <span className="flex items-center gap-1.5 font-semibold" style={{ color: 'var(--primary)' }}>
            <TrophyOutlined /> {period} · 评审进度
          </span>
          <span>参赛 <b style={{ color: 'var(--foreground)' }}>{data.summary.total}</b></span>
          <span>已评 <b style={{ color: '#16a34a' }}>{data.summary.reviewed}</b></span>
          <span>未评 <b style={{ color: '#b3540e' }}>{data.summary.pending}</b></span>
          <span>平均 <b style={{ color: 'var(--foreground)' }}>{data.summary.avgScore ?? '—'}</b></span>
        </div>
      )}

      {/* 筛选条 */}
      <div className="glass rounded-xl px-4 py-3 mb-4 flex flex-wrap items-center gap-3"
        style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <span className="text-xs font-semibold flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
          <TeamOutlined /> 团队
        </span>
        {[{ value: 'all', label: '全部' }, ...teams.map((t) => ({ value: t, label: t }))].map((opt) => (
          <button
            key={opt.value}
            onClick={() => setTeamFilter(opt.value)}
            className="px-3 py-1 rounded-full text-xs font-medium transition-all"
            style={{
              color: teamFilter === opt.value ? '#fff' : 'var(--text-secondary)',
              background: teamFilter === opt.value ? 'var(--primary)' : 'rgba(255, 255, 255, 0.3)',
              border: '1px solid transparent',
            }}
          >{opt.label}</button>
        ))}
        <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>
          <RiseOutlined /> 按总分降序
        </span>
      </div>

      {/* 卡片网格 */}
      {loading ? (
        <div className="flex justify-center py-16"><Spin size="large" /></div>
      ) : visibleSubs.length === 0 ? (
        <div className="text-center py-16 glass rounded-[20px]" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>该期暂无方案</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleSubs.map((sub) => (
            <div key={sub.id} className="glass rounded-[20px] p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
              style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
              {/* 头：编号 + 状态 */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                  {sub.proposalNo ? `#${String(sub.proposalNo).padStart(3, '0')}` : '—'}
                </span>
                <Tag color={sub.status === 'reviewed' ? 'green' : 'orange'} style={{ margin: 0 }}>
                  {sub.status === 'reviewed' ? '✓ 已评' : `⏳ ${sub.reviewCount}/3`}
                </Tag>
              </div>

              {/* 标题 */}
              <h3 className="text-base font-semibold mb-1 line-clamp-2">{sub.title}</h3>
              <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                {sub.team && <Tag color="blue" style={{ margin: 0, marginRight: 6 }}>{sub.team}</Tag>}
                {sub.authorName}
              </p>

              {/* 总分 + 各角色分 */}
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>
                  {sub.totalScore != null ? sub.totalScore.toFixed(1) : '—'}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>/ {TOTAL_MAX} · {sub.reviewCount} 人评</span>
              </div>

              {/* 角色分进度条 */}
              <div className="space-y-1.5 mb-4">
                {(['user', 'business', 'tech'] as Role[]).map((r) => {
                  const s = sub.roleScores[r];
                  const max = ROLE_MAX[r];
                  return (
                    <div key={r} className="flex items-center gap-2 text-xs">
                      <Tag color={ROLE_COLOR[r]} style={{ margin: 0, minWidth: 56, textAlign: 'center' }}>
                        {ROLE_LABEL[r]}
                      </Tag>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.04)' }}>
                        <div className="h-full transition-all"
                          style={{
                            width: s != null ? `${(s / max) * 100}%` : '0%',
                            background: s != null ? 'var(--gradient-primary)' : 'transparent',
                          }} />
                      </div>
                      <span className="w-20 text-right font-mono" style={{ color: s != null ? 'var(--foreground)' : 'var(--text-muted)' }}>
                        {s != null ? `${s.toFixed(1)} / ${max}` : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* 操作按钮 */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setModalSub(sub)}
                  className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90"
                  style={{ background: 'var(--primary)', color: '#fff' }}
                >
                  查看评审明细
                </button>
                <button
                  onClick={() => setDetailSub(sub)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90"
                  style={{ background: 'rgba(26,58,138,0.06)', color: 'var(--primary)' }}>
                  方案详情 <ArrowRightOutlined />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 评审明细 Modal */}
      {modalSub && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => setModalSub(null)}
        >
          <div
            className="glass rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
            style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between"
              style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <div>
                <h3 className="text-base font-bold">{modalSub.title}</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {modalSub.team && <Tag color="blue" style={{ margin: 0, marginRight: 6 }}>{modalSub.team}</Tag>}
                  总分 <b style={{ color: 'var(--primary)' }}>{modalSub.totalScore ?? '—'}</b> · {modalSub.reviews.length} 条评审
                </p>
              </div>
              <button onClick={() => setModalSub(null)} className="text-xl" style={{ color: 'var(--text-muted)' }}>×</button>
            </div>

            <div className="p-6 space-y-4">
              {modalSub.reviews.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>暂无评审记录</p>
              ) : modalSub.reviews.map((r) => (
                <div key={r.id} className="rounded-xl p-4" style={{ background: 'rgba(26,58,138,0.03)', border: '1px solid rgba(26,58,138,0.08)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{r.reviewerName}</span>
                      {r.reviewerRole && <Tag color={ROLE_COLOR[r.reviewerRole]} style={{ margin: 0 }}>{ROLE_LABEL[r.reviewerRole]}</Tag>}
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold" style={{ color: 'var(--primary)' }}>{r.weightedScore}</div>
                      <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>加权总分</div>
                    </div>
                  </div>
                  {/* 各维度分 */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-2 text-xs">
                    {Object.entries(r.scores).map(([dim, val]) => (
                      <div key={dim} className="flex items-center justify-between">
                        <span style={{ color: 'var(--text-secondary)' }}>{ROLE_DIM_LABEL[dim] ?? dim}</span>
                        <span className="font-mono font-semibold">{val}</span>
                      </div>
                    ))}
                  </div>
                  {r.reason && (
                    <p className="text-xs mt-2 pt-2" style={{ color: 'var(--text-secondary)', borderTop: '1px dashed rgba(0,0,0,0.06)' }}>
                      {r.reason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 方案详情 Modal */}
      {detailSub && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => setDetailSub(null)}
        >
          <div
            className="glass rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
            style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 px-6 py-4"
              style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold">
                    {detailSub.proposalNo ? `#${String(detailSub.proposalNo).padStart(3, '0')} ` : ''}
                    {detailSub.title}
                  </h3>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {detailSub.team && <Tag color="blue" style={{ margin: 0 }}>{detailSub.team}</Tag>}
                    {detailSub.track && <Tag color="purple" style={{ margin: 0 }}>{detailSub.track}</Tag>}
                    {detailSub.sceneCategory && <Tag color="cyan" style={{ margin: 0 }}>{detailSub.sceneCategory}</Tag>}
                  </div>
                </div>
                <button onClick={() => setDetailSub(null)} className="text-xl shrink-0 ml-2" style={{ color: 'var(--text-muted)' }}>×</button>
              </div>
            </div>

            <div className="p-6 space-y-4 text-sm">
              {/* 提报 */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="提报人" value={detailSub.authorName} />
                <Field label="小组成员" value={detailSub.teamMembers} />
                <Field label="方案确认人" value={detailSub.verifier} />
                <Field label="月均节省工时" value={detailSub.monthlySavedHours != null ? `${detailSub.monthlySavedHours} 小时` : ''} />
                <Field label="提效比例" value={detailSub.efficiencyRate != null ? `${(detailSub.efficiencyRate * 100).toFixed(1)}%` : ''} />
                <Field label="AI 成本" value={detailSub.aiCost} />
              </div>

              {detailSub.aiTools.length > 0 && (
                <Section title="用到的 AI 工具">
                  <div className="flex flex-wrap gap-1.5">
                    {detailSub.aiTools.map((t) => <Tag key={t} color="geekblue" style={{ margin: 0 }}>{t}</Tag>)}
                  </div>
                </Section>
              )}

              {detailSub.painPoints.length > 0 && (
                <Section title="核心痛点">
                  <div className="flex flex-wrap gap-1.5">
                    {detailSub.painPoints.map((p) => <Tag key={p} color="orange" style={{ margin: 0 }}>{p}</Tag>)}
                  </div>
                </Section>
              )}

              {detailSub.beforeProcess && (
                <Section title="原业务场景 & 流程">
                  <pre className="text-xs whitespace-pre-wrap font-sans" style={{ color: 'var(--text-secondary)' }}>{detailSub.beforeProcess}</pre>
                </Section>
              )}

              {detailSub.afterProcess && (
                <Section title="改造后流程">
                  <pre className="text-xs whitespace-pre-wrap font-sans" style={{ color: 'var(--text-secondary)' }}>{detailSub.afterProcess}</pre>
                </Section>
              )}

              {detailSub.implementation && (
                <Section title="实现方式">
                  <pre className="text-xs whitespace-pre-wrap font-sans" style={{ color: 'var(--text-secondary)' }}>{detailSub.implementation}</pre>
                </Section>
              )}

              {detailSub.extraValue && (
                <Section title="其他价值">
                  <pre className="text-xs whitespace-pre-wrap font-sans" style={{ color: 'var(--text-secondary)' }}>{detailSub.extraValue}</pre>
                </Section>
              )}

              {(detailSub.demoLink || detailSub.recordUrl) && (
                <Section title="相关链接">
                  {detailSub.demoLink && (
                    <a href={detailSub.demoLink} target="_blank" rel="noopener noreferrer"
                      className="block text-xs text-blue-600 hover:underline mb-1">
                      Demo: {detailSub.demoLink}
                    </a>
                  )}
                  {detailSub.recordUrl && (
                    <a href={detailSub.recordUrl} target="_blank" rel="noopener noreferrer"
                      className="block text-xs text-blue-600 hover:underline">
                      飞书记录: {detailSub.recordUrl}
                    </a>
                  )}
                </Section>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 详情弹窗里的小字段 */
function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-sm" style={{ color: value ? 'var(--foreground)' : 'var(--text-muted)' }}>
        {value || '—'}
      </div>
    </div>
  );
}

/** 详情弹窗里的分段 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>{title}</div>
      <div>{children}</div>
    </div>
  );
}
