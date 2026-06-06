// src/app/api/cron/weekly-course-card/route.ts
// Vercel Cron 触发：周一 18:25 CST = 10:25 UTC
// 调 executeReminders(false)，会扫所有到期提醒（含种子的"补录本周 AI 公开课"）

import { NextRequest, NextResponse } from 'next/server';
import { executeReminders } from '@/lib/reminder-service';

async function requireCronSecret(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return false;
  }
  return true;
}

export async function GET(request: NextRequest) {
  if (!(await requireCronSecret(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await executeReminders(false);
    return NextResponse.json({ source: 'cron-weekly-course-card', ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Cron 执行失败' },
      { status: 500 },
    );
  }
}

// Vercel Cron 也支持 POST
export const POST = GET;
