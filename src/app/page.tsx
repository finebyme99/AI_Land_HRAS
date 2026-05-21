'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, Tag, Button, Row, Col, Spin } from 'antd';
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
  AppstoreOutlined,
} from '@ant-design/icons';
import { getSupabase } from '@/lib/supabase';
import { CATEGORY_COLORS, COURSE_DIFFICULTY_COLORS } from '@/lib/constants';
import type { Case, Topic, Event, Course } from '@/types';

function CaseCard({ data }: { data: Case }) {
  return (
    <Link href={`/cases/${data.id}`} className="block group">
      <div className="rounded-xl p-5 h-full transition-all duration-300 hover:-translate-y-1"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
        <div className="flex items-start gap-2 mb-3">
          <Tag color={CATEGORY_COLORS[data.category]}>{data.category}</Tag>
        </div>
        <h3 className="text-base font-semibold mb-2 line-clamp-2 group-hover:opacity-80 transition-opacity" style={{ fontFamily: 'var(--font-serif)' }}>
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
      <div className="rounded-xl px-5 py-4 mb-3 transition-all duration-300 hover:-translate-y-0.5"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium mb-1.5 truncate group-hover:opacity-80 transition-opacity">{topic.title}</h4>
            <div className="flex items-center gap-1.5 flex-wrap">
              {topic.tags.slice(0, 3).map((tag) => (
                <Tag key={tag} className="text-xs">{tag}</Tag>
              ))}
            </div>
          </div>
          <div className="text-xs flex-shrink-0 ml-4 font-medium" style={{ color: 'var(--text-muted)' }}>
            {topic.answer_count} 回答
          </div>
        </div>
      </div>
    </Link>
  );
}

function SectionHeader({ icon, title, href, linkText = '查看全部' }: { icon: React.ReactNode; title: string; href: string; linkText?: string }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <h2 className="text-xl font-semibold flex items-center gap-2.5" style={{ fontFamily: 'var(--font-serif)' }}>
        <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: 'rgba(184, 92, 56, 0.08)', color: 'var(--primary)' }}>{icon}</span>
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
    { label: '案例总数', value: stats.cases, icon: <BookOutlined />, gradient: 'from-amber-50 to-orange-50', iconBg: 'rgba(184, 92, 56, 0.1)', iconColor: 'var(--primary)' },
    { label: '话题总数', value: stats.topics, icon: <CommentOutlined />, gradient: 'from-emerald-50 to-teal-50', iconBg: 'rgba(45, 90, 61, 0.1)', iconColor: 'var(--accent)' },
    { label: '注册用户', value: stats.users, icon: <TeamOutlined />, gradient: 'from-blue-50 to-indigo-50', iconBg: 'rgba(74, 111, 165, 0.1)', iconColor: '#4a6fa5' },
    { label: '课程总数', value: stats.courses, icon: <ReadOutlined />, gradient: 'from-purple-50 to-violet-50', iconBg: 'rgba(120, 80, 160, 0.1)', iconColor: '#7850a0' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Hero Section */}
      <section className="mb-10">
        <div className="rounded-2xl p-6 sm:p-10 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #2d1a0e 0%, #1a1612 50%, #0d1a12 100%)',
            minHeight: 200,
          }}
        >
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, var(--primary) 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
          <div className="absolute bottom-0 left-1/3 w-48 h-48 rounded-full opacity-5"
            style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)' }} />

          <div className="relative z-10">
            <p className="text-xs font-medium tracking-widest uppercase mb-3" style={{ color: 'var(--primary-light)', letterSpacing: '0.15em' }}>
              HRAS AI Land
            </p>
            <h1 className="text-2xl sm:text-4xl font-bold text-white mb-3 leading-tight" style={{ fontFamily: 'var(--font-serif)' }}>
              HRAS 全员的 AI 园地
            </h1>
            <p className="text-sm sm:text-base mb-6 max-w-lg" style={{ color: 'rgba(255,255,255,0.6)' }}>
              案例沉淀、知识学习、活动运营、话题互助 — 让 AI 在 HR 圈真正用起来
            </p>
            <div className="flex flex-wrap gap-2.5">
              <Link href="/cases">
                <button className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90"
                  style={{ background: 'var(--primary)' }}>
                  案例库
                </button>
              </Link>
              <Link href="/competitions">
                <button className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{ color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)' }}>
                  AI 大赛
                </button>
              </Link>
              <Link href="/courses">
                <button className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{ color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)' }}>
                  公开课
                </button>
              </Link>
              <Link href="/topics">
                <button className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{ color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)' }}>
                  问答话题
                </button>
              </Link>
              <Link href="/apps">
                <button className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{ color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)' }}>
                  应用推荐
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="mb-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {statItems.map((stat) => (
            <div key={stat.label} className="rounded-xl p-4 text-center transition-all duration-300 hover:-translate-y-0.5"
              style={{ background: 'var(--surface)', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-2.5 text-lg"
                style={{ background: stat.iconBg, color: stat.iconColor }}>
                {stat.icon}
              </div>
              <div className="text-2xl font-bold mb-0.5" style={{ fontFamily: 'var(--font-serif)', color: 'var(--foreground)' }}>{stat.value}</div>
              <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Quick Actions */}
      <section className="mb-10">
        <div className="flex gap-3 overflow-x-auto pb-2">
          <Link href="/topics/create">
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white whitespace-nowrap transition-all hover:opacity-90"
              style={{ background: 'var(--primary)' }}>
              <PlusOutlined /> 发起话题
            </button>
          </Link>
          <Link href="/cases">
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all hover:-translate-y-0.5"
              style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <BookOutlined /> 案例库
            </button>
          </Link>
          <Link href="/competitions">
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all hover:-translate-y-0.5"
              style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <TrophyOutlined /> AI 大赛
            </button>
          </Link>
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
          <SectionHeader icon={<TrophyOutlined />} title="进行中的活动" href="/competitions" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {ongoingEvents.map((event) => (
              <Link key={event.id} href={`/competitions/${event.id}`} className="block group">
                <div className="rounded-xl p-5 transition-all duration-300 hover:-translate-y-1"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                  <Tag color="red">进行中</Tag>
                  <h3 className="text-base font-semibold mt-3 mb-2 group-hover:opacity-80 transition-opacity" style={{ fontFamily: 'var(--font-serif)' }}>
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
          <SectionHeader icon={<CommentOutlined />} title="最新话题" href="/topics" />
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
          <SectionHeader icon={<ReadOutlined />} title="推荐课程" href="/courses" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((course) => (
              <Link key={course.id} href={`/courses/${course.id}`} className="block group">
                <div className="rounded-xl p-5 h-full transition-all duration-300 hover:-translate-y-1"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Tag color={course.content_type === 'video' ? 'red' : 'blue'}>
                      {course.content_type === 'video' ? '视频' : '文档'}
                    </Tag>
                    <Tag color={COURSE_DIFFICULTY_COLORS[course.difficulty]}>{course.difficulty}</Tag>
                  </div>
                  <h3 className="text-base font-semibold mb-2 line-clamp-2 group-hover:opacity-80 transition-opacity" style={{ fontFamily: 'var(--font-serif)' }}>
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
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl"
            style={{ background: 'rgba(184, 92, 56, 0.08)', color: 'var(--primary)' }}>
            <BookOutlined />
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ fontFamily: 'var(--font-serif)' }}>社区正在建设中</h3>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>内容即将上线，敬请期待</p>
        </div>
      )}
    </div>
  );
}
