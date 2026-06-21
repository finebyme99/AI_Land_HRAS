import { NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { calcNextSendAt } from '@/lib/reminder-service';

async function requireAdmin(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) return null;
  if (!(await hasPermission(userId, 'admin.reminders'))) return null;
  return { id: userId };
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
  const { title, content, frequency, send_time, send_day, send_date, is_active, targets, user_ids, card_template } = body;

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (title !== undefined) updates.title = title;
  if (content !== undefined) updates.content = content;
  if (is_active !== undefined) updates.is_active = is_active;
  if (card_template !== undefined) updates.card_template = card_template;

  if (frequency !== undefined) {
    updates.frequency = frequency;
    updates.send_time = send_time || '09:00';
    updates.send_day = frequency === 'weekly' ? (send_day || 1) : null;
    updates.send_date = frequency === 'once' ? send_date : null;
    updates.next_send_at = calcNextSendAt(frequency, send_time || '09:00', send_day, send_date).toISOString();
  } else if (send_time !== undefined) {
    updates.send_time = send_time;
    const { data: current } = await getSupabaseAdmin()
      .from('reminders').select('frequency, send_day, send_date').eq('id', id).single();
    if (current) {
      updates.next_send_at = calcNextSendAt(current.frequency, send_time, current.send_day, current.send_date).toISOString();
    }
  }

  const { data: reminder, error } = await getSupabaseAdmin()
    .from('reminders').update(updates).eq('id', id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 更新对象（targets 优先，兼容旧版 user_ids）
  if (Array.isArray(targets) || Array.isArray(user_ids)) {
    const newTargets: Array<{ user_id: string | null; recipient_type: string; recipient_id: string | null }> = [];
    if (Array.isArray(targets)) {
      for (const t of targets) {
        if (!t || (!t.user_id && !t.recipient_id)) continue;
        newTargets.push({
          user_id: t.user_id ?? null,
          recipient_type: t.recipient_type ?? 'user',
          recipient_id: t.recipient_id ?? null,
        });
      }
    } else if (Array.isArray(user_ids)) {
      for (const uid of user_ids) {
        newTargets.push({ user_id: uid, recipient_type: 'user', recipient_id: uid });
      }
    }
    await getSupabaseAdmin().from('reminder_targets').delete().eq('reminder_id', id);
    if (newTargets.length > 0) {
      const { error: tErr } = await getSupabaseAdmin().from('reminder_targets').insert(
        newTargets.map((t) => ({ reminder_id: id, ...t }))
      );
      if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
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
