import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    // 校验
    if (!username || typeof username !== 'string' || username.length < 2 || username.length > 20) {
      return NextResponse.json({ error: '用户名需要 2-20 个字符' }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9\u4e00-\u9fff_-]+$/.test(username)) {
      return NextResponse.json({ error: '用户名只能包含中文、英文、数字、下划线、短横线' }, { status: 400 });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: '密码至少 6 位' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 检查用户名是否已存在
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single();

    if (existing) {
      return NextResponse.json({ error: '用户名已被占用' }, { status: 409 });
    }

    // 创建用户
    const passwordHash = await bcrypt.hash(password, 10);
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        username,
        password_hash: passwordHash,
        name: username,
        avatar: '',
        department: '',
        roles: ['user'],
      })
      .select('id, name, avatar, roles, department')
      .single();

    if (error) {
      console.error('注册失败:', error);
      return NextResponse.json({ error: '注册失败，请稍后重试' }, { status: 500 });
    }

    // 设置 cookie session（和飞书登录一致）
    const response = NextResponse.json({ ok: true });

    response.cookies.set('feishu_user_id', newUser.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    });

    response.cookies.set('feishu_user_info', JSON.stringify({
      id: newUser.id,
      name: newUser.name,
      avatar: newUser.avatar,
      roles: newUser.roles,
      department: newUser.department,
    }), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (err) {
    console.error('注册异常:', err);
    return NextResponse.json({ error: '注册失败' }, { status: 500 });
  }
}
