'use client';

import { useState, useEffect } from 'react';
import { Spin, App, Switch } from 'antd';
import { SyncOutlined, TrophyOutlined, CalendarOutlined, UserOutlined, BankOutlined, CodeOutlined } from '@ant-design/icons';
import { useAuth } from '@/lib/auth-context';
import CompetitionCard from '@/components/CompetitionCard';
import type { Submission } from '@/components/CompetitionCard';
import type { CompetitionReview, ReviewScores, ReviewerRole } from '@/types';

export default function CompetitionsPage() {
  const { user, isAdmin, isReviewer } = useAuth();
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [period] = useState('2605');
  const [reviews, setReviews] = useState<Record<string, { decision: string; scores?: ReviewScores; reason: string; reviewer_role?: ReviewerRole | null }>>({});
  const [reviewerRole, setReviewerRole] = useState<ReviewerRole | null>(null);
  const [roleLocked, setRoleLocked] = useState(false);
  const [onlyPending, setOnlyPending] = useState(false);
  const { message } = App.useApp();

  // 从 Supabase 读取已同步数据
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/competitions/sync?period=${period}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setItems((data.items ?? []).sort(
        (a: Submission, b: Submission) => (b.monthlySavedHours ?? 0) - (a.monthlySavedHours ?? 0),
      ));
      setLoaded(true);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  // 触发飞书 → Supabase 同步
  const handleSync = async () => {
    setSyncing(true);
    message.loading({ content: '正在从飞书同步，附件较多时可能需要几分钟…', key: 'sync', duration: 0 });
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5 * 60 * 1000); // 5 分钟超时
      const res = await fetch(`/api/competitions/sync?period=${period}`, {
        method: 'POST',
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      message.success({ content: `已同步 ${data.synced} 条方案`, key: 'sync' });
      await fetchData();
    } catch (err) {
      const msg = err instanceof DOMException && err.name === 'AbortError'
        ? '同步超时，请稍后重试'
        : err instanceof Error ? err.message : '同步失败';
      message.error({ content: msg, key: 'sync' });
    } finally {
      setSyncing(false);
    }
  };

  // 页面加载
  useEffect(() => {
    fetchData();
  }, [period]);

  // 评委加载评审记录，已有评审则锁定角色
  useEffect(() => {
    if (isReviewer) {
      fetch('/api/competitions/reviews?mine=true')
        .then((r) => r.json())
        .then((data) => {
          const reviewsList: CompetitionReview[] = data.reviews ?? [];
          const map: Record<string, { decision: string; scores?: ReviewScores; reason: string; reviewer_role?: ReviewerRole | null }> = {};
          reviewsList.forEach((r) => {
            map[r.submission_id] = { decision: r.decision, scores: r.scores, reason: r.reason, reviewer_role: r.reviewer_role };
          });
          setReviews(map);
          // 已有新机制评审记录，锁定角色
          const reviewed = reviewsList.filter((r) => r.decision === 'reviewed' && r.reviewer_role);
          if (reviewed.length > 0) {
            setReviewerRole(reviewed[0].reviewer_role!);
            setRoleLocked(true);
          }
        })
        .catch(() => {});
    }
  }, [isReviewer]);

  const handleReview = async (submissionId: string, scores: ReviewScores, reviewerRole: ReviewerRole, reason?: string) => {
    try {
      const item = items.find((i) => i.id === submissionId);
      const res = await fetch('/api/competitions/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submission_id: submissionId,
          scores,
          reviewer_role: reviewerRole,
          reason,
          proposal_no: item?.proposalNo ?? null,
          title: item?.title ?? '',
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      const data = await res.json();
      setReviews((prev) => ({
        ...prev,
        [submissionId]: { decision: data.review.decision, scores: data.review.scores, reason: data.review.reason, reviewer_role: data.review.reviewer_role },
      }));
      setRoleLocked(true);
      message.success('评分已提交');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '评审失败');
    }
  };

  // 用户评委只看 reviewers 包含自己的方案，业务/技术评委看全部
  const roleFiltered = reviewerRole === 'user'
    ? items.filter((i) => i.reviewers?.includes(user?.name ?? ''))
    : items;
  // 只看未评审
  const displayItems = onlyPending
    ? roleFiltered.filter((i) => reviews[i.id]?.decision !== 'reviewed')
    : roleFiltered;

  return (
    <>
      {/* 本月参赛方案卡片 */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
              style={{ background: 'var(--gradient-primary)', color: '#fff', boxShadow: '0 4px 15px rgba(26,58,138,0.25)' }}>
              <TrophyOutlined />
            </span>
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2.5" style={{ color: 'var(--foreground)' }}>
                本月参赛方案
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                  style={{ background: 'rgba(242, 127, 34, 0.1)', color: '#b3540e' }}>
                  <CalendarOutlined style={{ fontSize: 11 }} />
                  {period}
                </span>
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {loaded ? `${displayItems.length} 条方案` : '加载中...'}
                {loaded && displayItems.length > 0 && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
                    style={{ background: 'rgba(242, 127, 34, 0.08)', color: '#b3540e' }}>
                    按照提报人填写的月度节省工时降序排列
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="https://finebyme99.github.io/hras-2026/" target="_blank" rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105"
              style={{ background: 'var(--primary)', color: '#fff' }}>
              大赛主页
            </a>
            <a href="https://ztn.feishu.cn/share/base/form/shrcnzpkRvRFdo6359hFYfCTpZg" target="_blank" rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              参与提报
            </a>
            <a href="https://ztn.feishu.cn/share/base/form/shrcnzQxxexe7eyuztTiCydTdz7" target="_blank" rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105"
              style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(12px)', color: 'var(--primary)', border: '1px solid rgba(26,58,138,0.15)' }}>
              参与许愿
            </a>
            {isAdmin && (
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all hover:scale-105 disabled:opacity-50"
                style={{ background: 'var(--primary)', boxShadow: '0 4px 15px rgba(26,58,138,0.25)' }}
              >
                <SyncOutlined spin={syncing} /> 从飞书同步
              </button>
            )}
          </div>
        </div>

        {/* 评委角色选择 + 评审进度 */}
        {isReviewer && loaded && items.length > 0 && (
          <div className="mb-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 rounded-xl mb-3"
              style={{ background: 'rgba(26,58,138,0.04)', border: '1px solid rgba(26,58,138,0.08)' }}>
              <span className="text-xs font-semibold" style={{ color: 'var(--primary)' }}>我的角色</span>
              <div className="flex items-center gap-2">
                {([
                  { key: 'user' as ReviewerRole, label: '用户评委', icon: <UserOutlined /> },
                  { key: 'business' as ReviewerRole, label: '业务评委', icon: <BankOutlined /> },
                  { key: 'tech' as ReviewerRole, label: '技术评委', icon: <CodeOutlined /> },
                ]).map((r) => (
                  <button
                    key={r.key}
                    onClick={() => !roleLocked && setReviewerRole(r.key)}
                    disabled={roleLocked}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{
                      background: reviewerRole === r.key ? 'var(--primary)' : 'rgba(255,255,255,0.6)',
                      color: reviewerRole === r.key ? '#fff' : 'var(--text-secondary)',
                      border: reviewerRole === r.key ? 'none' : '1px solid rgba(26,58,138,0.12)',
                      boxShadow: reviewerRole === r.key ? '0 4px 12px rgba(26,58,138,0.25)' : 'none',
                    }}
                  >
                    {r.icon} {r.label}
                  </button>
                ))}
                {roleLocked && (
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    角色已锁定
                  </span>
                )}
              </div>
              {!reviewerRole && !roleLocked && (
                <span className="text-[11px]" style={{ color: '#b3540e' }}>
                  请选择评委角色后开始评分
                </span>
              )}
            </div>
            {(() => {
              const reviewedCount = displayItems.filter((i) => reviews[i.id]?.decision === 'reviewed').length;
              const pending = displayItems.length - reviewedCount;
              return (
                <div className="flex items-center gap-4 px-4 py-2.5 rounded-xl text-xs"
                  style={{ background: 'rgba(26,58,138,0.02)', border: '1px solid rgba(26,58,138,0.05)' }}>
                  <span className="font-semibold" style={{ color: 'var(--primary)' }}>评审进度</span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    待审 <b style={{ color: 'var(--foreground)' }}>{pending}</b> 条
                  </span>
                  <span style={{ color: '#16a34a' }}>
                    已评审 <b>{reviewedCount}</b> 条
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>
                    共 {displayItems.length} 条
                  </span>
                  <span className="ml-auto flex items-center gap-1.5">
                    <Switch size="small" checked={onlyPending} onChange={setOnlyPending} />
                    <span style={{ color: 'var(--text-secondary)' }}>只看未评审</span>
                  </span>
                </div>
              );
            })()}
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-12">
            <Spin size="large" />
          </div>
        )}

        {!loading && loaded && displayItems.length === 0 && (
          <div className="text-center py-12 glass rounded-2xl" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {reviewerRole === 'user' ? '暂无分配给您的评审方案，请联系管理员分配' : '暂无参赛方案，点击「从飞书同步」导入数据'}
            </p>
          </div>
        )}

        {displayItems.length > 0 && (
          <div className="flex flex-col gap-4">
            {displayItems.map((item) => (
              <CompetitionCard
                key={item.id}
                data={item}
                isReviewer={isReviewer}
                reviewerRole={reviewerRole}
                existingReview={reviews[item.id] || null}
                onReview={handleReview}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
