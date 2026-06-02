import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { calcNextSendAt } from '@/lib/reminder-service';

async function requireAdmin(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) return null;
  const { data: user } = await getSupabaseAdmin()
    .from('users').select('id, roles').eq('id', userId).single();
  if (!user || !user.roles?.includes('admin')) return null;
  return user;
}

// GET — 列表（含对象和最近日志）
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: '仅管理员可访问' }, { status: 403 });

  const { data, error } = await getSupabaseAdmin()
    .from('reminders')
    .select(`
      *,
      reminder_targets(id, user_id, users(name, feishu_open_id)),
      reminder_logs(id, user_id, status, error_message, sent_at)
    `)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reminders: data || [] });
}

// POST — 创建提醒
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: '仅管理员可创建' }, { status: 403 });

  const body = await request.json();
  const { title, content, frequency, send_time, send_day, send_date, user_ids } = body;

  if (!title || !frequency || !send_time) {
    return NextResponse.json({ error: '缺少必填字段' }, { status: 400 });
  }
  if (frequency === 'once' && !send_date) {
    return NextResponse.json({ error: '仅一次类型需要选择发送日期' }, { status: 400 });
  }
  if (user_ids && !Array.isArray(user_ids)) {
    return NextResponse.json({ error: 'user_ids 应为数组' }, { status: 400 });
  }

  const nextSendAt = calcNextSendAt(frequency, send_time, send_day, send_date);

  const { data: reminder, error } = await getSupabaseAdmin()
    .from('reminders')
    .insert({
      title,
      content: content || '',
      frequency,
      send_time,
      send_day: frequency === 'weekly' ? send_day || 1 : null,
      send_date: frequency === 'once' ? send_date : null,
      next_send_at: nextSendAt.toISOString(),
      is_active: true,
      created_by: admin.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 创建对象关联
  if (user_ids && user_ids.length > 0) {
    const targets = user_ids.map((uid: string) => ({
      reminder_id: reminder.id,
      user_id: uid,
    }));
    await getSupabaseAdmin().from('reminder_targets').insert(targets);
  }

  return NextResponse.json({ reminder });
}
