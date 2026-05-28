import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// GET /api/auth/me — 获取当前登录用户信息
export async function GET(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id');

  if (!userId) {
    return NextResponse.json({ user: null });
  }

  try {
    const { data: user } = await getSupabaseAdmin()
      .from('users')
      .select('id, feishu_open_id, name, avatar, department, roles, bio, points, level, created_at')
      .eq('id', userId.value)
      .single();

    if (!user) {
      const response = NextResponse.json({ user: null });
      response.cookies.delete('feishu_user_id');
      response.cookies.delete('feishu_user_info');
      return response;
    }

    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ user: null });
  }
}
