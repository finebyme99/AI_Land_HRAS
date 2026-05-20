import { getSupabase } from '../supabase';
import type { Event, EventSubmission } from '@/types';

// 获取活动列表
export async function getEvents(status?: 'upcoming' | 'ongoing' | 'ended') {
  let query = getSupabase()
    .from('events')
    .select('*')
    .order('start_time', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw error;
  return data as Event[];
}

// 获取单个活动
export async function getEvent(id: string) {
  const { data, error } = await getSupabase()
    .from('events')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Event;
}

// 报名活动
export async function registerEvent(eventId: string, userId: string) {
  const { error } = await getSupabase()
    .from('event_registrations')
    .insert({ event_id: eventId, user_id: userId });

  if (error) throw error;

  await getSupabase().rpc('increment_count', { table_name: 'events', row_id: eventId, column_name: 'registration_count' });
}

// 提交作品
export async function submitWork(submission: {
  event_id: string;
  user_id: string;
  title: string;
  content: string;
  file_url?: string;
}) {
  const { data, error } = await getSupabase()
    .from('event_submissions')
    .insert(submission)
    .select()
    .single();

  if (error) throw error;
  return data as EventSubmission;
}

// 获取活动作品列表
export async function getSubmissions(eventId: string) {
  const { data, error } = await getSupabase()
    .from('event_submissions')
    .select(`
      *,
      user:users!user_id(id, name, avatar)
    `)
    .eq('event_id', eventId)
    .order('score', { ascending: false });

  if (error) throw error;
  return data as EventSubmission[];
}
