import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { FALLBACK_FIELD_MAP, type FieldType, type FieldMapEntry } from '@/lib/bitable/field-map';

const VALID_TYPES: FieldType[] = ['text', 'number', 'select', 'multi_select', 'person', 'formula', 'date', 'url'];

async function requireAdmin(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) return null;
  const { data: user } = await getSupabaseAdmin()
    .from('users').select('id, roles').eq('id', userId).single();
  if (!user || !user.roles?.some((r: string) => ['admin', 'moderator'].includes(r))) return null;
  return user;
}

/**
 * GET /api/admin/bitable-field-map?base_app=xxx&table_id=xxx
 *
 * 返回该飞书表的所有字段映射记录 + 与飞书 schema 的 diff：
 *   - db records:    DB 已有的字段（含 is_active=false 的）
 *   - feishuFields:  飞书实际有但 DB 没的（status: 'new'）
 *   - codeOnly:      硬编码 fallback 里有但飞书表里没有的（status: 'orphan'，可能是字段被删了）
 *   - matched:       飞书有 + DB 也有 + 飞书有 field_id 的（status: 'synced'）
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: '仅管理员可访问' }, { status: 403 });

  const baseApp = request.nextUrl.searchParams.get('base_app');
  const tableId = request.nextUrl.searchParams.get('table_id');
  if (!baseApp || !tableId) {
    return NextResponse.json({ error: '缺少 base_app 或 table_id' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // 1. 从 DB 读映射
  const { data: dbRows, error: dbErr } = await supabase
    .from('bitable_field_map')
    .select('*')
    .eq('base_app', baseApp)
    .eq('table_id', tableId)
    .order('sort_order', { ascending: true })
    .order('field_name', { ascending: true });
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  // 2. 从飞书读 schema（用动态 import 避免循环依赖）
  const { getTenantAccessTokenFor } = await import('@/lib/feishu');
  const feishuSchema = await fetchFeishuSchema(baseApp, tableId, getTenantAccessTokenFor);

  // 3. Diff 计算
  interface DBFieldRow {
    id?: string;
    field_id: string | null;
    field_name: string;
    key: string;
    type: string;
    group_name: string;
    is_active: boolean;
    roles: string[];
    sort_order: number;
    created_at?: string;
    updated_at?: string;
  }
  const dbByFieldName = new Map<string, DBFieldRow>();
  for (const row of (dbRows ?? []) as unknown as DBFieldRow[]) {
    dbByFieldName.set(row.field_name, row);
  }
  const feishuByFieldName = new Map<string, { field_id: string; type: number; group_id: string; group_name: string }>();
  for (const f of feishuSchema.fields) {
    feishuByFieldName.set(f.field_name, f);
  }
  const codeByKey = new Map<string, { feishuName: string; entry: FieldMapEntry }>();
  for (const [name, entry] of Object.entries(FALLBACK_FIELD_MAP)) {
    codeByKey.set(entry.key, { feishuName: name, entry });
  }

  // 拼装记录（每个飞书字段一条）
  const records: Array<{
    id?: string;
    field_id: string | null;
    field_name: string;
    key: string;
    type: string;
    group_name: string;
    is_active: boolean;
    roles: string[];
    sort_order: number;
    created_at?: string;
    updated_at?: string;
    status: 'synced' | 'new' | 'orphan' | 'inactive';
    feishuType?: number;
  }> = [];

  // 先把飞书有的字段加进来
  for (const f of feishuSchema.fields) {
    const dbRow = dbByFieldName.get(f.field_name);
    if (dbRow) {
      records.push({
        ...dbRow,
        status: dbRow.is_active ? 'synced' : 'inactive',
        feishuType: f.type,
      });
    } else {
      // DB 还没有这条 — 从硬编码 fallback 里猜 key 和 type
      const fallback = FALLBACK_FIELD_MAP[f.field_name];
      records.push({
        field_id: f.field_id,
        field_name: f.field_name,
        key: fallback?.key ?? `unknown_${f.field_id.slice(0, 8)}`,
        type: fallback?.type ?? 'text',
        group_name: fallback?.group ?? f.group_name ?? '未分组',
        is_active: !!fallback,
        roles: ['sync', 'progress', 'wish-pool'],
        sort_order: records.length,
        status: 'new',
        feishuType: f.type,
      });
    }
  }
  // 再把 DB 有但飞书已经删的字段标 orphan
  for (const [name, row] of dbByFieldName.entries()) {
    if (!feishuByFieldName.has(name)) {
      const existing = records.find((r) => r.field_name === name);
      if (existing) {
        existing.status = 'orphan';
      } else {
        records.push({
          ...row,
          status: 'orphan',
        });
      }
    }
  }

  return NextResponse.json({
    base_app: baseApp,
    table_id: tableId,
    records,
    feishuFields: feishuSchema.fields,
    stats: {
      total: records.length,
      synced: records.filter((r) => r.status === 'synced').length,
      new: records.filter((r) => r.status === 'new').length,
      orphan: records.filter((r) => r.status === 'orphan').length,
      inactive: records.filter((r) => r.status === 'inactive').length,
    },
  });
}

/** POST /api/admin/bitable-field-map
 *  body: { base_app, table_id, field_id?, field_name, key, type, group_name?, is_active?, roles?, sort_order? }
 *  用于手动添加或批量补全
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: '仅管理员可访问' }, { status: 403 });

  const body = await request.json();
  const { base_app, table_id, field_id = null, field_name, key, type, group_name = '未分组', is_active = true, roles = ['sync', 'progress', 'wish-pool'], sort_order = 0 } = body;
  if (!base_app || !table_id || !field_name || !key || !type) {
    return NextResponse.json({ error: '缺少必填字段' }, { status: 400 });
  }
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: `type 必须是 ${VALID_TYPES.join('|')} 之一` }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('bitable_field_map')
    .insert({ base_app, table_id, field_id, field_name, key, type, group_name, is_active, roles, sort_order })
    .select()
    .single();
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: '该字段已存在（同名或同 key）' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ record: data });
}

async function fetchFeishuSchema(
  baseApp: string,
  tableId: string,
  getTenantAccessTokenFor: (appId: string, appSecret: string) => Promise<string>,
): Promise<{
  fields: Array<{ field_id: string; field_name: string; type: number; group_id: string; group_name: string }>;
  error?: string;
}> {
  try {
    const supabase = getSupabaseAdmin();
    const { data: app } = await supabase.from('feishu_apps').select('app_id, app_secret').eq('app_id', 'cli_a84a9ed9597fd01c').single();
    if (!app) return { fields: [], error: '未找到 ZT 飞书应用' };
    const token = await getTenantAccessTokenFor(app.app_id, app.app_secret);

    const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${baseApp}/tables/${tableId}/fields?page_size=100`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    if (!res.ok || json.code !== 0) return { fields: [], error: json.msg ?? res.status.toString() };
    return {
      fields: (json.data?.items ?? []).map((f: Record<string, unknown>) => ({
        field_id: (f.field_id as string) ?? '',
        field_name: (f.field_name as string) ?? '',
        type: (f.type as number) ?? 0,
        group_id: (f.group_id as string) ?? '',
        group_name: (f.group_name as string) ?? '未分组',
      })),
    };
  } catch (e) {
    return { fields: [], error: String(e) };
  }
}