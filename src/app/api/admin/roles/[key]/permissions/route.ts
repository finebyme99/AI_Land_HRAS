import { NextRequest, NextResponse } from 'next/server';
import { clearPermissionsCache } from '@/lib/permissions';
import { PERMISSION_KEYS } from '@/lib/permissions/registry';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

async function requireAdmin(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) return null;

  const { data: user } = await getSupabaseAdmin()
    .from('users')
    .select('id, roles')
    .eq('id', userId)
    .single();

  if (!user || !user.roles?.includes('admin')) return null;
  return user;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  const { key } = await params;

  if (key === 'admin') {
    return NextResponse.json({ success: true, skipped: true });
  }

  try {
    const body = await request.json();
    const { permissionKeys } = body as { permissionKeys?: unknown };

    if (!Array.isArray(permissionKeys)) {
      return NextResponse.json({ error: 'permissionKeys 必须是数组' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: role } = await supabase
      .from('roles')
      .select('key')
      .eq('key', key)
      .single();

    if (!role) {
      return NextResponse.json({ error: '角色不存在' }, { status: 404 });
    }

    const validKeys = [...new Set(
      permissionKeys.filter((permissionKey): permissionKey is string => (
        typeof permissionKey === 'string' && PERMISSION_KEYS.has(permissionKey)
      )),
    )];

    const { error: deleteError } = await supabase
      .from('role_permissions')
      .delete()
      .eq('role_key', key);

    if (deleteError) {
      return NextResponse.json({ error: '保存失败' }, { status: 500 });
    }

    if (validKeys.length > 0) {
      const { error: insertError } = await supabase
        .from('role_permissions')
        .insert(validKeys.map((permissionKey) => ({ role_key: key, permission_key: permissionKey })));

      if (insertError) {
        return NextResponse.json({ error: '保存失败' }, { status: 500 });
      }
    }

    clearPermissionsCache();
    return NextResponse.json({ success: true, count: validKeys.length });
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }
}
