'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Tag, Avatar, Input, Spin, App, Modal } from 'antd';
import {
  LikeOutlined,
  StarOutlined,
  StarFilled,
  ShareAltOutlined,
  EyeOutlined,
  ArrowLeftOutlined,
  UserOutlined,
  BookOutlined,
  PaperClipOutlined,
  StopOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { CATEGORY_COLORS } from '@/lib/constants';
import type { Case } from '@/types';

export default function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, isAdmin } = useAuth();
  const { message, modal } = App.useApp();
  const router = useRouter();
  const [caseItem, setCaseItem] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [comments, setComments] = useState<{ id: string; content: string; author: { name: string; avatar: string }; created_at: string }[]>([]);
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [relatedCases, setRelatedCases] = useState<{ id: string; title: string; summary: string; category: string; view_count: number; like_count: number }[]>([]);

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

        // Check if current user liked/bookmarked
        if (user) {
          const { data: likeData } = await getSupabase()
            .from('likes')
            .select('id')
            .eq('user_id', user.id)
            .eq('target_type', 'case')
            .eq('target_id', id)
            .maybeSingle();
          setLiked(!!likeData);

          const { data: bookmarkData } = await getSupabase()
            .from('bookmarks')
            .select('id')
            .eq('user_id', user.id)
            .eq('target_type', 'case')
            .eq('target_id', id)
            .maybeSingle();
          setBookmarked(!!bookmarkData);
        }

        // Fetch related cases (same category)
        if (data?.category) {
          const { data: related } = await getSupabase()
            .from('cases')
            .select('id, title, summary, category, view_count, like_count')
            .eq('status', 'published')
            .eq('category', data.category)
            .neq('id', id)
            .order('view_count', { ascending: false })
            .limit(3);
          setRelatedCases((related ?? []) as typeof relatedCases);
        }
      } catch (err) {
        console.error('Failed to fetch case:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchCase();
  }, [id, user]);

  const handleLike = async () => {
    if (!caseItem) return;
    if (!user) { message.warning('请先登录'); return; }

    try {
      const res = await fetch('/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'like', target_type: 'case', target_id: id }),
      });
      const data = await res.json();
      setLiked(data.active);
      setCaseItem({ ...caseItem, like_count: caseItem.like_count + (data.active ? 1 : -1) });
      message.success(data.active ? '点赞成功' : '已取消点赞');
    } catch {
      message.error('操作失败');
    }
  };

  const handleBookmark = async () => {
    if (!caseItem) return;
    if (!user) { message.warning('请先登录'); return; }

    try {
      const res = await fetch('/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bookmark', target_type: 'case', target_id: id }),
      });
      const data = await res.json();
      setBookmarked(data.active);
      setCaseItem({ ...caseItem, bookmark_count: caseItem.bookmark_count + (data.active ? 1 : -1) });
      message.success(data.active ? '收藏成功' : '已取消收藏');
    } catch {
      message.error('操作失败');
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    message.success('链接已复制，可以分享到飞书');
  };

  const handleToggleFeatured = async () => {
    if (!caseItem) return;
    const newVal = !caseItem.is_featured;
    setCaseItem({ ...caseItem, is_featured: newVal });
    await getSupabase().from('cases').update({ is_featured: newVal }).eq('id', id);
    message.success(newVal ? '已设为精选' : '已取消精选');
  };

  const handleTakedown = () => {
    if (!caseItem) return;
    modal.confirm({
      title: '确认下架',
      content: `确定要下架「${caseItem.title}」吗？下架后将不再展示在前台。`,
      okText: '下架',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        await getSupabase().from('cases').update({ status: 'rejected' }).eq('id', id);
        message.success('案例已下架');
        router.push('/cases');
      },
    });
  };

  const handleRestore = async () => {
    if (!caseItem) return;
    setCaseItem({ ...caseItem, status: 'published' });
    await getSupabase().from('cases').update({ status: 'published' }).eq('id', id);
    message.success('案例已恢复上架');
  };

  const handleComment = async () => {
    if (!commentText.trim()) return;
    if (!user) { message.warning('请先登录'); return; }
    setSubmittingComment(true);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_type: 'case',
          target_id: id,
          content: commentText.trim(),
        }),
      });
      if (!res.ok) throw new Error('评论失败');
      const data = await res.json();
      setCommentText('');
      message.success('评论已提交');
      // Add new comment to list
      setComments([data.comment, ...comments]);
      // Update comment count
      if (caseItem) {
        setCaseItem({ ...caseItem, comment_count: caseItem.comment_count + 1 });
      }
    } catch {
      message.error('评论提交失败，请重试');
    } finally {
      setSubmittingComment(false);
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
          {caseItem.team && <Tag color="blue">{caseItem.team}</Tag>}
          {caseItem.business_scenario && <Tag color="cyan">{caseItem.business_scenario}</Tag>}
          {caseItem.ai_tools.map((tool) => (
            <Tag key={tool}>{tool}</Tag>
          ))}
          {caseItem.event_id && <Tag color="red">大赛作品</Tag>}
          {caseItem.is_featured && <Tag color="orange">精选</Tag>}
          {caseItem.status === 'rejected' && <Tag color="volcano">已下架</Tag>}
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
          {isAdmin && (
            <>
              <button onClick={handleToggleFeatured}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all hover:-translate-y-0.5"
                style={{ color: caseItem.is_featured ? '#F27F22' : 'var(--text-secondary)', border: '1px solid rgba(255, 255, 255, 0.6)', background: caseItem.is_featured ? 'rgba(242, 127, 34, 0.08)' : 'var(--surface)' }}>
                <StarFilled /> {caseItem.is_featured ? '取消精选' : '标为精选'}
              </button>
              {caseItem.status === 'rejected' ? (
                <button onClick={handleRestore}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all hover:-translate-y-0.5"
                  style={{ color: '#52c41a', border: '1px solid rgba(255, 255, 255, 0.6)', background: 'rgba(82, 196, 26, 0.08)' }}>
                  <UndoOutlined /> 恢复上架
                </button>
              ) : (
                <button onClick={handleTakedown}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all hover:-translate-y-0.5"
                  style={{ color: '#ff4d4f', border: '1px solid rgba(255, 255, 255, 0.6)', background: 'rgba(255, 77, 79, 0.08)' }}>
                  <StopOutlined /> 下架
                </button>
              )}
            </>
          )}
        </div>
      </article>

      {/* Comments */}
      <div className="glass rounded-2xl p-6 sm:p-8" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <h2 className="text-lg font-semibold mb-5 flex items-center gap-2">
          <BookOutlined style={{ color: 'var(--primary)' }} />
          评论 ({comments.length})
        </h2>

        {user ? (
          <>
            <Input.TextArea
              rows={3}
              placeholder="写下你的评论..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              maxLength={1000}
              showCount
            />
            <div className="flex justify-end mt-3">
              <button className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: 'var(--primary)' }}
                onClick={handleComment}
                disabled={submittingComment || !commentText.trim()}>
                {submittingComment ? '提交中...' : '发表评论'}
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
            <Link href="/login" style={{ color: 'var(--primary)' }}>登录</Link> 后即可评论
          </div>
        )}

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

      {/* Related Cases */}
      {relatedCases.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BookOutlined style={{ color: 'var(--primary)' }} />
            相关案例
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {relatedCases.map((rc) => (
              <Link key={rc.id} href={`/cases/${rc.id}`} className="block group">
                <div className="glass rounded-[20px] p-5 transition-all duration-300 hover:-translate-y-1"
                  style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
                  <Tag color={CATEGORY_COLORS[rc.category as keyof typeof CATEGORY_COLORS]} className="mb-2">{rc.category}</Tag>
                  <h3 className="text-sm font-semibold mb-2 line-clamp-2 group-hover:opacity-80 transition-opacity">
                    {rc.title}
                  </h3>
                  <p className="text-xs line-clamp-2 mb-3" style={{ color: 'var(--text-secondary)' }}>{rc.summary}</p>
                  <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span><EyeOutlined /> {rc.view_count}</span>
                    <span><LikeOutlined /> {rc.like_count}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
