'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Tag, Spin } from 'antd';
import {
  BookOutlined,
  TrophyOutlined,
  CommentOutlined,
  ReadOutlined,
  ArrowRightOutlined,
  EyeOutlined,
  LikeOutlined,
  TeamOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { getSupabase } from '@/lib/supabase';
import { CATEGORY_COLORS, COURSE_DIFFICULTY_COLORS } from '@/lib/constants';
import type { Case, Topic, Event, Course } from '@/types';

function CaseCard({ data }: { data: Case }) {
  return (
    <Link href={`/cases/${data.id}`} className="block group">
      <div className="glass rounded-[20px] p-5 h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-lg relative overflow-hidden"
        style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <div className="absolute top-0 left-0 w-full h-[3px] opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: 'var(--gradient-primary)' }} />
        <div className="flex items-start gap-2 mb-3">
          <Tag color={CATEGORY_COLORS[data.category]}>{data.category}</Tag>
        </div>
        <h3 className="text-base font-semibold mb-2 line-clamp-2 group-hover:opacity-80 transition-opacity">
          {data.title}
        </h3>
        <p className="text-sm mb-4 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{data.summary}</p>
        <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
          <span>{data.author.name} · {data.author.department}</span>
          <span className="flex items-center gap-3">
            <span><EyeOutlined /> {data.view_count}</span>
            <span><LikeOutlined /> {data.like_count}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

function TopicCard({ topic }: { topic: Topic }) {
  return (
    <Link href={`/topics/${topic.id}`} className="block group">
      <div className="glass rounded-xl px-5 py-4 mb-3 transition-all duration-300 hover:-translate-y-0.5"
        style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium mb-1.5 truncate group-hover:opacity-80 transition-opacity">{topic.title}</h4>
            <div className="flex items-center gap-1.5 flex-wrap">
              {topic.tags.slice(0, 3).map((tag) => (
                <Tag key={tag} className="text-xs">{tag}</Tag>
              ))}
            </div>
          </div>
          <div className="text-xs flex-shrink-0 ml-4 font-medium px-3 py-1 rounded-full"
            style={{ color: 'var(--primary)', background: 'rgba(26, 58, 138, 0.06)' }}>
            {topic.answer_count} 回答
          </div>
        </div>
      </div>
    </Link>
  );
}

function SectionHeader({ icon, title, href, iconBg, iconColor, linkText = '查看全部' }: { icon: React.ReactNode; title: string; href: string; iconBg?: string; iconColor?: string; linkText?: string }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <h2 className="text-xl font-semibold flex items-center gap-2.5">
        <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
          style={{ background: iconBg || 'rgba(26, 58, 138, 0.1)', color: iconColor || 'var(--primary)' }}>{icon}</span>
        {title}
      </h2>
      <Link href={href} className="text-sm font-medium flex items-center gap-1 transition-opacity hover:opacity-70" style={{ color: 'var(--primary)' }}>
        {linkText} <ArrowRightOutlined style={{ fontSize: 12 }} />
      </Link>
    </div>
  );
}

export default function Home() {
  const [cases, setCases] = useState<Case[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [stats, setStats] = useState({ cases: 0, topics: 0, users: 0, courses: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [casesRes, topicsRes, eventsRes, coursesRes, caseCount, topicCount, userCount, courseCount] = await Promise.all([
          getSupabase().from('cases').select('*, author:users!author_id(id, name, avatar, department)').eq('status', 'published').order('view_count', { ascending: false }).limit(6),
          getSupabase().from('topics').select('*, author:users!author_id(id, name, avatar, department)').order('created_at', { ascending: false }).limit(6),
          getSupabase().from('events').select('*').in('status', ['ongoing', 'upcoming']).order('start_time', { ascending: false }),
          getSupabase().from('courses').select('*, chapters:course_chapters(*)').order('created_at', { ascending: false }).limit(6),
          getSupabase().from('cases').select('id', { count: 'exact', head: true }).eq('status', 'published'),
          getSupabase().from('topics').select('id', { count: 'exact', head: true }),
          getSupabase().from('users').select('id', { count: 'exact', head: true }),
          getSupabase().from('courses').select('id', { count: 'exact', head: true }),
        ]);

        setCases((casesRes.data ?? []) as Case[]);
        setTopics((topicsRes.data ?? []) as Topic[]);
        setEvents((eventsRes.data ?? []) as Event[]);
        setCourses((coursesRes.data ?? []) as Course[]);
        setStats({
          cases: caseCount.count || 0,
          topics: topicCount.count || 0,
          users: userCount.count || 0,
          courses: courseCount.count || 0,
        });
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const ongoingEvents = events.filter((e) => e.status === 'ongoing');

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Spin size="large" />
      </div>
    );
  }

  const statItems = [
    { label: '案例总数', value: stats.cases, icon: <BookOutlined />, iconBg: 'rgba(26, 58, 138, 0.12)', iconColor: '#1a3a8a' },
    { label: '话题总数', value: stats.topics, icon: <CommentOutlined />, iconBg: 'rgba(242, 127, 34, 0.12)', iconColor: '#F27F22' },
    { label: '注册用户', value: stats.users, icon: <TeamOutlined />, iconBg: 'rgba(34, 197, 94, 0.12)', iconColor: '#22c55e' },
    { label: '课程总数', value: stats.courses, icon: <ReadOutlined />, iconBg: 'rgba(232, 101, 10, 0.12)', iconColor: '#e8650a' },
  ];

  return (
    <div className="max-w-[1100px] mx-auto px-6">
      {/* Hero Section */}
      <section className="pt-10 pb-6 text-center animate-fade-up">
        <div className="glass inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium mb-5"
          style={{ color: 'var(--primary)' }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#22c55e', animation: 'pulse 2s infinite' }} />
          HRAS AI Land
        </div>
        <h1 className="text-4xl sm:text-[56px] font-extrabold mb-4 leading-[1.15] tracking-tight">
          让 AI 在 HR 圈<br />
          <span className="shimmer-text">真正用起来</span>
        </h1>
        <p className="text-[17px] mb-8 max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
          案例沉淀、知识学习、活动运营、话题互助，<br />HRAS 全员的 AI 园地
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link href="/topics/create">
            <button className="btn-gradient">
              <PlusOutlined /> 发起话题
            </button>
          </Link>
          <Link href="/cases">
            <button className="pill-btn">案例库</button>
          </Link>
          <Link href="/competitions">
            <button className="pill-btn">AI 大赛</button>
          </Link>
          <Link href="/courses">
            <button className="pill-btn">公开课</button>
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="mb-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {statItems.map((stat) => (
            <div key={stat.label} className="glass rounded-[20px] p-4 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2.5 text-lg"
                style={{ background: stat.iconBg, color: stat.iconColor }}>
                {stat.icon}
              </div>
              <div className="text-2xl font-bold mb-0.5" style={{ color: 'var(--foreground)' }}>{stat.value}</div>
              <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Hot Cases */}
      {cases.length > 0 && (
        <section className="mb-10">
          <SectionHeader icon={<BookOutlined />} title="热门案例" href="/cases" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cases.map((c) => (
              <CaseCard key={c.id} data={c} />
            ))}
          </div>
        </section>
      )}

      {/* Ongoing Events */}
      {ongoingEvents.length > 0 && (
        <section className="mb-10">
          <SectionHeader icon={<TrophyOutlined />} title="进行中的活动" href="/competitions" iconBg="rgba(242, 127, 34, 0.1)" iconColor="#F27F22" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {ongoingEvents.map((event) => (
              <Link key={event.id} href={`/competitions/${event.id}`} className="block group">
                <div className="glass rounded-[20px] p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-md relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-[3px] opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: 'var(--gradient-primary)' }} />
                  <Tag color="red">进行中</Tag>
                  <h3 className="text-base font-semibold mt-3 mb-2 group-hover:opacity-80 transition-opacity">
                    {event.title}
                  </h3>
                  <p className="text-sm mb-4 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{event.description}</p>
                  <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span>已报名 {event.registration_count} 人</span>
                    <span>截止 {new Date(event.end_time).toLocaleDateString('zh-CN')}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Latest Topics */}
      {topics.length > 0 && (
        <section className="mb-10">
          <SectionHeader icon={<CommentOutlined />} title="最新话题" href="/topics" iconBg="rgba(242, 127, 34, 0.1)" iconColor="#F27F22" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {topics.map((topic) => (
              <TopicCard key={topic.id} topic={topic} />
            ))}
          </div>
        </section>
      )}

      {/* Recommended Courses */}
      {courses.length > 0 && (
        <section className="mb-10">
          <SectionHeader icon={<ReadOutlined />} title="推荐课程" href="/courses" iconBg="rgba(232, 101, 10, 0.1)" iconColor="#e8650a" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((course) => (
              <Link key={course.id} href={`/courses/${course.id}`} className="block group">
                <div className="glass rounded-[20px] p-5 h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-md relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-[3px] opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: 'var(--gradient-primary)' }} />
                  <div className="flex items-center gap-2 mb-3">
                    <Tag color={course.content_type === 'video' ? 'red' : 'blue'}>
                      {course.content_type === 'video' ? '视频' : '文档'}
                    </Tag>
                    <Tag color={COURSE_DIFFICULTY_COLORS[course.difficulty]}>{course.difficulty}</Tag>
                  </div>
                  <h3 className="text-base font-semibold mb-2 line-clamp-2 group-hover:opacity-80 transition-opacity">
                    {course.title}
                  </h3>
                  <p className="text-sm mb-4 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{course.description}</p>
                  <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span>{course.instructor} · {course.duration}</span>
                    <span>{course.student_count} 人学习</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {cases.length === 0 && topics.length === 0 && courses.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl glass">
            <BookOutlined style={{ color: 'var(--primary)' }} />
          </div>
          <h3 className="text-lg font-semibold mb-2">社区正在建设中</h3>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>内容即将上线，敬请期待</p>
        </div>
      )}
    </div>
  );
}
