'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Tag, Spin } from 'antd';
import { TrophyOutlined, TeamOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { getSupabase } from '@/lib/supabase';
import { EVENT_STATUS_MAP } from '@/lib/constants';
import type { Event } from '@/types';

export default function CompetitionsPage() {
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

  const grouped = {
    ongoing: events.filter((e) => e.status === 'ongoing'),
    upcoming: events.filter((e) => e.status === 'upcoming'),
    ended: events.filter((e) => e.status === 'ended'),
  };

  const statusColors: Record<string, string> = {
    ongoing: 'var(--primary)',
    upcoming: '#4a6fa5',
    ended: 'var(--text-muted)',
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg flex items-center justify-center text-base" style={{ background: 'rgba(26, 58, 138, 0.1)', color: 'var(--primary)' }}>
            <TrophyOutlined />
          </span>
          AI 大赛
        </h1>
        <p className="text-sm mt-1 ml-12" style={{ color: 'var(--text-secondary)' }}>展示你的 AI 实践成果</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spin size="large" /></div>
      ) : (
        <>
          {(['ongoing', 'upcoming', 'ended'] as const).map((status) => {
            const items = grouped[status];
            if (items.length === 0) return null;
            const config = EVENT_STATUS_MAP[status];
            return (
              <section key={status} className="mb-10">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full" style={{ background: statusColors[status] }} />
                  <h2 className="text-base font-semibold" style={{ color: statusColors[status] }}>
                    {config.label}
                  </h2>
                </div>
                <div className="flex flex-col gap-4">
                  {items.map((event) => (
                    <Link key={event.id} href={`/competitions/${event.id}`} className="block group">
                      <div className="glass relative overflow-hidden rounded-[20px] p-5 transition-all duration-300 hover:-translate-y-0.5"
                        style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
                        <div className="absolute top-0 left-0 w-full h-[3px] opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'var(--gradient-primary)' }} />
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <Tag color={config.color}>{config.label}</Tag>
                            <h3 className="text-lg font-semibold mt-3 mb-2 group-hover:opacity-80 transition-opacity">
                              {event.title}
                            </h3>
                            <p className="text-sm mb-4 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{event.description}</p>
                            <div className="flex items-center gap-5 text-xs" style={{ color: 'var(--text-muted)' }}>
                              <span className="flex items-center gap-1"><TeamOutlined /> 已报名 {event.registration_count} 人</span>
                              <span className="flex items-center gap-1"><ClockCircleOutlined /> 截止 {new Date(event.end_time).toLocaleDateString('zh-CN')}</span>
                            </div>
                          </div>
                          {status !== 'ended' && (
                            <button className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90 ml-4 flex-shrink-0"
                              style={{ background: 'var(--primary)' }}>
                              查看详情
                            </button>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}

          {events.length === 0 && (
            <div className="text-center py-16 glass rounded-[20px]" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
              <TrophyOutlined className="text-3xl mb-3" style={{ color: 'var(--text-muted)' }} />
              <p style={{ color: 'var(--text-muted)' }}>暂无大赛活动</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
