'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Tag, Select, Input, Spin } from 'antd';
import { ReadOutlined, UserOutlined, StarFilled } from '@ant-design/icons';
import { getSupabase } from '@/lib/supabase';
import { COURSE_DIFFICULTY_COLORS, COURSE_CATEGORY_OPTIONS, DIFFICULTY_OPTIONS, CONTENT_TYPE_OPTIONS } from '@/lib/constants';
import type { Course, CourseCategory, CourseDifficulty, ContentType } from '@/types';

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState<CourseCategory | ''>('');
  const [difficulty, setDifficulty] = useState<CourseDifficulty | ''>('');
  const [contentType, setContentType] = useState<ContentType | ''>('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      let query = getSupabase()
        .from('courses')
        .select('*, chapters:course_chapters(*)')
        .order('created_at', { ascending: false });

      if (debouncedSearch) query = query.or(`title.ilike.%${debouncedSearch}%`);
      if (category) query = query.eq('category', category);
      if (difficulty) query = query.eq('difficulty', difficulty);
      if (contentType) query = query.eq('content_type', contentType);

      const { data, error } = await query;
      if (error) throw error;
      setCourses((data ?? []) as Course[]);
    } catch (err) {
      console.error('Failed to fetch courses:', err);
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, category, difficulty, contentType]);

  useEffect(() => { fetchCourses(); }, [fetchCourses]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg flex items-center justify-center text-base" style={{ background: 'rgba(74, 111, 165, 0.08)', color: '#4a6fa5' }}>
            <ReadOutlined />
          </span>
          AI 公开课
        </h1>
        <p className="text-sm mt-1 ml-12" style={{ color: 'var(--text-muted)' }}>系统化学习 AI 知识与技能</p>
      </div>

      {/* Filters */}
      <div className="glass rounded-xl p-4 mb-6" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <div className="flex flex-wrap gap-3 items-center">
          <Input.Search
            placeholder="搜索课程..."
            className="w-full sm:w-64"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
          />
          <Select
            placeholder="分类"
            className="w-full sm:w-36"
            value={category || undefined}
            onChange={(v) => setCategory(v || '')}
            allowClear
            options={COURSE_CATEGORY_OPTIONS}
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
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course) => (
            <Link key={course.id} href={`/courses/${course.id}`} className="block group">
              <div className="glass relative overflow-hidden rounded-[20px] p-5 h-full transition-all duration-300 hover:-translate-y-1"
                style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
                <div className="absolute top-0 left-0 w-full h-[3px] opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'var(--gradient-primary)' }} />
                <div className="flex items-center gap-2 mb-3">
                  <Tag color={course.content_type === 'video' ? 'red' : 'blue'}>
                    {course.content_type === 'video' ? '视频' : '文档'}
                  </Tag>
                  <Tag color={COURSE_DIFFICULTY_COLORS[course.difficulty]}>{course.difficulty}</Tag>
                  <Tag>{course.category}</Tag>
                </div>
                <h3 className="text-base font-semibold mb-2 line-clamp-2 group-hover:opacity-80 transition-opacity">
                  {course.title}
                </h3>
                <p className="text-sm mb-4 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{course.description}</p>
                <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span className="flex items-center gap-1">
                    <UserOutlined /> {course.instructor} · {course.duration}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="flex items-center gap-1" style={{ color: '#c4883a' }}>
                      <StarFilled /> {course.rating}
                    </span>
                    <span>{course.student_count} 人学习</span>
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
