import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getUserPermissions } from '@/lib/permissions';

// GET /api/auth/me — 获取当前登录用户信息（含权限点）
export async function GET(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id');

  if (!userId) {
    return NextResponse.json({ user: null });
  }

  try {
    const { data: user } = await getSupabaseAdmin()
      .from('users')
      .select('id, feishu_open_id, feishu_tenant_key, employee_id, username, name, avatar, department, roles, reviewer_roles, bio, points, level, created_at, last_active_at')
      .eq('id', userId.value)
      .single();

    if (!user) {
      const response = NextResponse.json({ user: null });
      response.cookies.delete('feishu_user_id');
      response.cookies.delete('feishu_user_info');
      return response;
    }

    const permissions = await getUserPermissions(user.id);

    return NextResponse.json({ user: { ...user, permissions: [...permissions] } });
  } catch {
    return NextResponse.json({ user: null });
  }
}
