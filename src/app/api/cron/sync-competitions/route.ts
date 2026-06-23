import { NextRequest, NextResponse } from 'next/server';
import { syncCompetitionSnapshot } from '@/lib/competition-snapshot-sync';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  try {
    const result = await syncCompetitionSnapshot({ scope: 'all' });
    return NextResponse.json({ source: 'cron-sync-competitions', ok: true, ...result });
  } catch (err) {
    console.error('[cron/sync-competitions] failed:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : '同步失败' }, { status: 500 });
  }
}
