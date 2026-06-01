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
  ReadOutlined,
  ThunderboltOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { getSupabase } from '@/lib/supabase';
import { RESOURCE_CATEGORY_COLORS, RESOURCE_TYPE_TABS } from '@/lib/constants';
import type { Resource, ResourceType } from '@/types';

const TYPE_ICONS: Record<ResourceType, React.ReactNode> = {
  ai_tool: <AppstoreOutlined />,
  guide: <ReadOutlined />,
  skill: <ThunderboltOutlined />,
};

const TYPE_LABELS: Record<ResourceType, string> = {
  ai_tool: 'AI 工具',
  guide: '操作指引',
  skill: 'Skill',
};

export default function ResourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { message } = App.useApp();
  const [resource, setResource] = useState<Resource | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchResource() {
      setLoading(true);
      try {
        const { data, error } = await getSupabase()
          .from('apps')
          .select('*')
          .eq('id', id)
          .single();
        if (error) throw error;
        setResource(data as Resource);
      } catch (err) {
        console.error('Failed to fetch resource:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchResource();
  }, [id]);

  const handleLike = async () => {
    if (!resource) return;
    const newCount = resource.like_count + 1;
    setResource({ ...resource, like_count: newCount });
    await getSupabase().from('apps').update({ like_count: newCount }).eq('id', id);
    message.success('已点赞');
  };

  const handleDislike = async () => {
    if (!resource) return;
    const newCount = resource.dislike_count + 1;
    setResource({ ...resource, dislike_count: newCount });
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

  if (!resource) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <p style={{ color: 'var(--text-muted)' }}>资源不存在</p>
        <Link href="/apps" style={{ color: 'var(--primary)' }}>返回资源列表</Link>
      </div>
    );
  }

  const isGuide = resource.resource_type === 'guide';
  const isSkill = resource.resource_type === 'skill';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <Link href="/apps" className="inline-flex items-center gap-1.5 text-sm mb-6 transition-opacity hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
        <ArrowLeftOutlined /> 返回资源列表
      </Link>

      {/* Header Card */}
      <div className="glass rounded-2xl p-6 sm:p-8 mb-6" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-bold"
            style={{ background: 'rgba(26, 58, 138, 0.06)', color: 'var(--primary)' }}>
            {resource.name[0]}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Tag icon={TYPE_ICONS[resource.resource_type]} color="blue">{TYPE_LABELS[resource.resource_type]}</Tag>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold">{resource.name}</h1>
            <Tag color={RESOURCE_CATEGORY_COLORS[resource.category]}>{resource.category}</Tag>
          </div>
        </div>

        <p className="mb-6 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{resource.description}</p>

        <div className="flex flex-wrap gap-2 mb-6">
          {resource.scenarios.map((s) => (
            <Tag key={s}>{s}</Tag>
          ))}
        </div>

        {/* AI 工具：显示评分和使用人数 */}
        {!isGuide && !isSkill && (
          <div className="flex items-center gap-6 mb-6 p-4 rounded-lg" style={{ background: 'rgba(255, 255, 255, 0.3)' }}>
            <div>
              <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>评分</div>
              <Rate disabled defaultValue={Number(resource.rating)} allowHalf />
              <span className="ml-2 text-sm" style={{ color: 'var(--text-muted)' }}>{resource.rating}</span>
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>使用人数</div>
              <span className="text-lg font-semibold flex items-center gap-1"><UserOutlined /> {resource.user_count}</span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {resource.official_url && (
            <a href={resource.official_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90"
              style={{ background: 'var(--primary)' }}>
              <LinkOutlined /> {isGuide ? '查看原文' : '访问官网'}
            </a>
          )}
          <button onClick={handleLike}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all hover:-translate-y-0.5"
            style={{ color: 'var(--text-secondary)', border: '1px solid rgba(255, 255, 255, 0.6)', background: 'var(--surface)' }}>
            <LikeOutlined /> 点赞 ({resource.like_count})
          </button>
          <button onClick={handleDislike}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all hover:-translate-y-0.5"
            style={{ color: 'var(--text-secondary)', border: '1px solid rgba(255, 255, 255, 0.6)', background: 'var(--surface)' }}>
            <DislikeOutlined /> 点踩 ({resource.dislike_count})
          </button>
          <button onClick={handleShare}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all hover:-translate-y-0.5"
            style={{ color: 'var(--text-secondary)', border: '1px solid rgba(255, 255, 255, 0.6)', background: 'var(--surface)' }}>
            <ShareAltOutlined /> 分享
          </button>
        </div>
      </div>

      {/* 操作指引 / Skills：渲染正文内容 */}
      {(isGuide || isSkill) && resource.content && (
        <div className="glass rounded-2xl p-6 sm:p-8 mb-6" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            {isGuide ? <ReadOutlined /> : <ThunderboltOutlined />}
            {isGuide ? '操作指引' : 'Skill 说明'}
          </h2>
          <div className="prose prose-sm max-w-none" style={{ color: 'var(--text-secondary)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
            {resource.content}
          </div>
        </div>
      )}

      {/* Reviews Placeholder */}
      <div className="glass rounded-2xl p-6 sm:p-8" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <h2 className="text-lg font-semibold mb-4">用户评价</h2>
        <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
          <p className="text-sm">暂无评价，快来第一个评价吧！</p>
        </div>
      </div>
    </div>
  );
}
