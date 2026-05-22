'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Tag, Spin } from 'antd';
import {
  TrophyOutlined,
  RocketOutlined,
  HeartOutlined,
  CalendarOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  PlusOutlined,
  StarOutlined,
} from '@ant-design/icons';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { Event } from '@/types';

/* ─── Animated Counter ─── */
function AnimatedCounter({ target, duration = 2 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useState<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (target === 0) { setCount(0); return; }
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setCount(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);

  return <span ref={ref[1]}>{count.toLocaleString()}</span>;
}

export default function CompetitionsPage() {
  const { isAdmin } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEvents() {
      setLoading(true);
      try {
        const { data, error } = await getSupabase()
          .from('events')
          .select('*')
          .order('start_time', { ascending: false });
        if (error) throw error;
        setEvents((data ?? []) as Event[]);
      } catch (err) {
        console.error('Failed to fetch events:', err);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    }
    fetchEvents();
  }, []);

  const ongoingEvents = events.filter((e) => e.status === 'ongoing');
  const upcomingEvents = events.filter((e) => e.status === 'upcoming');
  const currentEvent = ongoingEvents[0] || upcomingEvents[0];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Hero Banner */}
      <section className="mb-8 animate-fade-up">
        <div className="relative overflow-hidden rounded-2xl p-6 sm:p-8"
          style={{
            background: 'linear-gradient(135deg, rgba(26,58,138,0.95), rgba(26,58,138,0.8) 50%, rgba(242,127,34,0.8))',
            boxShadow: '0 8px 32px rgba(26,58,138,0.3)',
          }}>
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.8), transparent)', transform: 'translate(30%, -30%)' }} />
          <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, rgba(242,127,34,0.8), transparent)', transform: 'translate(-30%, 30%)' }} />

          <div className="relative z-10">
            {/* Status badge */}
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-green-400" style={{ animation: 'pulse 2s infinite' }} />
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-white"
                style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)' }}>
                <TrophyOutlined /> 5 月大赛进行中
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">
              HRAS AI 实践大赛
            </h1>
            <p className="text-sm sm:text-base text-white/80 mb-6 max-w-xl">
              展示你的 AI 实践成果，与全集团 HR 分享创新经验
            </p>

            {/* Stats row */}
            {currentEvent && (
              <div className="flex flex-wrap gap-4 mb-6">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-white/90 text-sm"
                  style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)' }}>
                  <CalendarOutlined />
                  <span>{new Date(currentEvent.start_time).toLocaleDateString('zh-CN')} — {new Date(currentEvent.end_time).toLocaleDateString('zh-CN')}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-white/90 text-sm"
                  style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)' }}>
                  <TeamOutlined />
                  <span>已报名 <AnimatedCounter target={currentEvent.registration_count} /> 人</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-white/90 text-sm"
                  style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)' }}>
                  <ClockCircleOutlined />
                  <span>报名截止 {new Date(currentEvent.registration_deadline).toLocaleDateString('zh-CN')}</span>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3">
              <Link href={currentEvent ? `/competitions/${currentEvent.id}` : '#'}>
                <button className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all hover:scale-105 hover:shadow-lg"
                  style={{ background: '#fff', color: 'var(--primary)' }}>
                  <RocketOutlined /> 提报参赛
                </button>
              </Link>
              <button className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all hover:scale-105 hover:shadow-lg"
                style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.3)' }}
                onClick={() => {
                  const el = document.getElementById('competition-details');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}>
                <HeartOutlined /> 许愿
              </button>
              <button className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all hover:scale-105 hover:shadow-lg"
                style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.3)' }}
                onClick={() => {
                  const el = document.getElementById('competition-schedule');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}>
                <CalendarOutlined /> 赛事时间安排
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Schedule */}
      {currentEvent && (
        <section id="competition-schedule" className="mb-8">
          <div className="glass rounded-2xl p-6 sm:p-8" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
            <h2 className="text-lg font-semibold mb-5 flex items-center gap-2">
              <CalendarOutlined style={{ color: 'var(--primary)' }} />
              赛事时间安排
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl text-center" style={{ background: 'rgba(26, 58, 138, 0.06)' }}>
                <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>报名开始</div>
                <div className="text-base font-bold" style={{ color: 'var(--foreground)' }}>
                  {new Date(currentEvent.start_time).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
                </div>
              </div>
              <div className="p-4 rounded-xl text-center" style={{ background: 'rgba(242, 127, 34, 0.06)' }}>
                <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>报名截止</div>
                <div className="text-base font-bold" style={{ color: 'var(--foreground)' }}>
                  {new Date(currentEvent.registration_deadline).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
                </div>
              </div>
              <div className="p-4 rounded-xl text-center" style={{ background: 'rgba(34, 197, 94, 0.06)' }}>
                <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>大赛结束</div>
                <div className="text-base font-bold" style={{ color: 'var(--foreground)' }}>
                  {new Date(currentEvent.end_time).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Embedded static page */}
      <section id="competition-details" className="mb-8">
        <div className="glass rounded-2xl overflow-hidden" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
          <iframe
            src="https://finebyme99.github.io/hras-2026/"
            className="w-full border-0"
            style={{ minHeight: '80vh' }}
            title="HRAS 2026 AI 大赛详情"
            loading="lazy"
          />
        </div>
      </section>

      {/* All events list */}
      {events.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-5 flex items-center gap-2">
            <TrophyOutlined style={{ color: 'var(--primary)' }} />
            全部赛事
          </h2>
          <div className="flex flex-col gap-4">
            {events.map((event) => {
              const isOngoing = event.status === 'ongoing';
              const isUpcoming = event.status === 'upcoming';
              return (
                <Link key={event.id} href={`/competitions/${event.id}`} className="block group">
                  <div className="glass relative overflow-hidden rounded-[20px] p-5 transition-all duration-300 hover:-translate-y-0.5"
                    style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
                    <div className="absolute top-0 left-0 w-full h-[3px] opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'var(--gradient-primary)' }} />
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Tag color={isOngoing ? 'red' : isUpcoming ? 'blue' : 'default'}>
                            {isOngoing ? '进行中' : isUpcoming ? '即将开始' : '已结束'}
                          </Tag>
                        </div>
                        <h3 className="text-lg font-semibold mb-2 group-hover:opacity-80 transition-opacity">
                          {event.title}
                        </h3>
                        <p className="text-sm mb-3 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{event.description}</p>
                        <div className="flex items-center gap-5 text-xs" style={{ color: 'var(--text-muted)' }}>
                          <span className="flex items-center gap-1"><TeamOutlined /> 已报名 {event.registration_count} 人</span>
                          <span className="flex items-center gap-1"><ClockCircleOutlined /> 截止 {new Date(event.end_time).toLocaleDateString('zh-CN')}</span>
                        </div>
                      </div>
                      <button className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90 ml-4 flex-shrink-0"
                        style={{ background: 'var(--primary)' }}>
                        查看详情
                      </button>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {events.length === 0 && !loading && (
        <div className="text-center py-16 glass rounded-[20px]" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
          <TrophyOutlined className="text-3xl mb-3" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)' }}>暂无大赛活动</p>
        </div>
      )}
    </div>
  );
}
