'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { Tag, Spin, App } from 'antd';
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
import { useAuth } from '@/lib/auth-context';
import { COURSE_DIFFICULTY_COLORS } from '@/lib/constants';
import type { Course } from '@/types';

export default function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { isAdmin } = useAuth();
  const { message } = App.useApp();
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

  const handleToggleFeatured = async () => {
    if (!course) return;
    const newVal = !course.is_featured;
    setCourse({ ...course, is_featured: newVal });
    await getSupabase().from('courses').update({ is_featured: newVal }).eq('id', id);
    message.success(newVal ? '已设为精选' : '已取消精选');
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
    </div>
  );
}
