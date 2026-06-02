// src/app/api/admin/reminders/send/route.ts
// 手动发送提醒 API

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  sendReviewProgressReminder,
  sendDeadlineReminder,
  sendNewSubmissionReminder,
} from '@/lib/reminder-service';

// POST /api/admin/reminders/send
// 手动发送提醒
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
    return NextResponse.json({ error: '仅管理员可发送提醒' }, { status: 403 });
  }

  const body = await request.json();
  const { rule_id, recipient_ids, custom_message } = body;

  if (!rule_id) {
    return NextResponse.json({ error: '缺少规则ID' }, { status: 400 });
  }

  // 获取规则
  const { data: rule, error: ruleError } = await getSupabaseAdmin()
    .from('reminder_rules')
    .select('*')
    .eq('id', rule_id)
    .single();

  if (ruleError || !rule) {
    return NextResponse.json({ error: '规则不存在' }, { status: 404 });
  }

  try {
    let result: { sent: number; failed: number };

    // 根据规则类型发送提醒
    switch (rule.type) {
      case 'review_progress':
        if (!recipient_ids || recipient_ids.length === 0) {
          return NextResponse.json({ error: '请选择接收人' }, { status: 400 });
        }
        result = await sendReviewProgressReminder({
          ruleId: rule_id,
          reviewerIds: recipient_ids,
          pendingCount: 1, // 默认值，实际应该从数据库查询
        });
        break;

      case 'deadline':
        result = await sendDeadlineReminder({
          ruleId: rule_id,
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 默认7天后
          remainingDays: 7,
          submissionCount: 0, // 默认值
        });
        break;

      case 'new_content':
        if (!recipient_ids || recipient_ids.length === 0) {
          return NextResponse.json({ error: '请选择接收人' }, { status: 400 });
        }
        result = await sendNewSubmissionReminder({
          ruleId: rule_id,
          submissionId: 'manual',
          title: custom_message || '新方案提醒',
          submitter: '管理员',
        });
        break;

      default:
        return NextResponse.json({ error: '不支持的规则类型' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : '发送提醒失败',
    }, { status: 500 });
  }
}
