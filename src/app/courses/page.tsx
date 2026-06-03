'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Tag, Select, Spin } from 'antd';
import { ReadOutlined, UserOutlined, PlusOutlined, BookOutlined, PlayCircleOutlined, LikeFilled, LikeOutlined, BookFilled } from '@ant-design/icons';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { COURSE_DIFFICULTY_COLORS, DIFFICULTY_OPTIONS, CONTENT_TYPE_OPTIONS } from '@/lib/constants';
import SearchInput from '@/components/SearchInput';
import type { Course, CourseDifficulty, ContentType } from '@/types';

export default function CoursesPage() {
  const { isAdmin, user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [difficulty, setDifficulty] = useState<CourseDifficulty | ''>('');
  const [contentType, setContentType] = useState<ContentType | ''>('');
  const [instructor, setInstructor] = useState('');
  const [interactions, setInteractions] = useState<Record<string, { liked: boolean; bookmarked: boolean }>>({});
  const [counts, setCounts] = useState<Record<string, { like_count: number; bookmark_count: number }>>({});

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
      if (difficulty) query = query.eq('difficulty', difficulty);
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
  }, [debouncedSearch, difficulty, contentType]);

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
          </h1>
          <p className="text-sm mt-1 ml-12" style={{ color: 'var(--text-secondary)' }}>系统化学习 AI 知识与技能</p>
        </div>
        {isAdmin && (
          <Link href="/courses/create">
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90"
              style={{ background: 'var(--primary)' }}>
              <PlusOutlined /> 发布课程
            </button>
          </Link>
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
            placeholder="难度"
            className="w-full sm:w-28"
            value={difficulty || undefined}
            onChange={(v) => setDifficulty(v || '')}
            allowClear
            options={DIFFICULTY_OPTIONS}
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
            <div key={course.id} className="glass relative overflow-hidden rounded-[20px] p-5 h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
              style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
              <div className="absolute top-0 left-0 w-full h-[3px] opacity-0 hover:opacity-100 transition-opacity" style={{ background: 'var(--gradient-primary)' }} />
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {(Array.isArray(course.content_type) ? course.content_type : [course.content_type]).map((ct) => (
                  <Tag key={ct} color={ct === 'video' ? 'red' : 'blue'}>
                    {ct === 'video' ? '视频' : '文档'}
                  </Tag>
                ))}
                <Tag color={COURSE_DIFFICULTY_COLORS[course.difficulty]}>{course.difficulty}</Tag>
                {course.is_featured && <Tag color="orange">精选</Tag>}
              </div>
              <h3 className="text-base font-semibold mb-2 line-clamp-2">
                {course.title}
              </h3>
              <p className="text-sm mb-3 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{course.description}</p>
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
                  <UserOutlined /> {course.instructor} · {course.duration}
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
    </div>
  );
}
