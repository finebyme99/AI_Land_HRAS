import { NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

async function requireAdmin(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) return null;
  if (!(await hasPermission(userId, 'admin.reminders'))) return null;
  return { id: userId };
}

// GET — 获取已注册用户列表（供选择提醒对象）
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: '仅管理员可访问' }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const [{ data: users, error }, { data: roles, error: rolesError }] = await Promise.all([
    supabase
      .from('users')
      .select('id, name, feishu_open_id, roles')
      .order('name'),
    supabase
      .from('roles')
      .select('key, label')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 标记是否有飞书ID
  const result = (users || []).map((u) => ({
    id: u.id,
    name: u.name || '(未命名)',
    has_feishu: !!u.feishu_open_id,
    roles: u.roles || [],
  }));

  const legacyLabels: Record<string, string> = {
    admin: '管理员',
    user: '普通用户',
    reviewer: '评委',
    contributor: '贡献者',
  };
  const roleOptions = rolesError
    ? [...new Set(result.flatMap((u) => u.roles))].map((key) => ({
      key,
      label: legacyLabels[key] ?? key,
    }))
    : (roles || []).map((role) => ({
      key: role.key,
      label: role.label,
    }));

  return NextResponse.json({ users: result, roles: roleOptions });
}
