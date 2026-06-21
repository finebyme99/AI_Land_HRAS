import { NextRequest, NextResponse } from 'next/server';
import { clearPermissionsCache } from '@/lib/permissions';
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  const { key } = await params;

  try {
    const body = await request.json();
    const { label, description } = body as {
      label?: unknown;
      description?: unknown;
    };

    const updates: { label?: string; description?: string | null } = {};
    if (label !== undefined) {
      if (typeof label !== 'string' || !label.trim()) {
        return NextResponse.json({ error: 'label 不能为空' }, { status: 400 });
      }
      updates.label = label.trim();
    }
    if (description !== undefined) {
      updates.description = typeof description === 'string' && description.trim()
        ? description.trim()
        : null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: '无更新字段' }, { status: 400 });
    }

    const { data, error } = await getSupabaseAdmin()
      .from('roles')
      .update(updates)
      .eq('key', key)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: '更新失败或角色不存在' }, { status: 404 });
    }

    return NextResponse.json({ role: data });
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  const { key } = await params;
  const supabase = getSupabaseAdmin();

  const { data: role } = await supabase
    .from('roles')
    .select('is_system')
    .eq('key', key)
    .single();

  if (!role) {
    return NextResponse.json({ error: '角色不存在' }, { status: 404 });
  }

  if (role.is_system) {
    return NextResponse.json({ error: '系统角色不可删除' }, { status: 400 });
  }

  const { data: assignedUsers } = await supabase
    .from('users')
    .select('id, roles')
    .contains('roles', [key]);

  const { error } = await supabase
    .from('roles')
    .delete()
    .eq('key', key);

  if (error) {
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }

  for (const user of assignedUsers ?? []) {
    const nextRoles = (user.roles ?? []).filter((roleKey: string) => roleKey !== key);
    await supabase
      .from('users')
      .update({ roles: nextRoles.length > 0 ? nextRoles : ['user'] })
      .eq('id', user.id);
  }

  clearPermissionsCache();
  return NextResponse.json({ success: true });
}
