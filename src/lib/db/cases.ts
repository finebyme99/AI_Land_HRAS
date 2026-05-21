import { getSupabase } from '../supabase';
import type { Case, CaseCategory, ContentStatus } from '@/types';

// 获取案例列表
export async function getCases(options?: {
  category?: CaseCategory;
  status?: ContentStatus;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  let query = getSupabase()
    .from('cases')
    .select(`
      *,
      author:users!author_id(id, name, avatar, department)
    `)
    .order('created_at', { ascending: false });

  if (options?.category) query = query.eq('category', options.category);
  if (options?.status) query = query.eq('status', options.status);
  if (options?.search) query = query.or(`title.ilike.%${options.search}%,summary.ilike.%${options.search}%`);
  if (options?.limit) query = query.limit(options.limit);
  if (options?.offset) query = query.range(options.offset, options.offset + (options.limit || 10) - 1);

  const { data, error } = await query;
  if (error) throw error;
  return data as Case[];
}

// 获取单个案例
export async function getCase(id: string) {
  const { data, error } = await getSupabase()
    .from('cases')
    .select(`
      *,
      author:users!author_id(id, name, avatar, department)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;

  await getSupabase().rpc('increment_view_count', { table_name: 'cases', row_id: id });

  return data as Case;
}

// 创建案例
export async function createCase(caseData: {
  title: string;
  summary: string;
  content: string;
  category: CaseCategory;
  ai_tools: string[];
  author_id: string;
  event_id?: string;
}) {
  const { data, error } = await getSupabase()
    .from('cases')
    .insert(caseData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// 更新案例
export async function updateCase(id: string, updates: Partial<Case>) {
  const { data, error } = await getSupabase()
    .from('cases')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// 点赞案例
export async function likeCase(userId: string, caseId: string) {
  const { error } = await getSupabase()
    .from('likes')
    .insert({ user_id: userId, target_type: 'case', target_id: caseId });

  if (error) throw error;

  await getSupabase().rpc('increment_count', { table_name: 'cases', row_id: caseId, column_name: 'like_count' });
}

// 收藏案例
export async function bookmarkCase(userId: string, caseId: string) {
  const { error } = await getSupabase()
    .from('bookmarks')
    .insert({ user_id: userId, target_type: 'case', target_id: caseId });

  if (error) throw error;

  await getSupabase().rpc('increment_count', { table_name: 'cases', row_id: caseId, column_name: 'bookmark_count' });
}
