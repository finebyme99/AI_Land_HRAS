import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import type { FieldType } from '@/lib/bitable/field-map';

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
 * PATCH /api/admin/bitable-field-map/[id]
 * body: 部分字段 — { key?, type?, group_name?, is_active?, roles?, sort_order?, field_id?, field_name? }
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: '仅管理员可访问' }, { status: 403 });

  const { id } = await params;
  const body = await request.json();

  // 白名单 + 类型校验
  const update: Record<string, unknown> = {};
  if (typeof body.key === 'string') update.key = body.key;
  if (typeof body.type === 'string') {
    if (!VALID_TYPES.includes(body.type)) {
      return NextResponse.json({ error: `type 必须是 ${VALID_TYPES.join('|')} 之一` }, { status: 400 });
    }
    update.type = body.type;
  }
  if (typeof body.group_name === 'string') update.group_name = body.group_name;
  if (typeof body.is_active === 'boolean') update.is_active = body.is_active;
  if (Array.isArray(body.roles)) update.roles = body.roles.filter((r: unknown) => typeof r === 'string');
  if (typeof body.sort_order === 'number') update.sort_order = body.sort_order;
  if (typeof body.field_id === 'string') update.field_id = body.field_id;
  if (typeof body.field_name === 'string') update.field_name = body.field_name;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: '没有可更新的字段' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('bitable_field_map')
    .update(update)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: '该字段名或 key 已被另一条记录占用' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ record: data });
}

/**
 * DELETE /api/admin/bitable-field-map/[id]
 * 删除一条映射（不影响飞书原表，只是停止消费该字段）
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: '仅管理员可访问' }, { status: 403 });

  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('bitable_field_map').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}