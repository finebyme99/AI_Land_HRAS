import { getSupabase } from '../supabase';
import type { Resource, ResourceCategory } from '@/types';

/** 获取资源列表 */
export async function getApps(options?: {
  category?: ResourceCategory;
  search?: string;
}) {
  let query = getSupabase()
    .from('apps')
    .select('*')
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  if (options?.category) query = query.eq('category', options.category);
  if (options?.search) query = query.or(`name.ilike.%${options.search}%,description.ilike.%${options.search}%`);

  const { data, error } = await query;
  if (error) throw error;
  return data as Resource[];
}

/** 获取单个资源 */
export async function getApp(id: string) {
  const { data, error } = await getSupabase()
    .from('apps')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Resource;
}

/** 创建资源（UGC 投稿） */
export async function createApp(appData: {
  name: string;
  description: string;
  content?: string;
  category: ResourceCategory;
  scenarios: string[];
  official_url?: string;
  author_id: string;
}) {
  const { data, error } = await getSupabase()
    .from('apps')
    .insert({ ...appData, status: 'pending' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** 点赞资源 */
export async function likeApp(userId: string, appId: string) {
  const { error } = await getSupabase()
    .from('likes')
    .insert({ user_id: userId, target_type: 'app', target_id: appId });

  if (error) throw error;
  await getSupabase().rpc('increment_count', { table_name: 'apps', row_id: appId, column_name: 'like_count' });
}

/** 点踩资源 */
export async function dislikeApp(userId: string, appId: string) {
  const { error } = await getSupabase()
    .from('dislikes')
    .insert({ user_id: userId, target_type: 'app', target_id: appId });

  if (error) throw error;
  await getSupabase().rpc('increment_count', { table_name: 'apps', row_id: appId, column_name: 'dislike_count' });
}
