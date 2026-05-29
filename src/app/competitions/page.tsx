'use client';

import { useState, useEffect } from 'react';
import { Spin, App } from 'antd';
import { SyncOutlined, TrophyOutlined, CalendarOutlined } from '@ant-design/icons';
import { useAuth } from '@/lib/auth-context';
import CompetitionCard from '@/components/CompetitionCard';
import type { Submission } from '@/components/CompetitionCard';
import type { CompetitionReview } from '@/types';

export default function CompetitionsPage() {
  const { isAdmin, isReviewer } = useAuth();
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [period] = useState('2605');
  const [reviews, setReviews] = useState<Record<string, { decision: string; reason: string; is_benchmark?: boolean }>>({});
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

  // 评委加载评审记录
  useEffect(() => {
    if (isReviewer) {
      fetch('/api/competitions/reviews?mine=true')
        .then((r) => r.json())
        .then((data) => {
          const map: Record<string, { decision: string; reason: string; is_benchmark?: boolean }> = {};
          (data.reviews ?? []).forEach((r: CompetitionReview) => {
            map[r.submission_id] = { decision: r.decision, reason: r.reason, is_benchmark: r.is_benchmark };
          });
          setReviews(map);
        })
        .catch(() => {});
    }
  }, [isReviewer]);

  const handleReview = async (submissionId: string, decision: 'approved' | 'rejected', reason?: string, is_benchmark?: boolean) => {
    try {
      const item = items.find((i) => i.id === submissionId);
      const res = await fetch('/api/competitions/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submission_id: submissionId,
          decision,
          reason,
          proposal_no: item?.proposalNo ?? null,
          title: item?.title ?? '',
          is_benchmark,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      const data = await res.json();
      setReviews((prev) => ({
        ...prev,
        [submissionId]: { decision: data.review.decision, reason: data.review.reason, is_benchmark: data.review.is_benchmark },
      }));
      message.success(decision === 'approved' ? '已通过' : '已驳回');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '评审失败');
    }
  };

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
                {loaded ? `${items.length} 条方案` : '加载中...'}
                {loaded && items.length > 0 && (
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

        {/* 评委评审进度 */}
        {isReviewer && loaded && items.length > 0 && (() => {
          const reviewed = items.filter((i) => reviews[i.id]);
          const approved = reviewed.filter((i) => reviews[i.id].decision === 'approved').length;
          const rejected = reviewed.filter((i) => reviews[i.id].decision === 'rejected').length;
          const pending = items.length - reviewed.length;
          return (
            <div className="flex items-center gap-4 mb-5 px-4 py-3 rounded-xl text-xs"
              style={{ background: 'rgba(26,58,138,0.04)', border: '1px solid rgba(26,58,138,0.08)' }}>
              <span className="font-semibold" style={{ color: 'var(--primary)' }}>评审进度</span>
              <span style={{ color: 'var(--text-secondary)' }}>
                待审 <b style={{ color: 'var(--foreground)' }}>{pending}</b> 条
              </span>
              <span style={{ color: '#16a34a' }}>
                已通过 <b>{approved}</b> 条
              </span>
              <span style={{ color: '#dc2626' }}>
                已驳回 <b>{rejected}</b> 条
              </span>
              <span style={{ color: 'var(--text-muted)' }}>
                共 {items.length} 条
              </span>
              {pending > 0 && (
                <span className="ml-auto font-medium" style={{ color: '#b3540e' }}>
                  请及时完成评审
                </span>
              )}
            </div>
          );
        })()}

        {loading && (
          <div className="flex justify-center py-12">
            <Spin size="large" />
          </div>
        )}

        {!loading && loaded && items.length === 0 && (
          <div className="text-center py-12 glass rounded-2xl" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>暂无参赛方案，点击「从飞书同步」导入数据</p>
          </div>
        )}

        {items.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <CompetitionCard
                key={item.id}
                data={item}
                isReviewer={isReviewer}
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
