'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { Tag, Spin, App, Avatar, Input, Select, Form } from 'antd';
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
  LinkOutlined,
  BookOutlined,
  EditOutlined,
  SaveOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { COURSE_DIFFICULTY_COLORS, DIFFICULTY_OPTIONS } from '@/lib/constants';
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
  const [editing, setEditing] = useState(false);
  const [editForm] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchCourse() {
      setLoading(true);
      try {
        const { data, error } = await getSupabase()
          .from('courses')
          .select('*')
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

  const handleStartEdit = () => {
    if (!course) return;
    editForm.setFieldsValue({
      title: course.title,
      description: course.description,
      instructor: course.instructor,
      duration: course.duration,
      difficulty: course.difficulty,
      content_type: Array.isArray(course.content_type) ? course.content_type : [course.content_type],
      courseware_url: course.courseware_url || '',
      video_url: course.video_url || '',
    });
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!course) return;
    try {
      const values = await editForm.validateFields();
      setSaving(true);
      const res = await fetch(`/api/courses?id=${course.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '保存失败');
      }
      const { course: updated } = await res.json();
      setCourse(updated);
      setEditing(false);
      message.success('保存成功');
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return; // form validation
      message.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
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

  // Normalize content_type to array
  const contentTypes = Array.isArray(course.content_type) ? course.content_type : [course.content_type];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <Link href="/courses" className="inline-flex items-center gap-1.5 text-sm mb-6 transition-opacity hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
        <ArrowLeftOutlined /> 返回课程列表
      </Link>

      {/* Course info */}
      <div className="glass rounded-2xl p-6 sm:p-8 mb-6" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        {editing ? (
          <Form form={editForm} layout="vertical">
            <Form.Item name="title" label="课程标题" rules={[{ required: true }]}>
              <Input maxLength={100} showCount />
            </Form.Item>
            <Form.Item name="description" label="课程描述" rules={[{ required: true }]}>
              <Input.TextArea rows={3} maxLength={500} showCount />
            </Form.Item>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Form.Item name="instructor" label="讲师" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="duration" label="时长" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Form.Item name="difficulty" label="难度" rules={[{ required: true }]}>
                <Select options={DIFFICULTY_OPTIONS} />
              </Form.Item>
              <Form.Item name="content_type" label="内容形式" rules={[{ required: true }]}>
                <Select mode="multiple" options={[{ label: '视频', value: 'video' }, { label: '文档', value: 'doc' }]} />
              </Form.Item>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Form.Item name="courseware_url" label="课件链接">
                <Input placeholder="课件文档链接" />
              </Form.Item>
              <Form.Item name="video_url" label="视频链接">
                <Input placeholder="视频链接" />
              </Form.Item>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleSaveEdit} disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: 'var(--primary)' }}>
                <SaveOutlined /> {saving ? '保存中...' : '保存'}
              </button>
              <button onClick={() => setEditing(false)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-80"
                style={{ color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.6)' }}>
                <CloseOutlined /> 取消
              </button>
            </div>
          </Form>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {contentTypes.map((ct) => (
                <Tag key={ct} color={ct === 'video' ? 'red' : 'blue'}>
                  {ct === 'video' ? '视频' : '文档'}
                </Tag>
              ))}
              <Tag color={COURSE_DIFFICULTY_COLORS[course.difficulty]}>{course.difficulty}</Tag>
              {course.is_featured && <Tag color="orange">精选</Tag>}
              {isAdmin && (
                <>
                  <button onClick={handleToggleFeatured}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                    style={{ color: course.is_featured ? '#F27F22' : 'var(--text-muted)', background: course.is_featured ? 'rgba(242, 127, 34, 0.08)' : 'rgba(0,0,0,0.04)' }}>
                    <StarFilled /> {course.is_featured ? '取消精选' : '标精选'}
                  </button>
                  <button onClick={handleStartEdit}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                    style={{ color: 'var(--primary)', background: 'rgba(26, 58, 138, 0.06)' }}>
                    <EditOutlined /> 编辑
                  </button>
                </>
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
          </>
        )}
      </div>

      {/* Course Links */}
      {(course.courseware_url || course.video_url) && (
        <div className="glass rounded-2xl p-6 sm:p-8 mb-6" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
          <h2 className="text-lg font-semibold mb-5 flex items-center gap-2">
            <LinkOutlined style={{ color: 'var(--primary)' }} />
            课件与视频
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {course.courseware_url && (
              <a
                href={course.courseware_url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-4 p-4 rounded-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
                style={{ border: '1px solid var(--border-light)', background: 'rgba(255, 255, 255, 0.4)' }}
              >
                <span className="w-12 h-12 rounded-xl flex items-center justify-center text-lg flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
                  style={{ background: 'linear-gradient(135deg, #1a3a8a, #4a6fc7)', color: '#fff', boxShadow: '0 4px 15px rgba(26,58,138,0.3)' }}>
                  <BookOutlined />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold mb-0.5" style={{ color: 'var(--foreground)' }}>课件文档</div>
                  <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>点击查看课件</div>
                </div>
                <ArrowLeftOutlined className="rotate-180 transition-transform group-hover:translate-x-1" style={{ color: 'var(--text-muted)' }} />
              </a>
            )}
            {course.video_url && (
              <a
                href={course.video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-4 p-4 rounded-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
                style={{ border: '1px solid var(--border-light)', background: 'rgba(255, 255, 255, 0.4)' }}
              >
                <span className="w-12 h-12 rounded-xl flex items-center justify-center text-lg flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
                  style={{ background: 'linear-gradient(135deg, #F27F22, #e8650a)', color: '#fff', boxShadow: '0 4px 15px rgba(242,127,34,0.3)' }}>
                  <PlayCircleOutlined />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold mb-0.5" style={{ color: 'var(--foreground)' }}>教学视频</div>
                  <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>点击查看视频</div>
                </div>
                <ArrowLeftOutlined className="rotate-180 transition-transform group-hover:translate-x-1" style={{ color: 'var(--text-muted)' }} />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Action buttons + Comments */}
      <div className="glass rounded-2xl p-6 sm:p-8" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
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
