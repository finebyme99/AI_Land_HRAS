import { NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/permissions';
import { hasDepartmentSelection, normalizeDepartmentInput } from '@/lib/resources/departments';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/** GET /api/resources/admin — 管理员获取全部资源（含待审核） */
export async function GET(req: NextRequest) {
  const userId = req.cookies.get('feishu_user_id')?.value;
  if (!userId) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  if (!(await hasPermission(userId, 'resource.review'))) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('apps')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ resources: data ?? [] });
}

/** PUT /api/resources/admin — 管理员编辑资源 */
export async function PUT(req: NextRequest) {
  const userId = req.cookies.get('feishu_user_id')?.value;
  if (!userId) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const db = getSupabaseAdmin();

  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: '缺少资源 ID' }, { status: 400 });
  if ('applicable_departments' in updates && !hasDepartmentSelection(updates.applicable_departments)) {
    return NextResponse.json({ error: '请选择适用部门' }, { status: 400 });
  }

  const canReview = await hasPermission(userId, 'resource.review');
  if (!canReview) {
    const { data: resource } = await db
      .from('apps')
      .select('author_id')
      .eq('id', id)
      .single();
    if (!resource || resource.author_id !== userId) {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }
  }

  // 只允许更新指定字段
  const allowedFields = ['name', 'description', 'content', 'category', 'scenarios', 'applicable_departments', 'official_url', 'logo', 'status'];
  const filtered: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in updates) {
      filtered[key] = key === 'applicable_departments'
        ? normalizeDepartmentInput(updates[key])
        : updates[key];
    }
  }
  filtered['updated_at'] = new Date().toISOString();

  const { data, error } = await db
    .from('apps')
    .update(filtered)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
