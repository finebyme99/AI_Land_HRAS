// src/app/api/admin/reminders/logs/route.ts
// 提醒日志查询 API

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// GET /api/admin/reminders/logs
// 获取提醒发送记录
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

  const { searchParams } = request.nextUrl;
  const ruleId = searchParams.get('rule_id');
  const recipientId = searchParams.get('recipient_id');
  const status = searchParams.get('status');
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');

  let query = getSupabaseAdmin()
    .from('reminder_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (ruleId) {
    query = query.eq('rule_id', ruleId);
  }
  if (recipientId) {
    query = query.eq('recipient_id', recipientId);
  }
  if (status) {
    query = query.eq('status', status);
  }
  if (startDate) {
    query = query.gte('created_at', startDate);
  }
  if (endDate) {
    query = query.lte('created_at', endDate);
  }

  const { data: logs, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: '获取日志失败' }, { status: 500 });
  }

  return NextResponse.json({
    logs,
    total: count || 0,
    page,
    limit,
  });
}
