// src/app/api/auth/dev-skip/route.ts
// ⚠️ 仅 NODE_ENV !== 'production' 生效 — 本地 dev 跳过飞书 OAuth 直接登录
// 解决：郭谦等只有飞书登录无密码的账号，localhost 无法走 OAuth 时用此入口
//
// 用法：
//   POST /api/auth/dev-skip                  → 用第一个 admin 账号登录
//   POST /api/auth/dev-skip { user_id: "uuid" } → 指定 user_id 登录

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'dev-skip 仅 dev 环境可用' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const explicitId = body?.user_id as string | undefined;
    const supabase = getSupabaseAdmin();

    let user: { id: string; name: string; avatar: string; roles: string[]; department: string } | null = null;

    if (explicitId) {
      const { data } = await supabase
        .from('users')
        .select('id, name, avatar, roles, department')
        .eq('id', explicitId)
        .maybeSingle();
      user = data;
    } else {
      // 找第一个 admin 账号
      const { data } = await supabase
        .from('users')
        .select('id, name, avatar, roles, department')
        .contains('roles', ['admin'])
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      user = data;
    }

    if (!user) {
      return NextResponse.json({ error: '没找到 admin 账号（先用 Supabase SQL 给某用户加 admin 角色）' }, { status: 404 });
    }

    const response = NextResponse.json({ ok: true, user });
    response.cookies.set('feishu_user_id', user.id, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    });
    response.cookies.set('feishu_user_info', JSON.stringify({
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      roles: user.roles,
      department: user.department,
    }), {
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (err) {
    console.error('[dev-skip] failed:', err);
    return NextResponse.json({ error: 'dev-skip 失败' }, { status: 500 });
  }
}
