// src/lib/reminder-service.ts
// 提醒服务 — 精简版：标题 + 频次 + 时间 + 对象 + 飞书自动发送

import { getSupabaseAdmin } from './supabase-admin';
import { sendFeishuMessage, sendFeishuCardMessage } from './feishu-message';

export interface Reminder {
  id: string;
  title: string;
  content: string;
  frequency: 'once' | 'daily' | 'weekly';
  send_time: string;
  send_day: number | null;
  next_send_at: string | null;
  is_active: boolean;
  card_template: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type RecipientType = 'user' | 'role' | 'chat_id';

export interface ReminderTarget {
  id: string;
  reminder_id: string;
  user_id: string | null;
  recipient_type: RecipientType;
  recipient_id: string | null;
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = { total: 0, sent: 0, skipped: 0, failed: 0, noFeishuId: 0, details: [] as any[] };

  for (const reminder of dueReminders || []) {
    // 获取提醒对象（含 recipient_type）
    const { data: targets } = await getSupabaseAdmin()
      .from('reminder_targets')
      .select('user_id, recipient_type, recipient_id')
      .eq('reminder_id', reminder.id);

    if (!targets || targets.length === 0) {
      // 无对象，跳过但仍更新下次发送时间
      await updateNextSend(reminder);
      continue;
    }

    // 逐个 target 派发：user / role / chat_id
    for (const target of targets) {
      const rType = (target.recipient_type as RecipientType) ?? 'user';
      const rId = target.recipient_id ?? target.user_id;
      if (!rId) continue;

      if (rType === 'chat_id') {
        // 群聊推送：直接发到 chat_id
        result.total++;
        const sendResult = await sendToRecipient(
          reminder, rId, 'chat_id', dryRun, { chatId: rId },
        );
        tally(result, sendResult, reminder, rId);
        continue;
      }

      if (rType === 'role') {
        // 角色：展开为该 role 的所有用户
        const { data: roleUsers } = await getSupabaseAdmin()
          .from('users')
          .select('id, feishu_open_id, name')
          .contains('roles', [rId]);
        if (!roleUsers || roleUsers.length === 0) {
          result.details.push({
            reminderId: reminder.id, title: reminder.title, userId: rId,
            status: 'no_users', error: `角色 ${rId} 下无用户`,
          });
          continue;
        }
        for (const u of roleUsers) {
          result.total++;
          const sendResult = await sendToRecipient(
            reminder, u.id, 'user', dryRun, { feishuOpenId: u.feishu_open_id, userId: u.id },
          );
          tally(result, sendResult, reminder, u.id);
        }
        continue;
      }

      // rType === 'user'
      const { data: user } = await getSupabaseAdmin()
        .from('users')
        .select('id, feishu_open_id, name')
        .eq('id', rId)
        .maybeSingle();
      if (!user) {
        result.details.push({
          reminderId: reminder.id, title: reminder.title, userId: rId,
          status: 'user_not_found', error: '用户不存在',
        });
        continue;
      }
      result.total++;
      const sendResult = await sendToRecipient(
        reminder, user.id, 'user', dryRun, { feishuOpenId: user.feishu_open_id, userId: user.id },
      );
      tally(result, sendResult, reminder, user.id);
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

/**
 * 发送单条提醒给一个具体收件人（user / chat_id）
 * 有 card_template 走卡片，否则走文本
 */
async function sendToRecipient(
  reminder: Reminder,
  refId: string,
  kind: 'user' | 'chat_id',
  dryRun: boolean,
  ctx: { feishuOpenId?: string | null; userId?: string; chatId?: string },
): Promise<{ status: string; error?: string; messageId?: string }> {
  if (kind === 'user' && !ctx.feishuOpenId) {
    return { status: 'no_feishu_id', error: '用户无飞书ID' };
  }

  if (dryRun) return { status: 'dry_run' };

  // 1 分钟去重
  const logQuery = getSupabaseAdmin()
    .from('reminder_logs')
    .select('id')
    .eq('reminder_id', reminder.id);
  if (ctx.userId) logQuery.eq('user_id', ctx.userId);
  if (ctx.chatId) logQuery.eq('feishu_open_id', ctx.chatId);
  const { data: recent } = await logQuery
    .gte('sent_at', new Date(Date.now() - 60 * 1000).toISOString())
    .maybeSingle();
  if (recent) return { status: 'skipped', error: '1分钟内已发送过' };

  let res;
  if (reminder.card_template) {
    // 飞书卡片
    res = await sendFeishuCardMessage(
      ctx.feishuOpenId ?? ctx.chatId ?? '',
      kind === 'chat_id' ? 'chat_id' : 'open_id',
      reminder.card_template as object,
    );
  } else {
    // 文本
    const text = `📌 ${reminder.title}\n\n${reminder.content}`;
    res = await sendFeishuMessage({
      recipientId: ctx.feishuOpenId ?? ctx.chatId ?? '',
      recipientType: kind === 'chat_id' ? 'chat_id' : 'open_id',
      messageType: 'text',
      content: JSON.stringify({ text }),
    });
  }

  // 写日志
  await getSupabaseAdmin().from('reminder_logs').insert({
    reminder_id: reminder.id,
    user_id: ctx.userId ?? null,
    feishu_open_id: kind === 'user' ? ctx.feishuOpenId : ctx.chatId ?? null,
    status: res.status === 'sent' ? 'sent' : 'failed',
    error_message: res.error ?? null,
  });

  return { status: res.status, error: res.error, messageId: res.messageId };
}

/**
 * 把单条发送结果累加到 result 汇总里
 */
function tally(
  result: {
    sent: number;
    skipped: number;
    failed: number;
    noFeishuId: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    details: any[];
  },
  sendResult: { status: string; error?: string },
  reminder: Reminder,
  refId: string,
) {
  if (sendResult.status === 'sent' || sendResult.status === 'dry_run') {
    result.sent++;
  } else if (sendResult.status === 'skipped') {
    result.skipped++;
  } else if (sendResult.status === 'no_feishu_id') {
    result.noFeishuId++;
  } else {
    result.failed++;
  }
  result.details.push({
    reminderId: reminder.id,
    title: reminder.title,
    userId: refId,
    status: sendResult.status,
    error: sendResult.error,
  });
}
