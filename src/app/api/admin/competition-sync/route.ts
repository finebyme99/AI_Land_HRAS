import { NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/permissions';
import {
  getCompetitionSyncStatus,
  recordCompetitionSyncFailure,
  runCompetitionSyncAndRecordStatus,
} from '@/lib/competition-sync-store';

async function getUserId(request: NextRequest): Promise<string | null> {
  return request.cookies.get('feishu_user_id')?.value ?? null;
}

async function canViewStatus(userId: string): Promise<boolean> {
  return await hasPermission(userId, 'competition.sync')
    || await hasPermission(userId, 'admin.bitable-field-map');
}

export async function GET(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId || !(await canViewStatus(userId))) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  const status = await getCompetitionSyncStatus();
  return NextResponse.json(status);
}

export async function POST(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId || !(await hasPermission(userId, 'competition.sync'))) {
    return NextResponse.json({ error: '仅有场景数据同步权限的用户可同步' }, { status: 403 });
  }

  try {
    const result = await runCompetitionSyncAndRecordStatus();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : '同步失败';
    try {
      await recordCompetitionSyncFailure(message);
    } catch (statusErr) {
      console.error('[admin/competition-sync] failed to record failure:', statusErr);
    }
    console.error('[admin/competition-sync] failed:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
