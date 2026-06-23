import { NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/permissions';
import { syncCompetitionSnapshot } from '@/lib/competition-snapshot-sync';

export async function POST(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (!(await hasPermission(userId, 'competition.sync'))) {
    return NextResponse.json({ error: '仅有大赛同步权限的用户可同步快照' }, { status: 403 });
  }

  try {
    const result = await syncCompetitionSnapshot({ scope: 'all' });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[wish-pool/sync] failed:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : '同步失败' }, { status: 500 });
  }
}
