import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getAuthSessionCookieOptions } from '@/lib/auth-session';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: '请输入用户名和密码' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 查找用户
    const { data: user } = await supabase
      .from('users')
      .select('id, name, avatar, roles, department, password_hash')
      .eq('username', username)
      .single();

    if (!user || !user.password_hash) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }

    // 验证密码
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }

    // 更新最近活跃时间
    await supabase.from('users').update({ last_active_at: new Date().toISOString() }).eq('id', user.id);

    // 设置 cookie session
    const response = NextResponse.json({ ok: true });

    response.cookies.set('feishu_user_id', user.id, {
      ...getAuthSessionCookieOptions({ httpOnly: true }),
    });

    response.cookies.set('feishu_user_info', JSON.stringify({
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      roles: user.roles,
      department: user.department,
    }), {
      ...getAuthSessionCookieOptions({ httpOnly: false }),
    });

    return response;
  } catch (err) {
    console.error('登录异常:', err);
    return NextResponse.json({ error: '登录失败' }, { status: 500 });
  }
}
