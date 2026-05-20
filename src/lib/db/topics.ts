import { getSupabase } from '../supabase';
import type { Topic, Answer } from '@/types';

// 获取话题列表
export async function getTopics(options?: {
  search?: string;
  tag?: string;
  sort?: 'latest' | 'hot' | 'unanswered' | 'accepted';
  limit?: number;
  offset?: number;
}) {
  let query = getSupabase()
    .from('topics')
    .select(`
      *,
      author:users!author_id(id, name, avatar, department)
    `);

  if (options?.search) query = query.or(`title.ilike.%${options.search}%`);
  if (options?.tag) query = query.contains('tags', [options.tag]);

  switch (options?.sort) {
    case 'hot': query = query.order('view_count', { ascending: false }); break;
    case 'unanswered': query = query.eq('answer_count', 0).order('created_at', { ascending: false }); break;
    case 'accepted': query = query.eq('has_accepted_answer', true).order('created_at', { ascending: false }); break;
    default: query = query.order('created_at', { ascending: false });
  }

  if (options?.limit) query = query.limit(options.limit);
  if (options?.offset) query = query.range(options.offset, options.offset + (options.limit || 10) - 1);

  const { data, error } = await query;
  if (error) throw error;
  return data as Topic[];
}

// 获取单个话题
export async function getTopic(id: string) {
  const { data, error } = await getSupabase()
    .from('topics')
    .select(`
      *,
      author:users!author_id(id, name, avatar, department)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;

  await getSupabase().rpc('increment_view_count', { table_name: 'topics', row_id: id });

  return data as Topic;
}

// 创建话题
export async function createTopic(topicData: {
  title: string;
  content: string;
  tags: string[];
  author_id: string;
}) {
  const { data, error } = await getSupabase()
    .from('topics')
    .insert(topicData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// 获取话题的回答
export async function getAnswers(topicId: string) {
  const { data, error } = await getSupabase()
    .from('answers')
    .select(`
      *,
      author:users!author_id(id, name, avatar, department)
    `)
    .eq('topic_id', topicId)
    .order('is_accepted', { ascending: false })
    .order('vote_count', { ascending: false });

  if (error) throw error;
  return data as Answer[];
}

// 创建回答
export async function createAnswer(answerData: {
  topic_id: string;
  content: string;
  author_id: string;
}) {
  const { data, error } = await getSupabase()
    .from('answers')
    .insert(answerData)
    .select()
    .single();

  if (error) throw error;

  // 更新话题的回答数
  await getSupabase().rpc('increment_count', { table_name: 'topics', row_id: answerData.topic_id, column_name: 'answer_count' });

  return data;
}

// 采纳回答
export async function acceptAnswer(answerId: string, topicId: string) {
  const { error } = await getSupabase()
    .from('answers')
    .update({ is_accepted: true })
    .eq('id', answerId);

  if (error) throw error;

  await getSupabase()
    .from('topics')
    .update({ has_accepted_answer: true })
    .eq('id', topicId);
}

// 投票回答
export async function voteAnswer(answerId: string, increment: number) {
  const { error } = await getSupabase().rpc('increment_count', {
    table_name: 'answers',
    row_id: answerId,
    column_name: 'vote_count',
    increment_by: increment,
  });

  if (error) throw error;
}
