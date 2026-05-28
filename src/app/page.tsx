'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Tag, Spin } from 'antd';
import {
  BookOutlined,
  TrophyOutlined,
  ReadOutlined,
  ArrowRightOutlined,
  EyeOutlined,
  LikeOutlined,
  TeamOutlined,
  PlusOutlined,
  ClockCircleOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { CATEGORY_COLORS, COURSE_DIFFICULTY_COLORS } from '@/lib/constants';
import type { Case, Event, Course } from '@/types';

/* ─── Animated Counter ─── */
function AnimatedCounter({ target, duration = 2 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (target === 0) { setCount(0); return; }
    const el = ref.current;
    if (!el) { setCount(target); return; }

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

/* ─── Floating Particle ─── */
function FloatingParticle({ delay, x, size, color }: { delay: number; x: number; size: number; color?: string }) {
  return (
    <span
      className="absolute rounded-full pointer-events-none"
      style={{
        width: size,
        height: size,
        left: `${x}%`,
        bottom: '-10%',
        background: color || 'rgba(26, 58, 138, 0.18)',
        animation: `float-up 7s ${delay}s ease-in infinite`,
      }}
    />
  );
}

/* ─── 3D Orb (shader gradient sphere) ─── */
function Orb3D() {
  return (
    <div className="absolute -top-10 -right-10 w-40 h-40 pointer-events-none opacity-30"
      style={{
        background: 'radial-gradient(circle at 35% 35%, rgba(26,58,138,0.5), rgba(242,127,34,0.3) 50%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(1px)',
        animation: 'orb-float 8s ease-in-out infinite alternate',
      }} />
  );
}

/* ─── Data Dashboard Panel ─── */
function DataDashboard({ savedHours, participantCount }: { savedHours: number; participantCount: number }) {
  return (
    <div className="relative group/dashboard">
      {/* Breathing glow behind card */}
      <div className="absolute -inset-8 rounded-3xl pointer-events-none"
        style={{
          background: 'linear-gradient(135deg, rgba(26,58,138,0.25), rgba(242,127,34,0.15))',
          filter: 'blur(40px)',
          animation: 'breath 4s ease-in-out infinite',
        }} />

      <div className="relative glass-strong rounded-2xl p-6 sm:p-7 border overflow-hidden transition-all duration-500 group-hover/dashboard:shadow-2xl"
        style={{ borderColor: 'rgba(255,255,255,0.5)' }}>

        {/* 3D Orb */}
        <Orb3D />

        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <FloatingParticle delay={0} x={12} size={4} color="rgba(26,58,138,0.2)" />
          <FloatingParticle delay={1.2} x={35} size={3} color="rgba(242,127,34,0.18)" />
          <FloatingParticle delay={2.5} x={58} size={5} color="rgba(26,58,138,0.15)" />
          <FloatingParticle delay={3.8} x={80} size={3} color="rgba(242,127,34,0.2)" />
          <FloatingParticle delay={5} x={92} size={4} color="rgba(34,197,94,0.15)" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-2.5 mb-7 relative z-10">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center relative overflow-hidden"
            style={{ background: 'var(--gradient-primary)' }}>
            <RocketOutlined style={{ color: '#fff', fontSize: 14 }} />
          </span>
          <div>
            <div className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>HRAS AI 提效总览</div>
            <div className="text-[11px] flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
              <span className="w-1 h-1 rounded-full bg-green-500 inline-block" style={{ animation: 'pulse 2s infinite' }} />
              实时数据
            </div>
          </div>
        </div>

        {/* Metrics — big number cards */}
        <div className="space-y-5 relative z-10">
          {/* Saved Hours */}
          <div className="relative group rounded-xl p-5 transition-all duration-500 hover:scale-[1.03] hover:shadow-xl cursor-default"
            style={{ background: 'linear-gradient(135deg, rgba(26,58,138,0.06), rgba(26,58,138,0.02))' }}>
            {/* Hover gradient reveal */}
            <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{ background: 'linear-gradient(135deg, rgba(26,58,138,0.08), transparent)' }} />
            <div className="relative flex items-center gap-4">
              <span className="w-12 h-12 rounded-xl flex items-center justify-center text-lg flex-shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3"
                style={{ background: 'linear-gradient(135deg, #1a3a8a, #4a6fc7)', color: '#fff', boxShadow: '0 4px 20px rgba(26,58,138,0.35)' }}>
                <ClockCircleOutlined />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>累计节省工时</div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[32px] font-extrabold tracking-tight leading-none" style={{ color: 'var(--foreground)' }}>
                    <AnimatedCounter target={savedHours} duration={2.5} />
                  </span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--primary)', opacity: 0.7 }}>小时</span>
                </div>
              </div>
            </div>
          </div>

          {/* Participants — "参与人次" */}
          <div className="relative group rounded-xl p-5 transition-all duration-500 hover:scale-[1.03] hover:shadow-xl cursor-default"
            style={{ background: 'linear-gradient(135deg, rgba(242,127,34,0.06), rgba(242,127,34,0.02))' }}>
            <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{ background: 'linear-gradient(135deg, rgba(242,127,34,0.08), transparent)' }} />
            <div className="relative flex items-center gap-4">
              <span className="w-12 h-12 rounded-xl flex items-center justify-center text-lg flex-shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:-rotate-3"
                style={{ background: 'linear-gradient(135deg, #F27F22, #e8650a)', color: '#fff', boxShadow: '0 4px 20px rgba(242,127,34,0.35)' }}>
                <TeamOutlined />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>参与人次</div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[32px] font-extrabold tracking-tight leading-none" style={{ color: 'var(--foreground)' }}>
                    <AnimatedCounter target={participantCount} duration={2.5} />
                  </span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--accent)', opacity: 0.7 }}>人次</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="mt-5 pt-4 flex items-center justify-between relative z-10"
          style={{ borderTop: '1px solid rgba(255,255,255,0.4)' }}>
          <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
            让 AI 在 HR 圈真正用起来
          </span>
          <div className="flex gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--primary)', opacity: 0.7 }} />
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)', opacity: 0.7 }} />
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#22c55e', opacity: 0.7 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function CaseCard({ data }: { data: Case }) {
  return (
    <Link href={`/cases/${data.id}`} className="block group">
      <div className="glass rounded-[20px] p-5 h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-lg relative overflow-hidden"
        style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <div className="absolute top-0 left-0 w-full h-[3px] opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: 'var(--gradient-primary)' }} />
        <div className="flex items-start gap-2 mb-3">
          <Tag color={CATEGORY_COLORS[data.category]}>{data.category}</Tag>
          {data.is_featured && <Tag color="orange">精选</Tag>}
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
  const { isAdmin } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [stats, setStats] = useState({ cases: 0, users: 0, courses: 0 });
  const [dashboard, setDashboard] = useState({ savedHours: 0, participantCount: 0, awardCount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [casesRes, eventsRes, coursesRes, caseCount, userCount, courseCount, settingsRes] = await Promise.all([
          getSupabase().from('cases').select('*, author:users!author_id(id, name, avatar, department)').eq('status', 'published').order('view_count', { ascending: false }).limit(6),
          getSupabase().from('events').select('*').in('status', ['ongoing', 'upcoming']).order('start_time', { ascending: false }),
          getSupabase().from('courses').select('*').order('created_at', { ascending: false }).limit(6),
          getSupabase().from('cases').select('id', { count: 'exact', head: true }).eq('status', 'published'),
          getSupabase().from('users').select('id', { count: 'exact', head: true }),
          getSupabase().from('courses').select('id', { count: 'exact', head: true }),
          fetch('/api/admin/settings').then(r => r.json()).catch(() => ({ saved_hours: 0, participant_count: 0, award_count: 0 })),
        ]);

        setCases((casesRes.data ?? []) as Case[]);
        setEvents((eventsRes.data ?? []) as Event[]);
        setCourses((coursesRes.data ?? []) as Course[]);

        setStats({
          cases: caseCount.count || 0,
          users: userCount.count || 0,
          courses: courseCount.count || 0,
        });
        setDashboard({
          savedHours: settingsRes.saved_hours || 0,
          participantCount: settingsRes.participant_count || 0,
          awardCount: settingsRes.award_count || 0,
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
    { label: '大赛获奖', value: dashboard.awardCount, icon: <TrophyOutlined />, iconBg: 'rgba(242, 127, 34, 0.12)', iconColor: '#F27F22' },
    { label: '课程总数', value: stats.courses, icon: <ReadOutlined />, iconBg: 'rgba(232, 101, 10, 0.12)', iconColor: '#e8650a' },
    { label: '注册用户', value: stats.users, icon: <TeamOutlined />, iconBg: 'rgba(34, 197, 94, 0.12)', iconColor: '#22c55e' },
  ];

  return (
    <div className="max-w-[1100px] mx-auto px-6">
      {/* Hero Section — Two Column */}
      <section className="pt-10 pb-8 animate-fade-up">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8 items-center">
          {/* Left — Hero Text */}
          <div>
            <div className="glass inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium mb-5"
              style={{ color: 'var(--primary)' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#22c55e', animation: 'pulse 2s infinite' }} />
              HRAS AI Land
            </div>
            <h1 className="text-4xl sm:text-[52px] font-extrabold mb-4 leading-[1.15] tracking-tight">
              让 AI 在 HR 圈<br />
              <span className="shimmer-text">真正用起来</span>
            </h1>
            <p className="text-[17px] mb-8 max-w-md" style={{ color: 'var(--text-secondary)' }}>
              案例沉淀、知识学习、活动运营，<br />HRAS 全员的 AI 园地
            </p>
            <div className="flex flex-wrap gap-3">
              {isAdmin && (
                <Link href="/cases/create">
                  <button className="btn-gradient">
                    <PlusOutlined /> 提交案例
                  </button>
                </Link>
              )}
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
          </div>

          {/* Right — Data Dashboard */}
          <div className="hidden lg:block">
            <DataDashboard
              savedHours={dashboard.savedHours}
              participantCount={dashboard.participantCount}
            />
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="mb-6 -mt-2">
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
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    {(Array.isArray(course.content_type) ? course.content_type : [course.content_type]).map((ct) => (
                      <Tag key={ct} color={ct === 'video' ? 'red' : 'blue'}>
                        {ct === 'video' ? '视频' : '文档'}
                      </Tag>
                    ))}
                    <Tag color={COURSE_DIFFICULTY_COLORS[course.difficulty]}>{course.difficulty}</Tag>
                    {course.is_featured && <Tag color="orange">精选</Tag>}
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
      {cases.length === 0 && courses.length === 0 && (
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
