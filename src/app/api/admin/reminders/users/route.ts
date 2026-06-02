import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

async function requireAdmin(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) return null;
  const { data: user } = await getSupabaseAdmin()
    .from('users').select('id, roles').eq('id', userId).single();
  if (!user || !user.roles?.includes('admin')) return null;
  return user;
}

// GET — 获取已注册用户列表（供选择提醒对象）
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: '仅管理员可访问' }, { status: 403 });

  const { data: users, error } = await getSupabaseAdmin()
    .from('users')
    .select('id, name, feishu_open_id, roles')
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 标记是否有飞书ID
  const result = (users || []).map((u) => ({
    id: u.id,
    name: u.name || '(未命名)',
    has_feishu: !!u.feishu_open_id,
    roles: u.roles || [],
  }));

  return NextResponse.json({ users: result });
}
