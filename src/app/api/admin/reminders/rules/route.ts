// src/app/api/admin/reminders/rules/route.ts
// 提醒规则管理 API

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// GET /api/admin/reminders/rules
// 获取所有提醒规则
export async function GET(request: NextRequest) {
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

  const { data: rules, error } = await getSupabaseAdmin()
    .from('reminder_rules')
    .select(`
      *,
      reminder_recipients(*)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: '获取提醒规则失败' }, { status: 500 });
  }

  return NextResponse.json({ rules });
}

// POST /api/admin/reminders/rules
// 创建提醒规则
export async function POST(request: NextRequest) {
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
    return NextResponse.json({ error: '仅管理员可创建规则' }, { status: 403 });
  }

  const body = await request.json();
  const { name, type, trigger_event, priority, template_id, recipients } = body;

  if (!name || !type) {
    return NextResponse.json({ error: '缺少必填字段' }, { status: 400 });
  }

  // 创建规则
  const { data: rule, error: ruleError } = await getSupabaseAdmin()
    .from('reminder_rules')
    .insert({
      name,
      type,
      trigger_event: trigger_event || null,
      priority: priority || 'medium',
      template_id: template_id || null,
      is_active: true,
      created_by: userId,
    })
    .select()
    .single();

  if (ruleError) {
    return NextResponse.json({ error: '创建规则失败' }, { status: 500 });
  }

  // 创建接收人
  if (recipients && recipients.length > 0) {
    const recipientData = recipients.map((r: any) => ({
      rule_id: rule.id,
      recipient_type: r.type,
      recipient_id: r.id,
    }));

    const { error: recipientError } = await getSupabaseAdmin()
      .from('reminder_recipients')
      .insert(recipientData);

    if (recipientError) {
      console.error('创建接收人失败:', recipientError);
    }
  }

  return NextResponse.json({ rule });
}
