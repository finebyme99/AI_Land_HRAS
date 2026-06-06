import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = [
  '/login',
  '/api/auth/feishu',
  '/api/auth/feishu/callback',
  '/api/auth/email/send',
  '/api/auth/email/verify',
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/feishu-apps/public',
  '/api/feishu/card-callback',
  '/api/cron/weekly-course-card',
  '/api/cron/sync-courses',
  '/api/cron/feishu-apps-health',
  '/hras-2026',
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const userId = request.cookies.get('feishu_user_id');
  if (!userId) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|hras-2026/.*|.*\\..*).*)',
  ],
};
