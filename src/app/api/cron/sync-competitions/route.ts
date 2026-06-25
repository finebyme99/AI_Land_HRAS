import { NextRequest, NextResponse } from 'next/server';
import { recordCompetitionSyncFailure, runCompetitionSyncAndRecordStatus } from '@/lib/competition-sync-store';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  try {
    const result = await runCompetitionSyncAndRecordStatus();
    return NextResponse.json({ source: 'cron-sync-competitions', ok: true, ...result });
  } catch (err) {
    console.error('[cron/sync-competitions] failed:', err);
    const message = err instanceof Error ? err.message : '同步失败';
    try {
      await recordCompetitionSyncFailure(message);
    } catch (statusErr) {
      console.error('[cron/sync-competitions] failed to record failure:', statusErr);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
