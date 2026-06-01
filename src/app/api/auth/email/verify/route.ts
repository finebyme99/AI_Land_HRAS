import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/login?error=invalid_link', request.url));
  }

  try {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const supabase = getSupabaseAdmin();

    // 查找未使用且未过期的 token
    const { data: tokenRow, error: tokenError } = await supabase
      .from('login_tokens')
      .select('id, email, expires_at, used')
      .eq('token_hash', tokenHash)
      .eq('used', false)
      .single();

    if (tokenError || !tokenRow) {
      return NextResponse.redirect(new URL('/login?error=invalid_link', request.url));
    }

    // 检查过期
    if (new Date(tokenRow.expires_at) < new Date()) {
      return NextResponse.redirect(new URL('/login?error=link_expired', request.url));
    }

    // 标记已使用
    await supabase.from('login_tokens').update({ used: true }).eq('id', tokenRow.id);

    const email = tokenRow.email;

    // 查找或创建用户（通过 email 匹配）
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, name, avatar, roles, department')
      .eq('email', email)
      .single();

    let userId: string;
    let userName: string;
    let userAvatar: string;
    let userRoles: string[];
    let userDepartment: string;

    if (existingUser) {
      userId = existingUser.id;
      userName = existingUser.name;
      userAvatar = existingUser.avatar || '';
      userRoles = existingUser.roles || ['user'];
      userDepartment = existingUser.department || '';
    } else {
      // 新用户：用邮箱前缀作为名称
      const name = email.split('@')[0];
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          email,
          name,
          avatar: '',
          department: '',
          roles: ['user'],
          feishu_open_id: null,
        })
        .select('id, name, avatar, roles, department')
        .single();

      if (insertError) {
        console.error('创建用户失败:', insertError);
        return NextResponse.redirect(new URL('/login?error=auth_failed', request.url));
      }

      userId = newUser.id;
      userName = newUser.name;
      userAvatar = newUser.avatar || '';
      userRoles = newUser.roles || ['user'];
      userDepartment = newUser.department || '';
    }

    // 清理过期 token
    await supabase.from('login_tokens').delete().lt('expires_at', new Date().toISOString());

    // 设置 cookie session（和飞书登录完全一致）
    const response = NextResponse.redirect(new URL('/', request.url));

    response.cookies.set('feishu_user_id', userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    });

    response.cookies.set('feishu_user_info', JSON.stringify({
      id: userId,
      name: userName,
      avatar: userAvatar,
      roles: userRoles,
      department: userDepartment,
    }), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (err) {
    console.error('邮箱登录失败:', err);
    return NextResponse.redirect(new URL('/login?error=auth_failed', request.url));
  }
}
