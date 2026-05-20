import { NextRequest, NextResponse } from 'next/server';
import { getFeishuUserToken, getFeishuUserInfo } from '@/lib/feishu';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// GET /api/auth/feishu/callback — 飞书 OAuth 回调
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=no_code', request.url));
  }

  try {
    // 1. 用 code 换取飞书 user_access_token
    const tokenData = await getFeishuUserToken(code);

    // 2. 获取飞书用户信息
    const feishuUser = await getFeishuUserInfo(tokenData.access_token);

    // 3. 在 Supabase 中查找或创建用户
    const { data: existingUser } = await getSupabaseAdmin()
      .from('users')
      .select('id')
      .eq('feishu_open_id', feishuUser.open_id)
      .single();

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      await getSupabaseAdmin()
        .from('users')
        .update({
          name: feishuUser.name,
          avatar: feishuUser.avatar_url || feishuUser.avatar_thumb,
        })
        .eq('id', userId);
    } else {
      const { data: newUser, error } = await getSupabaseAdmin()
        .from('users')
        .insert({
          feishu_open_id: feishuUser.open_id,
          name: feishuUser.name,
          avatar: feishuUser.avatar_url || feishuUser.avatar_thumb,
          department: '',
          role: 'user',
        })
        .select('id')
        .single();

      if (error) throw error;
      userId = newUser.id;
    }

    // 4. 设置 cookie-based session
    const response = NextResponse.redirect(new URL('/', request.url));

    response.cookies.set('feishu_user_id', userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 天
    });

    response.cookies.set('feishu_user_info', JSON.stringify({
      id: userId,
      name: feishuUser.name,
      avatar: feishuUser.avatar_url || feishuUser.avatar_thumb,
    }), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error('飞书登录失败:', error);
    return NextResponse.redirect(new URL('/login?error=auth_failed', request.url));
  }
}
