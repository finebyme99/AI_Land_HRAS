'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { Tag, Avatar, Input, Spin, App } from 'antd';
import {
  LikeOutlined,
  StarOutlined,
  ShareAltOutlined,
  EyeOutlined,
  ArrowLeftOutlined,
  UserOutlined,
  BookOutlined,
  PaperClipOutlined,
} from '@ant-design/icons';
import { getSupabase } from '@/lib/supabase';
import { CATEGORY_COLORS } from '@/lib/constants';
import type { Case } from '@/types';

export default function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { message } = App.useApp();
  const [caseItem, setCaseItem] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<{ id: string; content: string; author: { name: string; avatar: string }; created_at: string }[]>([]);
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    async function fetchCase() {
      setLoading(true);
      try {
        const { data, error } = await getSupabase()
          .from('cases')
          .select('*, author:users!author_id(id, name, avatar, department)')
          .eq('id', id)
          .single();
        if (error) throw error;
        setCaseItem(data as Case);

        // Increment view count
        getSupabase().rpc('increment_view_count', { table_name: 'cases', row_id: id });

        // Fetch comments
        const { data: commentData } = await getSupabase()
          .from('comments')
          .select('*, author:users!author_id(id, name, avatar)')
          .eq('target_type', 'case')
          .eq('target_id', id)
          .order('created_at', { ascending: false });
        setComments((commentData ?? []) as typeof comments);
      } catch (err) {
        console.error('Failed to fetch case:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchCase();
  }, [id]);

  const handleLike = async () => {
    if (!caseItem) return;
    const newCount = liked ? caseItem.like_count - 1 : caseItem.like_count + 1;
    setLiked(!liked);
    setCaseItem({ ...caseItem, like_count: newCount });
    await getSupabase().from('cases').update({ like_count: newCount }).eq('id', id);
    message.success(liked ? '已取消点赞' : '点赞成功');
  };

  const handleBookmark = async () => {
    if (!caseItem) return;
    const newCount = bookmarked ? caseItem.bookmark_count - 1 : caseItem.bookmark_count + 1;
    setBookmarked(!bookmarked);
    setCaseItem({ ...caseItem, bookmark_count: newCount });
    await getSupabase().from('cases').update({ bookmark_count: newCount }).eq('id', id);
    message.success(bookmarked ? '已取消收藏' : '收藏成功');
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    message.success('链接已复制，可以分享到飞书');
  };

  const handleComment = async () => {
    if (!commentText.trim()) return;
    try {
      const { error } = await getSupabase().from('comments').insert({
        target_type: 'case',
        target_id: id,
        content: commentText.trim(),
      });
      if (error) throw error;
      setCommentText('');
      message.success('评论已提交');
      // Refresh comments
      const { data: commentData } = await getSupabase()
        .from('comments')
        .select('*, author:users!author_id(id, name, avatar)')
        .eq('target_type', 'case')
        .eq('target_id', id)
        .order('created_at', { ascending: false });
      setComments((commentData ?? []) as typeof comments);
      // Update comment count
      if (caseItem) {
        const newCount = caseItem.comment_count + 1;
        setCaseItem({ ...caseItem, comment_count: newCount });
        await getSupabase().from('cases').update({ comment_count: newCount }).eq('id', id);
      }
    } catch {
      message.error('评论提交失败，请重试');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Spin size="large" />
      </div>
    );
  }

  if (!caseItem) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <p style={{ color: 'var(--text-muted)' }}>案例不存在</p>
        <Link href="/cases" style={{ color: 'var(--primary)' }}>返回案例列表</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <Link href="/cases" className="inline-flex items-center gap-1.5 text-sm mb-6 transition-opacity hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
        <ArrowLeftOutlined /> 返回案例列表
      </Link>

      {/* Main content */}
      <article className="glass rounded-2xl p-6 sm:p-8 mb-6" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Tag color={CATEGORY_COLORS[caseItem.category]}>{caseItem.category}</Tag>
          {caseItem.ai_tools.map((tool) => (
            <Tag key={tool}>{tool}</Tag>
          ))}
          {caseItem.event_id && <Tag color="red">大赛作品</Tag>}
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold mb-5 leading-tight">
          {caseItem.title}
        </h1>

        <div className="flex items-center gap-4 mb-6 text-sm flex-wrap" style={{ color: 'var(--text-muted)' }}>
          <div className="flex items-center gap-2">
            <Avatar size="small" src={caseItem.author.avatar} icon={<UserOutlined />} />
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{caseItem.author.name}</span>
            <span style={{ color: 'var(--border)' }}>·</span>
            <span>{caseItem.author.department}</span>
          </div>
          <span className="flex items-center gap-1"><EyeOutlined /> {caseItem.view_count}</span>
          <span>创建于 {new Date(caseItem.created_at).toLocaleDateString('zh-CN')}</span>
          {caseItem.updated_at !== caseItem.created_at && (
            <span>更新于 {new Date(caseItem.updated_at).toLocaleDateString('zh-CN')}</span>
          )}
        </div>

        <div className="mb-8" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1.5rem' }}>
          <div className="leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}
            dangerouslySetInnerHTML={{ __html: caseItem.content }}
          />
        </div>

        {/* Attachments */}
        {caseItem.attachments && caseItem.attachments.length > 0 && (
          <div className="mb-6 p-4 rounded-xl" style={{ background: 'rgba(255, 255, 255, 0.3)', border: '1px solid var(--border-light)' }}>
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <PaperClipOutlined /> 附件
            </h3>
            <div className="flex flex-wrap gap-2">
              {caseItem.attachments.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                  className="text-sm px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
                  style={{ color: 'var(--primary)', background: 'rgba(26, 58, 138, 0.06)' }}>
                  附件 {i + 1}
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 pt-4" style={{ borderTop: '1px solid var(--border-light)' }}>
          <button onClick={handleLike}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all hover:-translate-y-0.5"
            style={{ color: liked ? 'var(--primary)' : 'var(--text-secondary)', border: '1px solid rgba(255, 255, 255, 0.6)', background: liked ? 'rgba(26, 58, 138, 0.06)' : 'var(--surface)' }}>
            <LikeOutlined /> 点赞 ({caseItem.like_count})
          </button>
          <button onClick={handleBookmark}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all hover:-translate-y-0.5"
            style={{ color: bookmarked ? 'var(--primary)' : 'var(--text-secondary)', border: '1px solid rgba(255, 255, 255, 0.6)', background: bookmarked ? 'rgba(26, 58, 138, 0.06)' : 'var(--surface)' }}>
            <StarOutlined /> 收藏 ({caseItem.bookmark_count})
          </button>
          <button onClick={handleShare}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all hover:-translate-y-0.5"
            style={{ color: 'var(--text-secondary)', border: '1px solid rgba(255, 255, 255, 0.6)', background: 'var(--surface)' }}>
            <ShareAltOutlined /> 分享
          </button>
        </div>
      </article>

      {/* Comments */}
      <div className="glass rounded-2xl p-6 sm:p-8" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <h2 className="text-lg font-semibold mb-5 flex items-center gap-2">
          <BookOutlined style={{ color: 'var(--primary)' }} />
          评论 ({comments.length})
        </h2>

        <Input.TextArea
          rows={3}
          placeholder="写下你的评论..."
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
        />
        <div className="flex justify-end mt-3">
          <button className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90"
            style={{ background: 'var(--primary)' }}
            onClick={handleComment}>
            发表评论
          </button>
        </div>

        {comments.length === 0 ? (
          <div className="mt-5 pt-5 text-center" style={{ borderTop: '1px solid var(--border-light)', color: 'var(--text-muted)' }}>
            <p className="text-sm">暂无评论，快来抢沙发吧！</p>
          </div>
        ) : (
          <div className="mt-5 pt-5 flex flex-col gap-4" style={{ borderTop: '1px solid var(--border-light)' }}>
            {comments.map((c) => (
              <div key={c.id} className="flex gap-3">
                <Avatar size="small" src={c.author.avatar} icon={<UserOutlined />} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">{c.author.name}</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {new Date(c.created_at).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{c.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
