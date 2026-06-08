import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import bcrypt from 'bcryptjs';

// 验证当前用户是否为 admin
async function requireAdmin(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) return null;

  const { data: user } = await getSupabaseAdmin()
    .from('users')
    .select('id, roles')
    .eq('id', userId)
    .single();

  if (!user || !user.roles?.some((r: string) => ['admin', 'moderator'].includes(r))) return null;
  return user;
}

// GET /api/admin/users — 获取所有用户列表
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  try {
    const { data: users, error } = await getSupabaseAdmin()
      .from('users')
      .select('id, feishu_open_id, username, name, avatar, department, employee_id, roles, reviewer_roles, bio, points, level, created_at, last_active_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ users });
  } catch {
    return NextResponse.json({ error: '获取用户列表失败' }, { status: 500 });
  }
}

// PATCH /api/admin/users — 修改用户角色
export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  try {
    const { userId, roles, reviewer_roles } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }

    // 不能修改自己的角色
    if (userId === admin.id) {
      return NextResponse.json({ error: '不能修改自己的角色' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (roles) {
      const validRoles = ['user', 'contributor', 'reviewer', 'course_admin', 'moderator', 'admin'];
      if (!Array.isArray(roles) || !roles.every((r: string) => validRoles.includes(r))) {
        return NextResponse.json({ error: '无效角色' }, { status: 400 });
      }
      updateData.roles = roles;
    }
    if (reviewer_roles !== undefined) {
      const validReviewerRoles = ['user', 'business', 'tech'];
      if (!Array.isArray(reviewer_roles) || !reviewer_roles.every((r: string) => validReviewerRoles.includes(r))) {
        return NextResponse.json({ error: '无效评委角色' }, { status: 400 });
      }
      updateData.reviewer_roles = reviewer_roles;
    }

    const { data: user, error } = await getSupabaseAdmin()
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select('id, name, avatar, department, roles, reviewer_roles, points, level, created_at')
      .single();

    if (error) throw error;

    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: '修改角色失败' }, { status: 500 });
  }
}

// POST /api/admin/users — 批量更新用户角色
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  try {
    const { userIds, action, reviewerRoles } = await request.json();

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: '缺少用户 ID 列表' }, { status: 400 });
    }

    if (!['add_reviewer', 'remove_reviewer', 'set_reviewer_roles', 'clear_reviewer_roles'].includes(action)) {
      return NextResponse.json({ error: '无效操作' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    let success = 0;
    let failed = 0;
    const details: string[] = [];

    for (const userId of userIds) {
      try {
        // 获取当前用户角色
        const { data: userData, error: fetchError } = await supabase
          .from('users')
          .select('id, name, roles')
          .eq('id', userId)
          .single();

        if (fetchError || !userData) {
          failed++;
          details.push(`${userId}: 用户不存在`);
          continue;
        }

        // 不能修改自己的角色
        if (userId === admin.id) {
          failed++;
          details.push(`${userData.name}: 不能修改自己的角色`);
          continue;
        }

        let updateData: Record<string, unknown> = {};

        if (action === 'add_reviewer') {
          // 兼容旧逻辑：添加 reviewer 角色
          let newRoles = [...(userData.roles || [])];
          if (!newRoles.includes('reviewer')) newRoles.push('reviewer');
          updateData = { roles: newRoles };
        } else if (action === 'remove_reviewer') {
          // 兼容旧逻辑：移除 reviewer 角色
          let newRoles = (userData.roles || []).filter((r: string) => r !== 'reviewer');
          updateData = { roles: newRoles };
        } else if (action === 'set_reviewer_roles') {
          // 新逻辑：设置具体的评委角色
          if (!Array.isArray(reviewerRoles)) {
            failed++;
            details.push(`${userData.name}: 缺少 reviewerRoles 参数`);
            continue;
          }
          updateData = { reviewer_roles: reviewerRoles };
        } else if (action === 'clear_reviewer_roles') {
          // 新逻辑：清空评委角色
          updateData = { reviewer_roles: [] };
        }

        const { error: updateError } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', userId);

        if (updateError) {
          failed++;
          details.push(`${userData.name}: 更新失败`);
        } else {
          success++;
        }
      } catch {
        failed++;
        details.push(`${userId}: 操作异常`);
      }
    }

    return NextResponse.json({ success, failed, details });
  } catch {
    return NextResponse.json({ error: '批量操作失败' }, { status: 500 });
  }
}

// PUT /api/admin/users — 重置用户密码
export async function PUT(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  try {
    const { userId, newPassword } = await request.json();

    if (!userId || !newPassword) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: '密码至少6位' }, { status: 400 });
    }

    // 检查用户是否有 username（注册用户才有密码）
    const { data: targetUser, error: fetchError } = await getSupabaseAdmin()
      .from('users')
      .select('id, name, username')
      .eq('id', userId)
      .single();

    if (fetchError || !targetUser) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    if (!targetUser.username) {
      return NextResponse.json({ error: '飞书用户没有密码，无法重置' }, { status: 400 });
    }

    // bcrypt hash 新密码并更新
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const { error: updateError } = await getSupabaseAdmin()
      .from('users')
      .update({ password_hash: passwordHash })
      .eq('id', userId);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, message: '密码重置成功' });
  } catch (err) {
    console.error('重置密码失败:', err);
    return NextResponse.json({ error: '重置密码失败' }, { status: 500 });
  }
}
