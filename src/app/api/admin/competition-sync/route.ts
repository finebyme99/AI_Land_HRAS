import { NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/permissions';
import {
  getCompetitionSyncStatus,
  recordCompetitionSyncFailure,
  runCompetitionSyncAndRecordStatus,
} from '@/lib/competition-sync-store';
import {
  getOperationLogOperator,
  recordCompetitionSyncOperationLog,
  type OperationLogOperator,
} from '@/lib/operation-log';
import { normalizeOperationLogResult } from '@/lib/operation-log-row';

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

  const requestTime = new Date().toISOString();
  const operator = await getOperationLogOperator(userId);

  try {
    const result = await runCompetitionSyncAndRecordStatus();
    await safeRecordSyncOperationLog({
      source: 'admin',
      operator,
      requestTime,
      status: 'success',
      result: normalizeOperationLogResult(result.status.result),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : '同步失败';
    try {
      await recordCompetitionSyncFailure(message);
    } catch (statusErr) {
      console.error('[admin/competition-sync] failed to record failure:', statusErr);
    }
    await safeRecordSyncOperationLog({
      source: 'admin',
      operator,
      requestTime,
      status: 'failed',
      result: { error: message },
    });
    console.error('[admin/competition-sync] failed:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function safeRecordSyncOperationLog(input: {
  source: 'admin';
  operator: OperationLogOperator;
  requestTime: string;
  status: 'success' | 'failed';
  result: Record<string, unknown>;
}): Promise<void> {
  try {
    await recordCompetitionSyncOperationLog(input);
  } catch (err) {
    console.error('[admin/competition-sync] failed to record operation log:', err);
  }
}
