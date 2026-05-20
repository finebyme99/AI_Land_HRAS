import { NextResponse } from 'next/server';

// POST /api/auth/logout — 登出
export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete('feishu_user_id');
  response.cookies.delete('feishu_user_info');
  return response;
}
