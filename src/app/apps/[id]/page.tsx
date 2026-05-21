'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { Tag, Rate, Spin, App } from 'antd';
import {
  ArrowLeftOutlined,
  LikeOutlined,
  DislikeOutlined,
  ShareAltOutlined,
  LinkOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { getSupabase } from '@/lib/supabase';
import { APP_CATEGORY_COLORS } from '@/lib/constants';
import type { AppRecommendation } from '@/types';

export default function AppDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { message } = App.useApp();
  const [app, setApp] = useState<AppRecommendation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchApp() {
      setLoading(true);
      try {
        const { data, error } = await getSupabase()
          .from('apps')
          .select('*')
          .eq('id', id)
          .single();
        if (error) throw error;
        setApp(data as AppRecommendation);
      } catch (err) {
        console.error('Failed to fetch app:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchApp();
  }, [id]);

  const handleLike = async () => {
    if (!app) return;
    const newCount = app.like_count + 1;
    setApp({ ...app, like_count: newCount });
    await getSupabase().from('apps').update({ like_count: newCount }).eq('id', id);
    message.success('已点赞');
  };

  const handleDislike = async () => {
    if (!app) return;
    const newCount = app.dislike_count + 1;
    setApp({ ...app, dislike_count: newCount });
    await getSupabase().from('apps').update({ dislike_count: newCount }).eq('id', id);
    message.success('已点踩');
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    message.success('链接已复制');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Spin size="large" />
      </div>
    );
  }

  if (!app) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <p style={{ color: 'var(--text-muted)' }}>应用不存在</p>
        <Link href="/apps" style={{ color: 'var(--primary)' }}>返回应用列表</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <Link href="/apps" className="inline-flex items-center gap-1.5 text-sm mb-6 transition-opacity hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
        <ArrowLeftOutlined /> 返回应用列表
      </Link>

      <div className="glass rounded-2xl p-6 sm:p-8 mb-6" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-bold"
            style={{ background: 'rgba(26, 58, 138, 0.06)', color: 'var(--primary)' }}>
            {app.name[0]}
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">{app.name}</h1>
            <Tag color={APP_CATEGORY_COLORS[app.category]}>{app.category}</Tag>
          </div>
        </div>

        <p className="mb-6 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{app.description}</p>

        <div className="flex flex-wrap gap-2 mb-6">
          {app.scenarios.map((s) => (
            <Tag key={s}>{s}</Tag>
          ))}
        </div>

        <div className="flex items-center gap-6 mb-6 p-4 rounded-lg" style={{ background: 'rgba(255, 255, 255, 0.3)' }}>
          <div>
            <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>评分</div>
            <Rate disabled defaultValue={Number(app.rating)} allowHalf />
            <span className="ml-2 text-sm" style={{ color: 'var(--text-muted)' }}>{app.rating}</span>
          </div>
          <div>
            <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>使用人数</div>
            <span className="text-lg font-semibold flex items-center gap-1"><UserOutlined /> {app.user_count}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <a href={app.official_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90"
            style={{ background: 'var(--primary)' }}>
            <LinkOutlined /> 访问官网
          </a>
          <button onClick={handleLike}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all hover:-translate-y-0.5"
            style={{ color: 'var(--text-secondary)', border: '1px solid rgba(255, 255, 255, 0.6)', background: 'var(--surface)' }}>
            <LikeOutlined /> 点赞 ({app.like_count})
          </button>
          <button onClick={handleDislike}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all hover:-translate-y-0.5"
            style={{ color: 'var(--text-secondary)', border: '1px solid rgba(255, 255, 255, 0.6)', background: 'var(--surface)' }}>
            <DislikeOutlined /> 点踩 ({app.dislike_count})
          </button>
          <button onClick={handleShare}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all hover:-translate-y-0.5"
            style={{ color: 'var(--text-secondary)', border: '1px solid rgba(255, 255, 255, 0.6)', background: 'var(--surface)' }}>
            <ShareAltOutlined /> 分享
          </button>
        </div>
      </div>

      {/* Reviews */}
      <div className="glass rounded-2xl p-6 sm:p-8" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <h2 className="text-lg font-semibold mb-4">用户评价</h2>
        <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
          <p className="text-sm">暂无评价，快来第一个评价吧！</p>
        </div>
      </div>
    </div>
  );
}
