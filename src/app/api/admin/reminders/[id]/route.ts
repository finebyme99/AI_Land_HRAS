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

// GET — 单条详情
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: '仅管理员可访问' }, { status: 403 });

  const { id } = await params;
  const { data, error } = await getSupabaseAdmin()
    .from('reminders')
    .select(`*, reminder_targets(id, user_id, users(name, feishu_open_id))`)
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: '提醒不存在' }, { status: 404 });
  return NextResponse.json({ reminder: data });
}

// PUT — 更新
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: '仅管理员可编辑' }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const { title, content, frequency, send_time, send_day, is_active, user_ids } = body;

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (title !== undefined) updates.title = title;
  if (content !== undefined) updates.content = content;
  if (is_active !== undefined) updates.is_active = is_active;

  if (frequency !== undefined) {
    updates.frequency = frequency;
    updates.send_time = send_time || '09:00';
    updates.send_day = frequency === 'weekly' ? (send_day || 1) : null;
    updates.next_send_at = calcNextSendAt(frequency, send_time || '09:00', send_day).toISOString();
  } else if (send_time !== undefined) {
    updates.send_time = send_time;
    // 重新获取当前 frequency 来算 next_send_at
    const { data: current } = await getSupabaseAdmin()
      .from('reminders').select('frequency, send_day').eq('id', id).single();
    if (current) {
      updates.next_send_at = calcNextSendAt(current.frequency, send_time, current.send_day).toISOString();
    }
  }

  const { data: reminder, error } = await getSupabaseAdmin()
    .from('reminders').update(updates).eq('id', id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 更新对象
  if (user_ids !== undefined) {
    await getSupabaseAdmin().from('reminder_targets').delete().eq('reminder_id', id);
    if (user_ids.length > 0) {
      const targets = user_ids.map((uid: string) => ({ reminder_id: id, user_id: uid }));
      await getSupabaseAdmin().from('reminder_targets').insert(targets);
    }
  }

  return NextResponse.json({ reminder });
}

// DELETE — 删除
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: '仅管理员可删除' }, { status: 403 });

  const { id } = await params;
  const { error } = await getSupabaseAdmin().from('reminders').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
