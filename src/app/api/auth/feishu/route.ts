import { NextRequest, NextResponse } from 'next/server';
import { getFeishuAuthUrl } from '@/lib/feishu';
import { getFeishuAppByAppId, getRedirectUriForOrigin } from '@/lib/feishu-app-store';

// GET /api/auth/feishu?app_id=xxx — 发起飞书 OAuth 登录
export async function GET(request: NextRequest) {
  const appId = request.nextUrl.searchParams.get('app_id');
  if (!appId) {
    return NextResponse.redirect(new URL('/login?error=missing_app_id', request.url));
  }

  const app = await getFeishuAppByAppId(appId);
  if (!app) {
    return NextResponse.redirect(new URL('/login?error=unknown_app', request.url));
  }
  if (app.status !== 'active') {
    return NextResponse.redirect(new URL('/login?error=app_disabled', request.url));
  }

  // 按当前 origin 选 redirect_uri（本地 / 生产共享同一 app）
  const redirectUri = getRedirectUriForOrigin(app, request.nextUrl.origin);

  // state 纯随机；app_id 单独存 cookie
  const state = Math.random().toString(36).substring(2) + Date.now().toString(36);
  const authUrl = getFeishuAuthUrl(app.app_id, redirectUri, state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set('feishu_oauth_state', state, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 300 });
  response.cookies.set('feishu_oauth_app_id', app.app_id, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 300 });
  return response;
}
