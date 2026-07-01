import { NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/permissions';
import { listOperationLogs } from '@/lib/operation-log';

export async function GET(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (!(await hasPermission(userId, 'admin.operation-logs'))) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  try {
    const limitParam = Number(request.nextUrl.searchParams.get('limit') ?? 100);
    const logs = await listOperationLogs(Number.isFinite(limitParam) ? limitParam : 100);
    return NextResponse.json({ logs });
  } catch (err) {
    console.error('[admin/operation-logs] failed:', err);
    return NextResponse.json({ error: '获取操作日志失败' }, { status: 500 });
  }
}
