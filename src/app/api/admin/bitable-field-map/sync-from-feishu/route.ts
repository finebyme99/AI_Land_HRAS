import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { FALLBACK_FIELD_MAP } from '@/lib/bitable/field-map';

async function requireAdmin(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) return null;
  const { data: user } = await getSupabaseAdmin()
    .from('users').select('id, roles').eq('id', userId).single();
  if (!user || !user.roles?.some((r: string) => ['admin', 'moderator'].includes(r))) return null;
  return user;
}

/**
 * POST /api/admin/bitable-field-map/sync-from-feishu
 * body: { base_app, table_id, default_active?: boolean, fill_known_only?: boolean }
 *
 * 从飞书拉所有字段，对比 DB：
 *   - 飞书有 + DB 没：插入新行（key 从硬编码 fallback 猜）
 *   - 飞书有 + DB 有：更新 field_id 和 group_name（DB 列名不变）
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

  const supabase = getSupabaseAdmin();

  // 1. 飞书 schema
  const { getTenantAccessTokenFor } = await import('@/lib/feishu');
  const appRes = await supabase.from('feishu_apps').select('app_id, app_secret').eq('app_id', 'cli_a84a9ed9597fd01c').single();
  if (!appRes.data) return NextResponse.json({ error: '未找到 ZT 飞书应用' }, { status: 500 });
  const token = await getTenantAccessTokenFor(appRes.data.app_id, appRes.data.app_secret);

  const fieldsUrl = `https://open.feishu.cn/open-apis/bitable/v1/apps/${baseApp}/tables/${tableId}/fields?page_size=100`;
  const fieldsRes = await fetch(fieldsUrl, { headers: { Authorization: `Bearer ${token}` } });
  const fieldsJson = await fieldsRes.json();
  if (!fieldsRes.ok || fieldsJson.code !== 0) {
    return NextResponse.json({ error: `飞书 API 错误: ${fieldsJson.msg ?? fieldsRes.status}` }, { status: 502 });
  }
  const feishuFields = (fieldsJson.data?.items ?? []) as Array<Record<string, unknown>>;

  // 2. DB 现有记录
  const { data: dbRows } = await supabase
    .from('bitable_field_map')
    .select('id, field_id, field_name, key, group_name')
    .eq('base_app', baseApp)
    .eq('table_id', tableId);
  const dbByName = new Map<string, { id: string; field_id: string | null }>();
  for (const row of dbRows ?? []) {
    dbByName.set(row.field_name as string, { id: row.id as string, field_id: (row.field_id as string) ?? null });
  }

  // 3. Diff
  const toInsert: Array<Record<string, unknown>> = [];
  const toUpdate: Array<{ id: string; field_id: string; group_name: string }> = [];
  let skipped = 0;

  for (let i = 0; i < feishuFields.length; i++) {
    const f = feishuFields[i];
    const fieldName = (f.field_name as string) ?? '';
    const fieldId = (f.field_id as string) ?? '';
    const groupName = (f.group_name as string) ?? '未分组';
    if (!fieldName || !fieldId) continue;

    const existing = dbByName.get(fieldName);
    if (existing) {
      // DB 有 → 更新 field_id 和 group_name（如果缺失或不同）
      if (existing.field_id !== fieldId) {
        toUpdate.push({ id: existing.id, field_id: fieldId, group_name: groupName });
      }
      continue;
    }
    // DB 没 → 看 fallback 是否有
    const fallback = FALLBACK_FIELD_MAP[fieldName];
    if (fillKnownOnly && !fallback) {
      skipped++;
      continue;
    }
    toInsert.push({
      base_app: baseApp,
      table_id: tableId,
      field_id: fieldId,
      field_name: fieldName,
      key: fallback?.key ?? `unknown_${fieldId.slice(0, 8)}`,
      type: fallback?.type ?? 'text',
      group_name: fallback?.group ?? groupName,
      is_active: !!fallback,
      roles: ['sync', 'progress', 'wish-pool'],
      sort_order: i,
    });
  }

  // 4. 写库
  let inserted = 0;
  if (toInsert.length > 0) {
    const { error: insErr } = await supabase.from('bitable_field_map').insert(toInsert);
    if (insErr) return NextResponse.json({ error: `插入失败: ${insErr.message}` }, { status: 500 });
    inserted = toInsert.length;
  }
  let updated = 0;
  for (const u of toUpdate) {
    const { error } = await supabase
      .from('bitable_field_map')
      .update({ field_id: u.field_id, group_name: u.group_name })
      .eq('id', u.id);
    if (!error) updated++;
  }

  return NextResponse.json({
    synced: true,
    inserted,
    updated,
    skipped,
    total_feishu: feishuFields.length,
    total_db_after: (dbRows?.length ?? 0) + inserted,
  });
}