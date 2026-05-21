'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { Tag, Spin, App } from 'antd';
import {
  TrophyOutlined,
  ArrowLeftOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import { getSupabase } from '@/lib/supabase';
import { EVENT_STATUS_MAP } from '@/lib/constants';
import type { Event } from '@/types';

export default function CompetitionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { message } = App.useApp();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    async function fetchEvent() {
      setLoading(true);
      try {
        const { data, error } = await getSupabase()
          .from('events')
          .select('*')
          .eq('id', id)
          .single();
        if (error) throw error;
        setEvent(data as Event);
      } catch (err) {
        console.error('Failed to fetch event:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchEvent();
  }, [id]);

  const handleRegister = async () => {
    if (!event) return;
    setRegistering(true);
    try {
      const { error } = await getSupabase().from('event_registrations').insert({ event_id: id });
      if (error) throw error;
      const newCount = event.registration_count + 1;
      await getSupabase().from('events').update({ registration_count: newCount }).eq('id', id);
      setEvent({ ...event, registration_count: newCount });
      message.success('报名成功！');
    } catch {
      message.error('报名失败，可能已报名或名额已满');
    } finally {
      setRegistering(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Spin size="large" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <p style={{ color: 'var(--text-muted)' }}>活动不存在</p>
        <Link href="/competitions" style={{ color: 'var(--primary)' }}>返回大赛列表</Link>
      </div>
    );
  }

  const status = EVENT_STATUS_MAP[event.status];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <Link href="/competitions" className="inline-flex items-center gap-1.5 text-sm mb-6 transition-opacity hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
        <ArrowLeftOutlined /> 返回大赛列表
      </Link>

      {/* Event header */}
      <div className="rounded-2xl p-6 sm:p-8 mb-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
        <Tag color={status.color}>{status.label}</Tag>
        <h1 className="text-2xl sm:text-3xl font-bold mt-3 mb-4 leading-tight" style={{ fontFamily: 'var(--font-serif)' }}>
          {event.title}
        </h1>
        <p className="text-base mb-6 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{event.description}</p>

        {/* Info grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--background)' }}>
            <CalendarOutlined style={{ color: 'var(--primary)' }} />
            <div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>开始时间</div>
              <div className="text-sm font-medium">{new Date(event.start_time).toLocaleDateString('zh-CN')}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--background)' }}>
            <CalendarOutlined style={{ color: 'var(--primary)' }} />
            <div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>结束时间</div>
              <div className="text-sm font-medium">{new Date(event.end_time).toLocaleDateString('zh-CN')}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--background)' }}>
            <ClockCircleOutlined style={{ color: 'var(--primary)' }} />
            <div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>报名截止</div>
              <div className="text-sm font-medium">{new Date(event.registration_deadline).toLocaleDateString('zh-CN')}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--background)' }}>
            <TeamOutlined style={{ color: 'var(--primary)' }} />
            <div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>已报名</div>
              <div className="text-sm font-medium">{event.registration_count} / {event.max_participants}</div>
            </div>
          </div>
        </div>

        {(event.status === 'ongoing' || event.status === 'upcoming') && (
          <button
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-60"
            style={{ background: 'var(--primary)' }}
            onClick={handleRegister}
            disabled={registering}
          >
            <TrophyOutlined /> {registering ? '报名中...' : '立即报名'}
          </button>
        )}
      </div>

      {/* Rules */}
      {event.rules && (
        <div className="rounded-2xl p-6 sm:p-8 mb-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <h2 className="text-lg font-semibold mb-4" style={{ fontFamily: 'var(--font-serif)' }}>活动规则</h2>
          <div className="whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{event.rules}</div>
        </div>
      )}

      {/* Prizes */}
      {event.prizes && (
        <div className="rounded-2xl p-6 sm:p-8" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <h2 className="text-lg font-semibold mb-4" style={{ fontFamily: 'var(--font-serif)' }}>奖项设置</h2>
          <div className="whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{event.prizes}</div>
        </div>
      )}
    </div>
  );
}
