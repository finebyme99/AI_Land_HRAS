// src/app/api/admin/reminders/rules/[id]/route.ts
// 单个提醒规则操作 API

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// GET /api/admin/reminders/rules/:id
// 获取单个提醒规则
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  // 检查管理员权限
  const { data: user } = await getSupabaseAdmin()
    .from('users')
    .select('id, roles')
    .eq('id', userId)
    .single();

  if (!user || !user.roles?.includes('admin')) {
    return NextResponse.json({ error: '仅管理员可访问' }, { status: 403 });
  }

  const { id } = await params;

  const { data: rule, error } = await getSupabaseAdmin()
    .from('reminder_rules')
    .select(`
      *,
      reminder_recipients(*)
    `)
    .eq('id', id)
    .single();

  if (error || !rule) {
    return NextResponse.json({ error: '规则不存在' }, { status: 404 });
  }

  return NextResponse.json({ rule });
}

// PUT /api/admin/reminders/rules/:id
// 更新提醒规则
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  // 检查管理员权限
  const { data: user } = await getSupabaseAdmin()
    .from('users')
    .select('id, roles')
    .eq('id', userId)
    .single();

  if (!user || !user.roles?.includes('admin')) {
    return NextResponse.json({ error: '仅管理员可更新规则' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { name, type, trigger_event, priority, template_id, is_active, recipients } = body;

  // 更新规则
  const { data: rule, error: ruleError } = await getSupabaseAdmin()
    .from('reminder_rules')
    .update({
      name,
      type,
      trigger_event: trigger_event || null,
      priority: priority || 'medium',
      template_id: template_id || null,
      is_active: is_active !== undefined ? is_active : true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (ruleError) {
    return NextResponse.json({ error: '更新规则失败' }, { status: 500 });
  }

  // 更新接收人（先删除旧的，再创建新的）
  if (recipients) {
    await getSupabaseAdmin()
      .from('reminder_recipients')
      .delete()
      .eq('rule_id', id);

    if (recipients.length > 0) {
      const recipientData = recipients.map((r: any) => ({
        rule_id: id,
        recipient_type: r.type,
        recipient_id: r.id,
      }));

      const { error: recipientError } = await getSupabaseAdmin()
        .from('reminder_recipients')
        .insert(recipientData);

      if (recipientError) {
        console.error('更新接收人失败:', recipientError);
      }
    }
  }

  return NextResponse.json({ rule });
}

// DELETE /api/admin/reminders/rules/:id
// 删除提醒规则
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  // 检查管理员权限
  const { data: user } = await getSupabaseAdmin()
    .from('users')
    .select('id, roles')
    .eq('id', userId)
    .single();

  if (!user || !user.roles?.includes('admin')) {
    return NextResponse.json({ error: '仅管理员可删除规则' }, { status: 403 });
  }

  const { id } = await params;

  // 删除规则（级联删除接收人）
  const { error } = await getSupabaseAdmin()
    .from('reminder_rules')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: '删除规则失败' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
