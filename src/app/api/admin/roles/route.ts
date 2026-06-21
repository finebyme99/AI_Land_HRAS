import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { hasPermission } from '@/lib/permissions';
import { PERMISSION_KEYS } from '@/lib/permissions/registry';
import type { RoleWithStats } from '@/types';

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

async function requireAnyPermission(request: NextRequest, permissionKeys: string[]) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) return null;

  for (const permissionKey of permissionKeys) {
    if (await hasPermission(userId, permissionKey)) return { id: userId };
  }

  return null;
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get('scope') === 'options') {
    const user = await requireAnyPermission(request, ['admin.users', 'user.set-roles']);
    if (!user) {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    const { data: roles, error } = await getSupabaseAdmin()
      .from('roles')
      .select('key, label')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: '获取角色失败' }, { status: 500 });
    }

    return NextResponse.json({ roles: roles ?? [] });
  }

  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  const { data: roles, error } = await supabase
    .from('roles')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: '获取角色失败' }, { status: 500 });
  }

  const [{ data: rolePerms }, { data: userRoles }] = await Promise.all([
    supabase.from('role_permissions').select('role_key, permission_key'),
    supabase.from('user_roles').select('role_key'),
  ]);

  const permsByRole: Record<string, string[]> = {};
  for (const rolePermission of rolePerms ?? []) {
    if (!PERMISSION_KEYS.has(rolePermission.permission_key)) continue;
    permsByRole[rolePermission.role_key] ??= [];
    permsByRole[rolePermission.role_key].push(rolePermission.permission_key);
  }

  const countByRole: Record<string, number> = {};
  for (const userRole of userRoles ?? []) {
    countByRole[userRole.role_key] = (countByRole[userRole.role_key] ?? 0) + 1;
  }

  const result: RoleWithStats[] = (roles ?? []).map((role) => {
    const permissions = role.key === 'admin' ? [...PERMISSION_KEYS] : (permsByRole[role.key] ?? []);
    return {
      ...role,
      permissions,
      permission_count: permissions.length,
      user_count: countByRole[role.key] ?? 0,
    };
  });

  return NextResponse.json({ roles: result });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { key, label, description } = body as {
      key?: unknown;
      label?: unknown;
      description?: unknown;
    };

    if (typeof key !== 'string' || typeof label !== 'string' || !key.trim() || !label.trim()) {
      return NextResponse.json({ error: 'key 和 label 必填' }, { status: 400 });
    }

    const normalizedKey = key.trim();
    if (!/^[a-z][a-z0-9_]*$/.test(normalizedKey)) {
      return NextResponse.json({ error: 'key 只能包含小写字母、数字、下划线，且以字母开头' }, { status: 400 });
    }

    const normalizedDescription = typeof description === 'string' && description.trim()
      ? description.trim()
      : null;

    const { data, error } = await getSupabaseAdmin()
      .from('roles')
      .insert({
        key: normalizedKey,
        label: label.trim(),
        description: normalizedDescription,
        is_system: false,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: '角色 key 已存在' }, { status: 409 });
      }
      return NextResponse.json({ error: '创建失败' }, { status: 500 });
    }

    return NextResponse.json({ role: data });
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }
}
