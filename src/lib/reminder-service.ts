// src/lib/reminder-service.ts
// 提醒服务 — 精简版：标题 + 频次 + 时间 + 对象 + 飞书自动发送

import { getSupabaseAdmin } from './supabase-admin';
import { sendFeishuMessage } from './feishu-message';

export interface Reminder {
  id: string;
  title: string;
  content: string;
  frequency: 'once' | 'daily' | 'weekly';
  send_time: string;
  send_day: number | null;
  next_send_at: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReminderTarget {
  id: string;
  reminder_id: string;
  user_id: string;
}

/**
 * 计算下次发送时间
 * @param sendDate - 仅 once 类型使用，格式 "YYYY-MM-DD"，为空则默认明天
 */
export function calcNextSendAt(frequency: string, sendTime: string, sendDay?: number | null, sendDate?: string | null): Date {
  const [h, m] = sendTime.split(':').map(Number);
  const now = new Date();

  if (frequency === 'once') {
    // once: 用指定日期，没指定则默认明天
    const next = sendDate ? new Date(sendDate + 'T00:00:00') : new Date();
    if (!sendDate) next.setDate(next.getDate() + 1);
    next.setHours(h, m, 0, 0);
    return next;
  }

  const next = new Date();
  next.setHours(h, m, 0, 0);

  if (frequency === 'daily') {
    if (next <= now) next.setDate(next.getDate() + 1);
    return next;
  }

  // weekly
  const targetDay = sendDay ?? 1; // 默认周一
  const currentDay = next.getDay() || 7; // 0=周日 → 7
  let daysAhead = targetDay - currentDay;
  if (daysAhead < 0 || (daysAhead === 0 && next <= now)) {
    daysAhead += 7;
  }
  next.setDate(next.getDate() + daysAhead);
  return next;
}

/**
 * 发送单条提醒给指定用户
 */
export async function sendReminderToUser(
  reminderId: string,
  userId: string,
  feishuOpenId: string,
  title: string,
  content: string
): Promise<{ status: string; error?: string }> {
  // 生产环境安全：检查是否已有同批次发送记录（防重复）
  const { data: recentLog } = await getSupabaseAdmin()
    .from('reminder_logs')
    .select('id')
    .eq('reminder_id', reminderId)
    .eq('user_id', userId)
    .gte('sent_at', new Date(Date.now() - 60 * 1000).toISOString()) // 1 分钟内
    .maybeSingle();

  if (recentLog) {
    return { status: 'skipped', error: '1分钟内已发送过' };
  }

  const messageContent = JSON.stringify({ text: `📌 ${title}\n\n${content}` });

  const result = await sendFeishuMessage({
    recipientId: feishuOpenId,
    recipientType: 'open_id',
    messageType: 'text',
    content: messageContent,
  });

  // 记录日志
  await getSupabaseAdmin().from('reminder_logs').insert({
    reminder_id: reminderId,
    user_id: userId,
    feishu_open_id: feishuOpenId,
    status: result.status === 'sent' ? 'sent' : 'failed',
    error_message: result.error || null,
  });

  return { status: result.status, error: result.error };
}

/**
 * 发送预览消息给指定用户（不记录日志，不更新下次发送时间）
 */
export async function sendPreviewToUser(
  feishuOpenId: string,
  title: string,
  content: string
): Promise<{ status: string; error?: string; messageId?: string }> {
  const messageContent = JSON.stringify({ text: `📌 [预览] ${title}\n\n${content}` });

  const result = await sendFeishuMessage({
    recipientId: feishuOpenId,
    recipientType: 'open_id',
    messageType: 'text',
    content: messageContent,
  });

  return { status: result.status, error: result.error, messageId: result.messageId };
}

/**
 * 执行一次提醒发送（供 cron 或手动触发）
 * dryRun=true 时只返回预览，不实际发送
 */
export async function executeReminders(dryRun = false): Promise<{
  total: number;
  sent: number;
  skipped: number;
  failed: number;
  noFeishuId: number;
  details: Array<{ reminderId: string; title: string; userId: string; status: string; error?: string }>;
}> {
  const now = new Date().toISOString();

  // 找到所有到期的活跃提醒
  const { data: dueReminders, error } = await getSupabaseAdmin()
    .from('reminders')
    .select('*')
    .eq('is_active', true)
    .lte('next_send_at', now);

  if (error) throw new Error(`查询提醒失败: ${error.message}`);

  const result = { total: 0, sent: 0, skipped: 0, failed: 0, noFeishuId: 0, details: [] as any[] };

  for (const reminder of dueReminders || []) {
    // 获取提醒对象
    const { data: targets } = await getSupabaseAdmin()
      .from('reminder_targets')
      .select('user_id')
      .eq('reminder_id', reminder.id);

    if (!targets || targets.length === 0) {
      // 无对象，跳过但仍更新下次发送时间
      await updateNextSend(reminder);
      continue;
    }

    // 批量查用户飞书ID
    const userIds = targets.map((t) => t.user_id);
    const { data: users } = await getSupabaseAdmin()
      .from('users')
      .select('id, feishu_open_id, name')
      .in('id', userIds);

    for (const user of users || []) {
      result.total++;

      if (!user.feishu_open_id) {
        result.noFeishuId++;
        result.details.push({
          reminderId: reminder.id,
          title: reminder.title,
          userId: user.id,
          status: 'no_feishu_id',
          error: '用户无飞书ID（可能是外部用户）',
        });
        continue;
      }

      if (dryRun) {
        result.sent++;
        result.details.push({
          reminderId: reminder.id,
          title: reminder.title,
          userId: user.id,
          status: 'dry_run',
        });
        continue;
      }

      const sendResult = await sendReminderToUser(
        reminder.id,
        user.id,
        user.feishu_open_id,
        reminder.title,
        reminder.content
      );

      if (sendResult.status === 'sent') {
        result.sent++;
      } else if (sendResult.status === 'skipped') {
        result.skipped++;
      } else {
        result.failed++;
      }

      result.details.push({
        reminderId: reminder.id,
        title: reminder.title,
        userId: user.id,
        status: sendResult.status,
        error: sendResult.error,
      });
    }

    // 更新下次发送时间
    if (!dryRun) {
      await updateNextSend(reminder);
    }
  }

  return result;
}

/**
 * 更新提醒的下次发送时间
 */
async function updateNextSend(reminder: Reminder) {
  const nextDate = calcNextSendAt(reminder.frequency, reminder.send_time, reminder.send_day);

  // once 类型发送后自动停用
  if (reminder.frequency === 'once') {
    await getSupabaseAdmin()
      .from('reminders')
      .update({ next_send_at: null, is_active: false, updated_at: new Date().toISOString() })
      .eq('id', reminder.id);
  } else {
    await getSupabaseAdmin()
      .from('reminders')
      .update({ next_send_at: nextDate.toISOString(), updated_at: new Date().toISOString() })
      .eq('id', reminder.id);
  }
}
