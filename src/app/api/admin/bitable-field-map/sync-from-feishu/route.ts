import { NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/permissions';
import { syncFieldMapFromFeishu } from '@/lib/bitable/sync-field-map';

async function requireAdmin(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) return null;
  if (!(await hasPermission(userId, 'fieldmap.sync'))) return null;
  return { id: userId };
}

/**
 * POST /api/admin/bitable-field-map/sync-from-feishu
 * body: { base_app, table_id, fill_known_only?: boolean }
 *
 * 从飞书拉所有字段，对比 DB：
 *   - 飞书有 + DB 没：插入新行（key 从硬编码 fallback 猜）
 *   - 飞书有 + DB 有：更新 field_id / group_name / description
 *   - 飞书没有 + DB 有：不删（orphan 状态在 GET 里看到就行）
 *
 * 默认 fill_known_only=true：只插入硬编码 fallback 里有的字段，避免未知字段污染
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: '仅管理员可访问' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const baseApp = body.base_app;
  const tableId = body.table_id;
  const fillKnownOnly = body.fill_known_only !== false; // 默认 true
  if (!baseApp || !tableId) {
    return NextResponse.json({ error: '缺少 base_app 或 table_id' }, { status: 400 });
  }

  const result = await syncFieldMapFromFeishu(baseApp, tableId, { fillKnownOnly });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({
    synced: true,
    inserted: result.inserted,
    updated: result.updated,
    skipped: result.skipped,
    total_feishu: result.totalFeishu,
  });
}
