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
  // 量化对比
  beforeHoursPerPerson: number | null;
  beforePeopleCount: number | null;
  afterHoursPerPerson: number | null;
  afterPeopleCount: number | null;
  oldOperationCount: number | null;
  newOperationCount: number | null;
  oldHoursPerTask: number | null;
  newDuration: number | null;
  oldPeopleCount: number | null;
  newPeopleCount: number | null;
  oldFrequency: string | null;
  newFrequency: string | null;
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
    // 全局排名（基于未过滤的全集按 totalScore 排）
    const fullSorted = [...(data?.submissions ?? [])].sort((a, b) => (b.totalScore ?? -1) - (a.totalScore ?? -1));
    const rankMap = new Map<string, number>();
    fullSorted.forEach((s, i) => rankMap.set(s.id, i + 1));
    return list.map((s) => ({ ...s, rank: rankMap.get(s.id) ?? 0 }));
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
            <div key={sub.id} className="glass rounded-[20px] p-5 transition-all hover:-translate-y-0.5 hover:shadow-md relative overflow-hidden"
              style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
              {/* 排名徽章 — 角标 */}
              <RankBadge rank={sub.rank} />
              {/* 头：提案号 + 状态 */}
              <div className="flex items-center justify-between mb-2 pl-12">
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
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
          onClick={() => setModalSub(null)}
        >
          <div
            className="rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl"
            style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.1)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between"
              style={{ background: '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div>
                <h3 className="text-base font-bold">{modalSub.title}</h3>
                <p className="text-xs mt-0.5" style={{ color: '#666' }}>
                  {modalSub.team && <Tag color="blue" style={{ margin: 0, marginRight: 6 }}>{modalSub.team}</Tag>}
                  总分 <b style={{ color: '#1a3a8a' }}>{modalSub.totalScore != null ? modalSub.totalScore.toFixed(1) : '—'}</b> · {modalSub.reviews.length} 条评审
                </p>
              </div>
              <button onClick={() => setModalSub(null)} className="text-xl" style={{ color: 'var(--text-muted)' }}>×</button>
            </div>

            <div className="p-6 space-y-4" style={{ color: '#1a1a1a' }}>
              {modalSub.reviews.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: '#999' }}>暂无评审记录</p>
              ) : modalSub.reviews.map((r) => (
                <div key={r.id} className="rounded-xl p-4" style={{ background: '#f5f7fb', border: '1px solid rgba(26,58,138,0.15)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm" style={{ color: '#1a1a1a' }}>{r.reviewerName}</span>
                      {r.reviewerRole && <Tag color={ROLE_COLOR[r.reviewerRole]} style={{ margin: 0 }}>{ROLE_LABEL[r.reviewerRole]}</Tag>}
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold" style={{ color: '#1a3a8a' }}>{r.weightedScore}</div>
                      <div className="text-[10px]" style={{ color: '#666' }}>加权总分</div>
                    </div>
                  </div>
                  {/* 各维度分 */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-2 text-xs">
                    {Object.entries(r.scores).map(([dim, val]) => (
                      <div key={dim} className="flex items-center justify-between">
                        <span style={{ color: '#555' }}>{ROLE_DIM_LABEL[dim] ?? dim}</span>
                        <span className="font-mono font-semibold" style={{ color: '#1a1a1a' }}>{val}</span>
                      </div>
                    ))}
                  </div>
                  {r.reason && (
                    <p className="text-xs mt-2 pt-2" style={{ color: '#333', borderTop: '1px dashed rgba(0,0,0,0.1)' }}>
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
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
          onClick={() => setDetailSub(null)}
        >
          <div
            className="rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl"
            style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.1)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 px-6 py-4"
              style={{ background: '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
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

            <div className="p-6 space-y-5" style={{ color: '#1a1a1a' }}>
              {/* 量化对比（最显眼位置） */}
              <QuantCard sub={detailSub} />

              {/* 提报 */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="提报人" value={detailSub.authorName} />
                <Field label="小组成员" value={detailSub.teamMembers} />
                <Field label="方案确认人" value={detailSub.verifier} />
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
                  <pre className="text-xs whitespace-pre-wrap font-sans" style={{ color: '#1a1a1a' }}>{detailSub.beforeProcess}</pre>
                </Section>
              )}

              {detailSub.afterProcess && (
                <Section title="改造后流程">
                  <pre className="text-xs whitespace-pre-wrap font-sans" style={{ color: '#1a1a1a' }}>{detailSub.afterProcess}</pre>
                </Section>
              )}

              {detailSub.implementation && (
                <Section title="实现方式">
                  <pre className="text-xs whitespace-pre-wrap font-sans" style={{ color: '#1a1a1a' }}>{detailSub.implementation}</pre>
                </Section>
              )}

              {detailSub.extraValue && (
                <Section title="其他价值">
                  <pre className="text-xs whitespace-pre-wrap font-sans" style={{ color: '#1a1a1a' }}>{detailSub.extraValue}</pre>
                </Section>
              )}

              {(detailSub.demoLink || detailSub.recordUrl) && (
                <Section title="相关链接">
                  {detailSub.demoLink && (
                    <a href={detailSub.demoLink} target="_blank" rel="noopener noreferrer"
                      className="block text-xs hover:underline mb-1" style={{ color: '#1a3a8a' }}>
                      Demo: {detailSub.demoLink}
                    </a>
                  )}
                  {detailSub.recordUrl && (
                    <a href={detailSub.recordUrl} target="_blank" rel="noopener noreferrer"
                      className="block text-xs hover:underline" style={{ color: '#1a3a8a' }}>
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
      <div className="text-xs font-medium mb-0.5" style={{ color: '#666' }}>{label}</div>
      <div className="text-sm font-medium" style={{ color: value ? '#1a1a1a' : '#999' }}>
        {value || '—'}
      </div>
    </div>
  );
}

/** 详情弹窗里的分段 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm font-bold mb-2" style={{ color: '#1a1a1a' }}>{title}</div>
      <div>{children}</div>
    </div>
  );
}

/** 量化对比卡 — 弹窗最顶部，最显眼 */
function QuantCard({ sub }: { sub: SubmissionDTO }) {
  // 数据
  const savedHours = sub.monthlySavedHours;
  const effRate = sub.efficiencyRate;
  // before/after 字段
  const beforeH = sub.beforeHoursPerPerson;
  const beforeP = sub.beforePeopleCount;
  const afterH = sub.afterHoursPerPerson;
  const afterP = sub.afterPeopleCount;
  const oldOp = sub.oldOperationCount;
  const newOp = sub.newOperationCount;
  const oldDur = sub.oldHoursPerTask;
  const newDur = sub.newDuration;
  const hasHours = beforeH != null || afterH != null;
  const hasPeople = beforeP != null || afterP != null;
  const hasOps = oldOp != null || newOp != null;
  const hasDur = oldDur != null || newDur != null;
  const hasAny = savedHours != null || effRate != null || hasHours || hasPeople || hasOps || hasDur;
  if (!hasAny) return null;

  // 节省工时 = (原工时 - 新工时) × 原人数
  const calcSaved = (beforeH != null && afterH != null && beforeP != null)
    ? Math.round((beforeH - afterH) * beforeP * 10) / 10
    : null;
  const showSaved = savedHours ?? calcSaved;

  return (
    <div className="rounded-2xl p-5 shadow-sm"
      style={{ background: 'linear-gradient(135deg, #1a3a8a 0%, #2d5aa0 100%)', color: '#fff' }}>
      <div className="text-xs font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.8)' }}>
        📊 量化数据
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {showSaved != null && (
          <div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>月均节省工时</div>
            <div className="text-2xl font-bold mt-0.5">
              {typeof showSaved === 'number' ? showSaved.toFixed(1) : showSaved}
              <span className="text-sm font-medium ml-1" style={{ color: 'rgba(255,255,255,0.8)' }}>小时</span>
            </div>
          </div>
        )}
        {effRate != null && (
          <div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>提效比例</div>
            <div className="text-2xl font-bold mt-0.5">
              {(effRate * 100).toFixed(1)}
              <span className="text-sm font-medium ml-1" style={{ color: 'rgba(255,255,255,0.8)' }}>%</span>
            </div>
          </div>
        )}
      </div>

      {/* before / after 对比行 */}
      <div className="space-y-2 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }}>
        {hasHours && (
          <CompareRow
            label="人均单次工时"
            before={beforeH != null ? `${beforeH} 小时` : '—'}
            after={afterH != null ? `${afterH} 小时` : '—'}
          />
        )}
        {hasPeople && (
          <CompareRow
            label="涉及人数"
            before={beforeP != null ? `${beforeP} 人` : '—'}
            after={afterP != null ? `${afterP} 人` : '—'}
          />
        )}
        {hasOps && (
          <CompareRow
            label="操作次数"
            before={oldOp != null ? `${oldOp} 次` : '—'}
            after={newOp != null ? `${newOp} 次` : '—'}
          />
        )}
        {hasDur && (
          <CompareRow
            label="单次时长"
            before={oldDur != null ? `${oldDur}` : '—'}
            after={newDur != null ? `${newDur}` : '—'}
          />
        )}
      </div>
    </div>
  );
}

function CompareRow({ label, before, after }: { label: string; before: string; after: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-20 shrink-0" style={{ color: 'rgba(255,255,255,0.7)' }}>{label}</span>
      <span style={{ color: 'rgba(255,255,255,0.6)' }}>{before}</span>
      <span style={{ color: 'rgba(255,255,255,0.6)' }}>→</span>
      <b style={{ color: '#fff' }}>{after}</b>
    </div>
  );
}

/** 排名徽章 — 卡片左上角角标 */
function RankBadge({ rank }: { rank: number }) {
  // 前 3 名用金银铜色，其余用灰色
  const styleMap: Record<number, { bg: string; color: string; label: string }> = {
    1: { bg: 'linear-gradient(135deg, #FFD700, #FFA500)', color: '#5a3a00', label: '🥇' },
    2: { bg: 'linear-gradient(135deg, #E8E8E8, #B0B0B0)', color: '#3a3a3a', label: '🥈' },
    3: { bg: 'linear-gradient(135deg, #CD7F32, #A0522D)', color: '#fff', label: '🥉' },
  };
  const s = styleMap[rank] ?? { bg: 'rgba(26,58,138,0.08)', color: '#1a3a8a', label: '' };
  return (
    <div
      className="absolute top-0 left-0 flex items-center justify-center font-bold"
      style={{
        width: 44,
        height: 44,
        background: s.bg,
        color: s.color,
        borderBottomRightRadius: 12,
        fontSize: 16,
        lineHeight: 1,
        boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
        zIndex: 1,
      }}
      title={`第 ${rank} 名`}
    >
      {s.label ? <span className="text-base mr-0.5">{s.label}</span> : null}
      <span style={{ marginLeft: s.label ? -2 : 0 }}>{rank}</span>
    </div>
  );
}
