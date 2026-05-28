import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// 验证当前用户是否为 admin
async function requireAdmin(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) return null;

  const { data: user } = await getSupabaseAdmin()
    .from('users')
    .select('id, roles')
    .eq('id', userId)
    .single();

  if (!user || !user.roles?.some((r: string) => ['admin', 'moderator'].includes(r))) return null;
  return user;
}

// GET /api/admin/users — 获取所有用户列表
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  try {
    const { data: users, error } = await getSupabaseAdmin()
      .from('users')
      .select('id, feishu_open_id, name, avatar, department, roles, bio, points, level, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ users });
  } catch {
    return NextResponse.json({ error: '获取用户列表失败' }, { status: 500 });
  }
}

// PATCH /api/admin/users — 修改用户角色
export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  try {
    const { userId, roles } = await request.json();

    if (!userId || !roles) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }

    const validRoles = ['user', 'contributor', 'reviewer', 'moderator', 'admin'];
    if (!Array.isArray(roles) || !roles.every((r: string) => validRoles.includes(r))) {
      return NextResponse.json({ error: '无效角色' }, { status: 400 });
    }

    // 不能修改自己的角色
    if (userId === admin.id) {
      return NextResponse.json({ error: '不能修改自己的角色' }, { status: 400 });
    }

    const { data: user, error } = await getSupabaseAdmin()
      .from('users')
      .update({ roles })
      .eq('id', userId)
      .select('id, name, avatar, department, roles, points, level, created_at')
      .single();

    if (error) throw error;

    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: '修改角色失败' }, { status: 500 });
  }
}
