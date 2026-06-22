'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Tag, Spin } from 'antd';
import {
  BookOutlined,
  BookFilled,
  TrophyOutlined,
  ReadOutlined,
  ArrowRightOutlined,
  LikeOutlined,
  LikeFilled,
  PlayCircleOutlined,
  TeamOutlined,
  UserOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  AppstoreOutlined,
  ApiOutlined,
  StarOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { Event, Course, Resource } from '@/types';
import { ZONGTENG_SKILLS_CATEGORY } from '@/types';

/* ─── Animated Counter ─── */
function AnimatedCounter({ target, duration = 2 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (target === 0) {
      const timer = window.setTimeout(() => setCount(0), 0);
      return () => window.clearTimeout(timer);
    }
    const el = ref.current;
    if (!el) {
      const timer = window.setTimeout(() => setCount(target), 0);
      return () => window.clearTimeout(timer);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const step = (now: number) => {
            const progress = Math.min((now - start) / (duration * 1000), 1);
            const eased = 1 - Math.pow(1 - progress, 4);
            setCount(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return <span ref={ref}>{count.toLocaleString()}</span>;
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
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [zongtengSkills, setZongtengSkills] = useState<Resource[]>([]);
  const [stats, setStats] = useState({ users: 0, courses: 0, apps: 0 });
  const [dashboard, setDashboard] = useState({ totalMonthlySavedHours: 0, totalPeople: 0, landedCount: 0 });
  const [loading, setLoading] = useState(true);
  const [courseInteractions, setCourseInteractions] = useState<Record<string, { liked: boolean; bookmarked: boolean }>>({});
  const [courseCounts, setCourseCounts] = useState<Record<string, { like_count: number; bookmark_count: number }>>({});
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [eventsRes, coursesRes, skillsRes, userCount, courseCount, appCount, dashboardRes] = await Promise.all([
          getSupabase().from('events').select('*').in('status', ['ongoing', 'upcoming']).order('start_time', { ascending: false }),
          getSupabase().from('courses').select('*').order('created_at', { ascending: false }).limit(6),
          getSupabase()
            .from('apps')
            .select('*, author:users!author_id(id, name, avatar)')
            .eq('status', 'published')
            .eq('category', ZONGTENG_SKILLS_CATEGORY)
            .order('created_at', { ascending: false })
            .limit(3),
          getSupabase().from('users').select('id', { count: 'exact', head: true }),
          getSupabase().from('courses').select('id', { count: 'exact', head: true }),
          getSupabase().from('apps').select('id', { count: 'exact', head: true }).eq('status', 'published'),
          fetch('/api/dashboard-summary').then(r => r.json()).catch(() => ({ totalMonthlySavedHours: 0, totalPeople: 0, landedCount: 0 })),
        ]);

        setEvents((eventsRes.data ?? []) as Event[]);
        setCourses((coursesRes.data ?? []) as Course[]);
        setZongtengSkills((skillsRes.data ?? []) as Resource[]);

        setStats({
          users: userCount.count || 0,
          courses: courseCount.count || 0,
          apps: appCount.count || 0,
        });
        setDashboard({
          totalMonthlySavedHours: dashboardRes.totalMonthlySavedHours || 0,
          totalPeople: dashboardRes.totalPeople || 0,
          landedCount: dashboardRes.landedCount || 0,
        });
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Fetch course interactions and counts
  useEffect(() => {
    if (courses.length === 0) return;
    const fetchCourseData = async () => {
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
      setCourseInteractions(interactionResults);
      setCourseCounts(countResults);
    };
    fetchCourseData();
  }, [courses, user]);

  const toggleCourseInteraction = async (courseId: string, action: 'like' | 'bookmark') => {
    if (!user) return;
    try {
      const res = await fetch('/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, target_type: 'course', target_id: courseId }),
      });
      if (res.ok) {
        const { active } = await res.json();
        setCourseInteractions((prev) => ({
          ...prev,
          [courseId]: { ...prev[courseId], [action === 'like' ? 'liked' : 'bookmarked']: active },
        }));
        const countRes = await fetch(`/api/interactions?target_type=course&target_id=${courseId}&action=count`);
        if (countRes.ok) {
          const countData = await countRes.json();
          setCourseCounts((prev) => ({
            ...prev,
            [courseId]: { like_count: countData.like_count ?? 0, bookmark_count: countData.bookmark_count ?? 0 },
          }));
        }
      }
    } catch {}
  };

  const ongoingEvents = events.filter((e) => e.status === 'ongoing');

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="px-[100px]">

      {/* Hero Section — Centered */}
      <section className="pt-10 pb-8 animate-fade-up">
        <div className="text-center max-w-2xl mx-auto">
          <div className="glass inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium mb-5"
            style={{ color: 'var(--primary)' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#22c55e', animation: 'pulse 2s infinite' }} />
            HRAS AI Land
          </div>
          <h1 className="text-4xl sm:text-[52px] font-extrabold mb-4 leading-[1.15] tracking-tight">
            让 AI 在 HR 圈<br />
            <span className="shimmer-text">真正用起来</span>
          </h1>
          <p className="text-[17px] mb-8" style={{ color: 'var(--text-secondary)' }}>
            案例沉淀、知识学习、活动运营，<br />HRAS 全员的 AI 园地
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <a href="https://ztn.feishu.cn/share/base/form/shrcnPYqHe7ySrBxA9DbXijzhUb" target="_blank" rel="noopener noreferrer">
              <button className="btn-gradient">
                <StarOutlined /> AI许愿
              </button>
            </a>
            <a href="https://ztn.feishu.cn/share/base/form/shrcnVgQV6C0ZAh3nZX6htenC5c" target="_blank" rel="noopener noreferrer">
              <button className="btn-gradient">
                <TrophyOutlined /> 参加大赛
              </button>
            </a>
            <Link href="/resources/apps/create">
              <button className="pill-btn">
                <ApiOutlined /> 分享工具
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Metrics Strip */}
      <section className="mb-8">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { label: '月均节省总工时', value: dashboard.totalMonthlySavedHours, unit: 'h', icon: <ClockCircleOutlined />, color: '#1a3a8a', href: '' },
            { label: '覆盖人数', value: dashboard.totalPeople, unit: '人', icon: <TeamOutlined />, color: '#2d5bc7', href: '' },
            { label: '已落地场景数', value: dashboard.landedCount, unit: '个', icon: <StarOutlined />, color: '#22c55e', href: '/wish-pool?tab=landed' },
            { label: '课程数', value: stats.courses, unit: '门', icon: <ReadOutlined />, color: '#e8650a', href: '/resources?tab=courses' },
            { label: '工具数', value: stats.apps, unit: '个', icon: <AppstoreOutlined />, color: '#7850a0', href: '/resources?tab=apps' },
          ].map((item) => {
            const card = (
              <div key={item.label} className={`glass rounded-[20px] p-4 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-md ${item.href ? 'cursor-pointer' : 'cursor-default'}`}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2.5 text-lg"
                  style={{ background: `${item.color}15`, color: item.color }}>
                  {item.icon}
                </div>
                <div className="text-2xl font-bold mb-0.5" style={{ color: 'var(--foreground)' }}>
                  <AnimatedCounter target={item.value} />
                  <span className="text-sm font-normal ml-0.5" style={{ color: 'var(--text-muted)' }}>{item.unit}</span>
                </div>
                <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{item.label}</div>
              </div>
            );
            return item.href
              ? <Link key={item.label} href={item.href} className="block group">{card}</Link>
              : <div key={item.label}>{card}</div>;
          })}
        </div>
      </section>


      {/* Zongteng Skills */}
      <section className="mb-10">
        <SectionHeader icon={<ApiOutlined />} title="纵腾人专属 Skills" href="/resources?tab=apps" iconBg="rgba(242, 127, 34, 0.1)" iconColor="#F27F22" linkText="进入专区" />
        <div
          className="glass relative overflow-hidden rounded-[20px] p-5"
          style={{
            borderColor: 'rgba(242, 127, 34, 0.32)',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.74), rgba(255,244,232,0.76))',
          }}
        >
          <div className="absolute inset-x-0 top-0 h-1" style={{ background: 'linear-gradient(90deg, var(--primary), var(--accent))' }} />
          {zongtengSkills.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {zongtengSkills.map((skill) => (
                <div key={skill.id} className="rounded-2xl p-4 transition-all duration-300 hover:-translate-y-1"
                  style={{ background: 'rgba(255,255,255,0.62)', border: '1px solid rgba(255,255,255,0.7)' }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold overflow-hidden"
                      style={{ background: 'rgba(242, 127, 34, 0.11)', color: 'var(--accent)' }}>
                      {skill.logo ? (
                        <img src={skill.logo} alt={skill.name} className="w-full h-full object-cover" />
                      ) : (
                        skill.name[0]
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold line-clamp-1">{skill.name}</h3>
                      {skill.author?.name && (
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{skill.author.name}</p>
                      )}
                    </div>
                  </div>
                  <p className="text-sm line-clamp-2 mb-3" style={{ color: 'var(--text-secondary)' }}>{skill.description}</p>
                  {skill.official_url && (
                    <a href={skill.official_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold hover:underline"
                      style={{ color: 'var(--primary)' }}>
                      打开指南 <LinkOutlined />
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold mb-1">第一批内部 Skills 正在收集中</h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  投稿审核通过后，这里会优先展示纵腾同学沉淀的专属业务 Skills。
                </p>
              </div>
              <Link href="/resources/apps/create">
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:-translate-y-0.5"
                  style={{ background: 'linear-gradient(135deg, #F27F22, #e8650a)', boxShadow: '0 4px 15px rgba(242,127,34,0.28)' }}>
                  <ApiOutlined /> 投稿 Skills
                </button>
              </Link>
            </div>
          )}
        </div>
      </section>

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

      {/* Recommended Courses */}
      {courses.length > 0 && (
        <section className="mb-10">
          <SectionHeader icon={<ReadOutlined />} title="推荐课程" href="/resources?tab=courses" iconBg="rgba(232, 101, 10, 0.1)" iconColor="#e8650a" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((course) => (
              <div key={course.id} className="glass relative overflow-hidden rounded-[20px] p-5 h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-md group"
                style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
                <div className="absolute top-0 left-0 w-full h-[3px] opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'var(--gradient-primary)' }} />
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  {course.period && <Tag color="cyan">{course.period}</Tag>}
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
                  <div className="flex flex-wrap gap-2 mb-2">
                    {course.courseware_url && (
                      <a href={course.courseware_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:-translate-y-0.5"
                        style={{ background: 'linear-gradient(135deg, #1a3a8a, #4a6fc7)', color: '#fff', boxShadow: '0 2px 8px rgba(26,58,138,0.25)' }}>
                        <BookOutlined /> 课件
                      </a>
                    )}
                    {course.video_url && (
                      <a href={course.video_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:-translate-y-0.5"
                        style={{ background: 'linear-gradient(135deg, #F27F22, #e8650a)', color: '#fff', boxShadow: '0 2px 8px rgba(242,127,34,0.25)' }}>
                        <PlayCircleOutlined /> 视频
                      </a>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <UserOutlined /> {course.instructor}
                    </span>
                    <span className="flex items-center gap-1">
                      <CalendarOutlined /> {new Date(course.created_at).toLocaleDateString('zh-CN')}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="flex items-center gap-1 cursor-pointer transition-colors hover:text-red-500"
                      style={{ color: courseInteractions[course.id]?.liked ? '#e74c3c' : undefined }}
                      onClick={() => toggleCourseInteraction(course.id, 'like')}>
                      {courseInteractions[course.id]?.liked ? <LikeFilled /> : <LikeOutlined />} {courseCounts[course.id]?.like_count ?? 0}
                    </span>
                    <span className="flex items-center gap-1 cursor-pointer transition-colors hover:text-yellow-500"
                      style={{ color: courseInteractions[course.id]?.bookmarked ? '#f59e0b' : undefined }}
                      onClick={() => toggleCourseInteraction(course.id, 'bookmark')}>
                      {courseInteractions[course.id]?.bookmarked ? <BookFilled /> : <BookOutlined />} {courseCounts[course.id]?.bookmark_count ?? 0}
                    </span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {courses.length === 0 && (
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
