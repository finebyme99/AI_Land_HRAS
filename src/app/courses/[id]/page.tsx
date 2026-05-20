'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { Tag, Spin } from 'antd';
import {
  ReadOutlined,
  ArrowLeftOutlined,
  PlayCircleOutlined,
  FileTextOutlined,
  StarFilled,
  UserOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { getSupabase } from '@/lib/supabase';
import { DIFFICULTY_COLORS } from '@/lib/constants';
import type { Course } from '@/types';

export default function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);

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
      } catch (err) {
        console.error('Failed to fetch course:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchCourse();
  }, [id]);

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
      <div className="rounded-2xl p-6 sm:p-8 mb-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Tag color={course.content_type === 'video' ? 'red' : 'blue'}>
            {course.content_type === 'video' ? '视频' : '文档'}
          </Tag>
          <Tag color={DIFFICULTY_COLORS[course.difficulty]}>{course.difficulty}</Tag>
          <Tag>{course.category}</Tag>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold mb-5 leading-tight" style={{ fontFamily: 'var(--font-serif)' }}>
          {course.title}
        </h1>

        <div className="flex flex-wrap items-center gap-5 mb-5 text-sm" style={{ color: 'var(--text-muted)' }}>
          <span className="flex items-center gap-1.5"><UserOutlined /> {course.instructor}</span>
          <span className="flex items-center gap-1.5"><ClockCircleOutlined /> {course.duration}</span>
          <span className="flex items-center gap-1.5" style={{ color: '#c4883a' }}><StarFilled /> {course.rating}</span>
          <span>{course.student_count} 人学习</span>
        </div>

        <p className="mb-6 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{course.description}</p>

        <div className="mb-6 p-4 rounded-lg" style={{ background: 'var(--background)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">学习进度</span>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>0%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border-light)' }}>
            <div className="h-full rounded-full" style={{ background: 'var(--primary)', width: '0%' }} />
          </div>
        </div>

        <button className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90"
          style={{ background: 'var(--primary)' }}>
          <PlayCircleOutlined /> 开始学习
        </button>
      </div>

      {/* Chapters */}
      {chapters.length > 0 && (
        <div className="rounded-2xl p-6 sm:p-8" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <h2 className="text-lg font-semibold mb-5" style={{ fontFamily: 'var(--font-serif)' }}>
            课程目录 ({chapters.length} 章)
          </h2>
          <div className="flex flex-col gap-3">
            {chapters.map((chapter, index) => (
              <div key={chapter.id} className="flex items-center gap-4 p-3 rounded-lg transition-all hover:-translate-y-0.5 cursor-pointer"
                style={{ border: '1px solid var(--border-light)', background: 'var(--surface-warm)' }}>
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0"
                  style={{ background: 'rgba(184, 92, 56, 0.08)', color: 'var(--primary)' }}>
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
    </div>
  );
}
