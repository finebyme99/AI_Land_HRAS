'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Tag, Select, Spin, Modal, Form, Input, App, DatePicker } from 'antd';
import { ReadOutlined, UserOutlined, PlusOutlined, BookOutlined, PlayCircleOutlined, LikeFilled, LikeOutlined, BookFilled, EditOutlined, SyncOutlined } from '@ant-design/icons';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { CONTENT_TYPE_OPTIONS } from '@/lib/constants';
import SearchInput from '@/components/SearchInput';
import type { Course, ContentType } from '@/types';
import dayjs from 'dayjs';

export default function CoursesPage() {
  const { isAdmin, user } = useAuth();
  const { message } = App.useApp();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [contentType, setContentType] = useState<ContentType | ''>('');
  const [instructor, setInstructor] = useState('');
  const [interactions, setInteractions] = useState<Record<string, { liked: boolean; bookmarked: boolean }>>({});
  const [counts, setCounts] = useState<Record<string, { like_count: number; bookmark_count: number }>>({});

  // 编辑相关
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [editForm] = Form.useForm();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      let query = getSupabase()
        .from('courses')
        .select('*')
        .order('created_at', { ascending: false });

      if (debouncedSearch) query = query.or(`title.ilike.%${debouncedSearch}%`);
      if (contentType) query = query.contains('content_type', [contentType]);

      const { data, error } = await query;
      if (error) throw error;
      setCourses((data ?? []) as Course[]);
    } catch (err) {
      console.error('Failed to fetch courses:', err);
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, contentType]);

  useEffect(() => { fetchCourses(); }, [fetchCourses]);

  // Fetch interaction states and counts for all courses
  useEffect(() => {
    if (courses.length === 0) return;
    const fetchInteractions = async () => {
      const interactionResults: Record<string, { liked: boolean; bookmarked: boolean }> = {};
      const countResults: Record<string, { like_count: number; bookmark_count: number }> = {};
      await Promise.all(
        courses.map(async (course) => {
          try {
            const [stateRes, countRes] = await Promise.all([
              user ? fetch(`/api/interactions?target_type=course&target_id=${course.id}`) : null,
              fetch(`/api/interactions?target_type=course&target_id=${course.id}&action=count`),
            ]);
            if (stateRes?.ok) {
              const data = await stateRes.json();
              interactionResults[course.id] = { liked: data.liked, bookmarked: data.bookmarked };
            }
            if (countRes.ok) {
              const data = await countRes.json();
              countResults[course.id] = { like_count: data.like_count ?? 0, bookmark_count: data.bookmark_count ?? 0 };
            }
          } catch {}
        })
      );
      setInteractions(interactionResults);
      setCounts(countResults);
    };
    fetchInteractions();
  }, [courses, user]);

  const toggleInteraction = async (courseId: string, action: 'like' | 'bookmark') => {
    if (!user) return;
    try {
      const res = await fetch('/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, target_type: 'course', target_id: courseId }),
      });
      if (res.ok) {
        const { active } = await res.json();
        setInteractions((prev) => ({
          ...prev,
          [courseId]: { ...prev[courseId], [action === 'like' ? 'liked' : 'bookmarked']: active },
        }));
        // Refetch actual count from database
        const countRes = await fetch(`/api/interactions?target_type=course&target_id=${courseId}&action=count`);
        if (countRes.ok) {
          const countData = await countRes.json();
          setCounts((prev) => ({
            ...prev,
            [courseId]: { like_count: countData.like_count ?? 0, bookmark_count: countData.bookmark_count ?? 0 },
          }));
        }
      }
    } catch {}
  };

  // 编辑课程
  const openEdit = (course: Course) => {
    setEditing(course);
    editForm.setFieldsValue({
      title: course.title,
      description: course.description,
      instructor: course.instructor,
      duration: course.duration,
      difficulty: course.difficulty,
      published_at: dayjs(course.created_at),
      courseware_url: course.courseware_url || '',
      video_url: course.video_url || '',
    });
    setEditModalOpen(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const values = await editForm.validateFields();
      const res = await fetch(`/api/courses?id=${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          created_at: values.published_at ? values.published_at.startOf('day').toISOString() : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '保存失败');
      }
      message.success('已保存');
      setEditModalOpen(false);
      setEditing(null);
      fetchCourses();
    } catch (e) {
      if (e instanceof Error) message.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  // Client-side instructor filter + options
  const instructorOptions = [...new Set(courses.map((c) => c.instructor).filter(Boolean))]
    .sort()
    .map((name) => ({ label: name, value: name }));

  const displayCourses = instructor
    ? courses.filter((c) => c.instructor === instructor)
    : courses;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg flex items-center justify-center text-base" style={{ background: 'rgba(74, 111, 165, 0.08)', color: '#4a6fa5' }}>
              <ReadOutlined />
            </span>
            AI 公开课
            <span className="text-sm font-normal" style={{ color: 'var(--text-secondary)' }}>系统化学习 AI 知识与技能</span>
          </h1>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                setSyncing(true);
                try {
                  const res = await fetch('/api/courses/sync', { method: 'POST' });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || '同步失败');
                  message.success(`同步完成：新增 ${data.inserted} 条，更新 ${data.updated} 条`);
                  fetchCourses();
                } catch (e) {
                  message.error(e instanceof Error ? e.message : '同步失败');
                } finally {
                  setSyncing(false);
                }
              }}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all hover:opacity-90"
              style={{ background: 'rgba(26,58,138,0.06)', color: 'var(--primary)' }}
            >
              <SyncOutlined spin={syncing} /> {syncing ? '同步中...' : '同步课程'}
            </button>
            <Link href="/courses/create">
              <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90"
                style={{ background: 'var(--primary)' }}>
                <PlusOutlined /> 发布课程
              </button>
            </Link>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="glass rounded-xl p-4 mb-6" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <div className="flex flex-wrap gap-3 items-center">
          <SearchInput
            placeholder="搜索课程..."
            className="w-full sm:w-64"
            value={search}
            onChange={setSearch}
          />
          <Select
            placeholder="形式"
            className="w-full sm:w-28"
            value={contentType || undefined}
            onChange={(v) => setContentType(v || '')}
            allowClear
            options={CONTENT_TYPE_OPTIONS}
          />
          <Select
            placeholder="讲师"
            className="w-full sm:w-36"
            value={instructor || undefined}
            onChange={(v) => setInstructor(v || '')}
            allowClear
            showSearch
            optionFilterProp="label"
            options={instructorOptions}
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20"><Spin size="large" /></div>
      ) : courses.length === 0 ? (
        <div className="text-center py-16 glass rounded-[20px]" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
          <ReadOutlined className="text-3xl mb-3" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)' }}>暂无课程</p>
        </div>
      ) : displayCourses.length === 0 ? (
        <div className="text-center py-16 glass rounded-[20px]" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
          <ReadOutlined className="text-3xl mb-3" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)' }}>没有符合条件的课程</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayCourses.map((course) => (
            <div key={course.id} className="glass relative overflow-hidden rounded-[20px] p-5 h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-md group"
              style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
              <div className="absolute top-0 left-0 w-full h-[3px] opacity-0 hover:opacity-100 transition-opacity" style={{ background: 'var(--gradient-primary)' }} />
              {/* 管理员编辑按钮 */}
              {isAdmin && (
                <button
                  onClick={() => openEdit(course)}
                  className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 hover:opacity-100 transition-all"
                  style={{ background: 'rgba(255,255,255,0.8)', color: 'var(--text-secondary)' }}
                  title="编辑"
                >
                  <EditOutlined style={{ fontSize: 13 }} />
                </button>
              )}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {(Array.isArray(course.content_type) ? course.content_type : [course.content_type]).map((ct) => (
                  <Tag key={ct} color={ct === 'video' ? 'red' : 'blue'}>
                    {ct === 'video' ? '视频' : '文档'}
                  </Tag>
                ))}
                {course.is_featured && <Tag color="orange">精选</Tag>}
              </div>
              <h3 className="text-base font-semibold mb-2 line-clamp-2">
                {course.title}
              </h3>
              {(course.courseware_url || course.video_url) && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {course.courseware_url && (
                    <a
                      href={course.courseware_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:-translate-y-0.5"
                      style={{ background: 'linear-gradient(135deg, #1a3a8a, #4a6fc7)', color: '#fff', boxShadow: '0 2px 8px rgba(26,58,138,0.25)' }}
                    >
                      <BookOutlined /> 课件
                    </a>
                  )}
                  {course.video_url && (
                    <a
                      href={course.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:-translate-y-0.5"
                      style={{ background: 'linear-gradient(135deg, #F27F22, #e8650a)', color: '#fff', boxShadow: '0 2px 8px rgba(242,127,34,0.25)' }}
                    >
                      <PlayCircleOutlined /> 视频
                    </a>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                <span className="flex items-center gap-1">
                  <UserOutlined /> {course.instructor}
                </span>
                <span className="flex items-center gap-3">
                  <span
                    className="flex items-center gap-1 cursor-pointer transition-colors hover:text-red-500"
                    style={{ color: interactions[course.id]?.liked ? '#e74c3c' : undefined }}
                    onClick={() => toggleInteraction(course.id, 'like')}
                  >
                    {interactions[course.id]?.liked ? <LikeFilled /> : <LikeOutlined />} {counts[course.id]?.like_count ?? 0}
                  </span>
                  <span
                    className="flex items-center gap-1 cursor-pointer transition-colors hover:text-yellow-500"
                    style={{ color: interactions[course.id]?.bookmarked ? '#f59e0b' : undefined }}
                    onClick={() => toggleInteraction(course.id, 'bookmark')}
                  >
                    {interactions[course.id]?.bookmarked ? <BookFilled /> : <BookOutlined />} {counts[course.id]?.bookmark_count ?? 0}
                  </span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 编辑弹窗 */}
      <Modal
        title="编辑课程"
        open={editModalOpen}
        onCancel={() => { setEditModalOpen(false); setEditing(null); }}
        onOk={handleSave}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        width={600}
      >
        <Form form={editForm} layout="vertical" className="mt-4">
          <Form.Item name="title" label="课程标题" rules={[{ required: true, message: '请输入课程标题' }]}>
            <Input maxLength={100} showCount />
          </Form.Item>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="instructor" label="讲师" rules={[{ required: true, message: '请输入讲师' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="published_at" label="发布日期">
              <DatePicker className="w-full" />
            </Form.Item>
          </div>
          <Form.Item name="courseware_url" label="课件链接">
            <Input placeholder="飞书文档链接等" />
          </Form.Item>
          <Form.Item name="video_url" label="视频链接">
            <Input placeholder="飞书妙记链接等" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
