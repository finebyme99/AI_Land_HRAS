import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { executeReminders, sendOneReminderNow, sendPreviewToUser } from '@/lib/reminder-service';

async function requireAdmin(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) return null;
  const { data: user } = await getSupabaseAdmin()
    .from('users').select('id, name, roles, feishu_open_id').eq('id', userId).single();
  if (!user || !user.roles?.includes('admin')) return null;
  return user;
}

// POST — 手动触发
// ?mode=preview              → 发预览给管理员自己
// ?mode=send                 → 发送所有到期的活跃提醒（按 next_send_at）
// ?mode=send&id=<reminderId> → 立即发指定 reminder（绕过 next_send_at，按配置 targets 实时派发）
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: '仅管理员可操作' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode') || 'send';
  const id = searchParams.get('id');

  try {
    if (mode === 'preview') {
      // 预览：取第一条活跃提醒，发给管理员自己
      if (!admin.feishu_open_id) {
        return NextResponse.json({ error: '你（管理员）没有飞书ID，无法预览' }, { status: 400 });
      }

      const { data: reminder } = await getSupabaseAdmin()
        .from('reminders')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!reminder) {
        return NextResponse.json({ error: '没有活跃的提醒可预览' }, { status: 400 });
      }

      const result = await sendPreviewToUser(
        admin.feishu_open_id,
        reminder.title,
        reminder.content
      );

      return NextResponse.json({
        mode: 'preview',
        reminder_title: reminder.title,
        sent_to: admin.name || admin.id,
        ...result,
      });
    }

    if (mode === 'send' && id) {
      // 立即发指定 reminder（绕过 next_send_at，不动下次时间）
      const result = await sendOneReminderNow(id, false);
      if (!result.found) {
        return NextResponse.json({ error: 'reminder 不存在' }, { status: 404 });
      }
      if (!result.active) {
        return NextResponse.json({ error: 'reminder 已停用' }, { status: 400 });
      }
      return NextResponse.json({ mode: 'send-one', ...result });
    }

    // 实际发送：所有到期的活跃提醒
    const result = await executeReminders(false);
    return NextResponse.json({ mode: 'send', ...result });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : '发送失败',
    }, { status: 500 });
  }
}

// GET — Vercel Cron 自动触发（无需登录，靠 CRON_SECRET 验证）
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await executeReminders(false);
    return NextResponse.json({ mode: 'cron', ...result });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Cron 执行失败',
    }, { status: 500 });
  }
}
