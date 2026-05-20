import { NextResponse } from 'next/server';
import { getFeishuAuthUrl } from '@/lib/feishu';

// GET /api/auth/feishu — 发起飞书 OAuth 登录
export async function GET() {
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/feishu/callback`;
  const authUrl = getFeishuAuthUrl(redirectUri);
  return NextResponse.redirect(authUrl);
}
