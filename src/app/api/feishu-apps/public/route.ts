import { NextResponse } from 'next/server';
import { listActiveFeishuAppsPublic } from '@/lib/feishu-app-store';

// GET /api/feishu-apps/public — 公开：active 企业的 app_id + enterprise_name
export async function GET() {
  try {
    const apps = await listActiveFeishuAppsPublic();
    return NextResponse.json({ apps });
  } catch (e) {
    return NextResponse.json({ apps: [] }, { status: 500 });
  }
}
