'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { Tag, Spin, App, Avatar, Input } from 'antd';
import {
  ReadOutlined,
  ArrowLeftOutlined,
  PlayCircleOutlined,
  FileTextOutlined,
  StarFilled,
  UserOutlined,
  ClockCircleOutlined,
  LikeOutlined,
  StarOutlined,
  ShareAltOutlined,
} from '@ant-design/icons';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { COURSE_DIFFICULTY_COLORS } from '@/lib/constants';
import type { Course } from '@/types';

export default function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, isAdmin } = useAuth();
  const { message } = App.useApp();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [comments, setComments] = useState<{ id: string; content: string; author: { name: string; avatar: string }; created_at: string }[]>([]);
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    async function fetchCourse() {
      setLoading(true);
      try {
        const { data, error } = await getSupabase()
          .from('courses')
          .select('*, chapters:course_chapters(*)')
          .eq('id', id)
          .single();
        if (error) throw error;
        setCourse(data as Course);

        // Increment view count
        getSupabase().rpc('increment_view_count', { table_name: 'courses', row_id: id });

        // Fetch comments
        const { data: commentData } = await getSupabase()
          .from('comments')
          .select('*, author:users!author_id(id, name, avatar)')
          .eq('target_type', 'course')
          .eq('target_id', id)
          .order('created_at', { ascending: false });
        setComments((commentData ?? []) as typeof comments);

        // Check if current user liked/bookmarked
        if (user) {
          const { data: likeData } = await getSupabase()
            .from('likes')
            .select('id')
            .eq('user_id', user.id)
            .eq('target_type', 'course')
            .eq('target_id', id)
            .maybeSingle();
          setLiked(!!likeData);

          const { data: bookmarkData } = await getSupabase()
            .from('bookmarks')
            .select('id')
            .eq('user_id', user.id)
            .eq('target_type', 'course')
            .eq('target_id', id)
            .maybeSingle();
          setBookmarked(!!bookmarkData);
        }
      } catch (err) {
        console.error('Failed to fetch course:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchCourse();
  }, [id, user]);

  const handleToggleFeatured = async () => {
    if (!course) return;
    const newVal = !course.is_featured;
    setCourse({ ...course, is_featured: newVal });
    await getSupabase().from('courses').update({ is_featured: newVal }).eq('id', id);
    message.success(newVal ? '已设为精选' : '已取消精选');
  };

  const handleLike = async () => {
    if (!course) return;
    if (!user) { message.warning('请先登录'); return; }
    if (liked) {
      setLiked(false);
      setCourse({ ...course, like_count: course.like_count - 1 });
      await getSupabase().from('likes').delete().eq('user_id', user.id).eq('target_type', 'course').eq('target_id', id);
      await getSupabase().from('courses').update({ like_count: course.like_count - 1 }).eq('id', id);
      message.success('已取消点赞');
    } else {
      setLiked(true);
      setCourse({ ...course, like_count: course.like_count + 1 });
      await getSupabase().from('likes').insert({ user_id: user.id, target_type: 'course', target_id: id });
      await getSupabase().from('courses').update({ like_count: course.like_count + 1 }).eq('id', id);
      message.success('点赞成功');
    }
  };

  const handleBookmark = async () => {
    if (!course) return;
    if (!user) { message.warning('请先登录'); return; }
    if (bookmarked) {
      setBookmarked(false);
      setCourse({ ...course, bookmark_count: course.bookmark_count - 1 });
      await getSupabase().from('bookmarks').delete().eq('user_id', user.id).eq('target_type', 'course').eq('target_id', id);
      await getSupabase().from('courses').update({ bookmark_count: course.bookmark_count - 1 }).eq('id', id);
      message.success('已取消收藏');
    } else {
      setBookmarked(true);
      setCourse({ ...course, bookmark_count: course.bookmark_count + 1 });
      await getSupabase().from('bookmarks').insert({ user_id: user.id, target_type: 'course', target_id: id });
      await getSupabase().from('courses').update({ bookmark_count: course.bookmark_count + 1 }).eq('id', id);
      message.success('收藏成功');
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    message.success('链接已复制');
  };

  const handleComment = async () => {
    if (!commentText.trim()) return;
    if (!user) { message.warning('请先登录'); return; }
    setSubmittingComment(true);
    try {
      const { error } = await getSupabase().from('comments').insert({
        target_type: 'course',
        target_id: id,
        content: commentText.trim(),
        author_id: user.id,
      });
      if (error) throw error;
      setCommentText('');
      message.success('评论已提交');
      const { data: commentData } = await getSupabase()
        .from('comments')
        .select('*, author:users!author_id(id, name, avatar)')
        .eq('target_type', 'course')
        .eq('target_id', id)
        .order('created_at', { ascending: false });
      setComments((commentData ?? []) as typeof comments);
      if (course) {
        const newCount = course.comment_count + 1;
        setCourse({ ...course, comment_count: newCount });
        await getSupabase().from('courses').update({ comment_count: newCount }).eq('id', id);
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

  if (!course) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <p style={{ color: 'var(--text-muted)' }}>课程不存在</p>
        <Link href="/courses" style={{ color: 'var(--primary)' }}>返回课程列表</Link>
      </div>
    );
  }

  const chapters = (course.chapters || []).sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <Link href="/courses" className="inline-flex items-center gap-1.5 text-sm mb-6 transition-opacity hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
        <ArrowLeftOutlined /> 返回课程列表
      </Link>

      {/* Course info */}
      <div className="glass rounded-2xl p-6 sm:p-8 mb-6" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Tag color={course.content_type === 'video' ? 'red' : 'blue'}>
            {course.content_type === 'video' ? '视频' : '文档'}
          </Tag>
          <Tag color={COURSE_DIFFICULTY_COLORS[course.difficulty]}>{course.difficulty}</Tag>
          <Tag>{course.category}</Tag>
          {course.is_featured && <Tag color="orange">精选</Tag>}
          {isAdmin && (
            <button onClick={handleToggleFeatured}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all hover:opacity-80"
              style={{ color: course.is_featured ? '#F27F22' : 'var(--text-muted)', background: course.is_featured ? 'rgba(242, 127, 34, 0.08)' : 'rgba(0,0,0,0.04)' }}>
              <StarFilled /> {course.is_featured ? '取消精选' : '标精选'}
            </button>
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold mb-5 leading-tight">
          {course.title}
        </h1>

        <div className="flex flex-wrap items-center gap-5 mb-5 text-sm" style={{ color: 'var(--text-muted)' }}>
          <span className="flex items-center gap-1.5"><UserOutlined /> {course.instructor}</span>
          <span className="flex items-center gap-1.5"><ClockCircleOutlined /> {course.duration}</span>
          <span className="flex items-center gap-1.5" style={{ color: '#c4883a' }}><StarFilled /> {course.rating}</span>
          <span>{course.student_count} 人学习</span>
        </div>

        <p className="mb-6 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{course.description}</p>

        <div className="mb-6 p-4 rounded-lg" style={{ background: 'rgba(255, 255, 255, 0.3)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">学习进度</span>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>0%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border-light)' }}>
            <div className="h-full rounded-full" style={{ background: 'var(--primary)', width: '0%' }} />
          </div>
        </div>

        <button className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90"
          style={{ background: 'var(--primary)' }}
          onClick={() => document.getElementById('course-chapters')?.scrollIntoView({ behavior: 'smooth' })}>
          <PlayCircleOutlined /> 开始学习
        </button>
      </div>

      {/* Chapters */}
      {chapters.length > 0 && (
        <div id="course-chapters" className="glass rounded-2xl p-6 sm:p-8" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
          <h2 className="text-lg font-semibold mb-5">
            课程目录 ({chapters.length} 章)
          </h2>
          <div className="flex flex-col gap-3">
            {chapters.map((chapter, index) => (
              <div key={chapter.id} className="flex items-center gap-4 p-3 rounded-lg transition-all hover:-translate-y-0.5 cursor-pointer"
                style={{ border: '1px solid var(--border-light)', background: 'var(--surface-warm)' }}>
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0"
                  style={{ background: 'rgba(26, 58, 138, 0.1)', color: 'var(--primary)' }}>
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{chapter.title}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{chapter.duration}</div>
                </div>
                <span style={{ color: 'var(--text-muted)' }}>
                  {course.content_type === 'video' ? <PlayCircleOutlined /> : <FileTextOutlined />}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons + Comments */}
      <div className="glass rounded-2xl p-6 sm:p-8 mt-6" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <div className="flex items-center gap-3 mb-6">
          <button onClick={handleLike}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all hover:-translate-y-0.5"
            style={{ color: liked ? 'var(--primary)' : 'var(--text-secondary)', border: '1px solid rgba(255, 255, 255, 0.6)', background: liked ? 'rgba(26, 58, 138, 0.06)' : 'var(--surface)' }}>
            <LikeOutlined /> 点赞 ({course.like_count})
          </button>
          <button onClick={handleBookmark}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all hover:-translate-y-0.5"
            style={{ color: bookmarked ? 'var(--primary)' : 'var(--text-secondary)', border: '1px solid rgba(255, 255, 255, 0.6)', background: bookmarked ? 'rgba(26, 58, 138, 0.06)' : 'var(--surface)' }}>
            <StarOutlined /> 收藏 ({course.bookmark_count})
          </button>
          <button onClick={handleShare}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all hover:-translate-y-0.5"
            style={{ color: 'var(--text-secondary)', border: '1px solid rgba(255, 255, 255, 0.6)', background: 'var(--surface)' }}>
            <ShareAltOutlined /> 分享
          </button>
        </div>

        <h2 className="text-lg font-semibold mb-5">评论 ({comments.length})</h2>

        {user ? (
          <>
            <Input.TextArea rows={3} placeholder="写下你的评论..." value={commentText} onChange={(e) => setCommentText(e.target.value)} maxLength={1000} showCount />
            <div className="flex justify-end mt-3">
              <button className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: 'var(--primary)' }} onClick={handleComment} disabled={submittingComment || !commentText.trim()}>
                {submittingComment ? '提交中...' : '发表评论'}
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-4 text-sm" style={{ color: 'var(--text-muted)' }}>登录后即可评论</div>
        )}

        {comments.length === 0 ? (
          <div className="mt-5 pt-5 text-center" style={{ borderTop: '1px solid var(--border-light)', color: 'var(--text-muted)' }}>
            <p className="text-sm">暂无评论</p>
          </div>
        ) : (
          <div className="mt-5 pt-5 flex flex-col gap-4" style={{ borderTop: '1px solid var(--border-light)' }}>
            {comments.map((c) => (
              <div key={c.id} className="flex gap-3">
                <Avatar size="small" src={c.author.avatar} icon={<UserOutlined />} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">{c.author.name}</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(c.created_at).toLocaleDateString('zh-CN')}</span>
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
