import { getSupabase } from '../supabase';
import type { User } from '@/types';

// 获取用户信息
export async function getUser(id: string) {
  const { data, error } = await getSupabase()
    .from('users')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as User;
}

// 通过飞书 open_id 获取用户
export async function getUserByFeishuId(feishuOpenId: string) {
  const { data, error } = await getSupabase()
    .from('users')
    .select('*')
    .eq('feishu_open_id', feishuOpenId)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
  return data as User | null;
}

// 创建或更新用户（飞书登录时调用）
export async function upsertUser(userData: {
  feishu_open_id: string;
  name: string;
  avatar: string;
  department: string;
}) {
  const existing = await getUserByFeishuId(userData.feishu_open_id);

  if (existing) {
    const { data, error } = await getSupabase()
      .from('users')
      .update({ name: userData.name, avatar: userData.avatar, department: userData.department })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return data as User;
  }

  const { data, error } = await getSupabase()
    .from('users')
    .insert(userData)
    .select()
    .single();

  if (error) throw error;
  return data as User;
}

// 更新用户资料
export async function updateUser(id: string, updates: { bio?: string; expertise?: string }) {
  const { data, error } = await getSupabase()
    .from('users')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as User;
}
