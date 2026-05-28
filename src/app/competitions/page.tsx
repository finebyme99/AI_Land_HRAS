'use client';

import { useState, useEffect } from 'react';
import { Spin, message } from 'antd';
import { ArrowLeftOutlined, SyncOutlined, TrophyOutlined, CalendarOutlined } from '@ant-design/icons';
import { useAuth } from '@/lib/auth-context';
import CompetitionCard from '@/components/CompetitionCard';
import type { Submission } from '@/components/CompetitionCard';

const CACHE_KEY = 'competition_submissions';

function loadCache(period: string): Submission[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw);
    if (cache.period !== period) return null;
    return cache.items ?? null;
  } catch {
    return null;
  }
}

function saveCache(period: string, items: Submission[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ period, items, syncedAt: Date.now() }));
  } catch { /* ignore */ }
}

export default function CompetitionsPage() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [synced, setSynced] = useState(false);
  const [period] = useState('2605');

  // 页面加载时读取缓存
  useEffect(() => {
    const cached = loadCache(period);
    if (cached) {
      cached.sort((a, b) => (b.monthlySavedHours ?? 0) - (a.monthlySavedHours ?? 0));
      setItems(cached);
      setSynced(true);
    }
  }, [period]);

  const handleSync = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/competitions/sync?period=${period}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const fetched = (data.items ?? []).sort(
        (a: Submission, b: Submission) => (b.monthlySavedHours ?? 0) - (a.monthlySavedHours ?? 0),
      );
      setItems(fetched);
      setSynced(true);
      saveCache(period, fetched);
      message.success(`已同步 ${fetched.length} 条方案`);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '同步失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* 返回按钮 */}
      <a
        href="/"
        className="fixed bottom-6 left-4 z-[60] flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all hover:scale-105 hover:shadow-lg"
        style={{
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(12px)',
          color: 'var(--primary)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.6)',
        }}
      >
        <ArrowLeftOutlined /> 返回 AI 岛
      </a>

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
                  style={{ background: 'rgba(242, 127, 34, 0.1)', color: '#F27F22' }}>
                  <CalendarOutlined style={{ fontSize: 11 }} />
                  {period}
                </span>
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {synced ? `${items.length} 条方案` : '点击同步加载数据'}
              </p>
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={handleSync}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:scale-105 disabled:opacity-50"
              style={{ background: 'var(--primary)', boxShadow: '0 4px 15px rgba(26,58,138,0.25)' }}
            >
              <SyncOutlined spin={loading} /> {synced ? '重新同步' : '同步多维表格数据'}
            </button>
          )}
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <Spin size="large" />
          </div>
        )}

        {!loading && synced && items.length === 0 && (
          <div className="text-center py-12 glass rounded-2xl" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>当前期次暂无参赛方案</p>
          </div>
        )}

        {items.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <CompetitionCard key={item.id} data={item} />
            ))}
          </div>
        )}
      </section>

      {/* 大赛原始页面 */}
      <div className="w-full" style={{ height: 'calc(100vh - 60px)' }}>
        <iframe
          src="/hras-2026/index.html"
          className="w-full h-full border-0"
          title="AI 大赛"
        />
      </div>
    </>
  );
}
