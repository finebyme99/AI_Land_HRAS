import { NextRequest, NextResponse } from 'next/server';
import { recordCompetitionSyncFailure, runCompetitionSyncAndRecordStatus } from '@/lib/competition-sync-store';
import { recordCompetitionSyncOperationLog } from '@/lib/operation-log';
import { normalizeOperationLogResult } from '@/lib/operation-log-row';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const requestTime = new Date().toISOString();

  try {
    const result = await runCompetitionSyncAndRecordStatus();
    await safeRecordCronOperationLog(requestTime, 'success', normalizeOperationLogResult(result.status.result));
    return NextResponse.json({ source: 'cron-sync-competitions', ok: true, ...result });
  } catch (err) {
    console.error('[cron/sync-competitions] failed:', err);
    const message = err instanceof Error ? err.message : '同步失败';
    try {
      await recordCompetitionSyncFailure(message);
    } catch (statusErr) {
      console.error('[cron/sync-competitions] failed to record failure:', statusErr);
    }
    await safeRecordCronOperationLog(requestTime, 'failed', { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function safeRecordCronOperationLog(
  requestTime: string,
  status: 'success' | 'failed',
  result: Record<string, unknown>,
): Promise<void> {
  try {
    await recordCompetitionSyncOperationLog({
      source: 'cron',
      operator: { id: null, name: 'Vercel Cron' },
      requestTime,
      status,
      result,
    });
  } catch (err) {
    console.error('[cron/sync-competitions] failed to record operation log:', err);
  }
}
