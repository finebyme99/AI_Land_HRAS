// src/lib/reminder-service.ts
// 提醒服务 - 处理提醒规则、发送逻辑

import { getSupabaseAdmin } from './supabase-admin';
import {
  sendFeishuCardMessage,
  sendFeishuMessage,
  buildReviewReminderCard,
  buildDeadlineReminderCard,
  renderTemplate,
  type MessageResponse,
} from './feishu-message';

export interface ReminderRule {
  id: string;
  name: string;
  type: string;
  trigger_event: string | null;
  priority: string;
  template_id: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReminderRecipient {
  id: string;
  rule_id: string;
  recipient_type: string;
  recipient_id: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  type: string;
  title_template: string | null;
  content_template: string;
  card_template: object | null;
}

export interface ReminderLog {
  id: string;
  rule_id: string | null;
  recipient_id: string;
  recipient_type: string;
  message_id: string | null;
  status: string;
  priority: string | null;
  error_message: string | null;
  sent_at: string | null;
  read_at: string | null;
  created_at: string;
}

/**
 * 获取所有活跃的提醒规则
 */
export async function getActiveReminderRules(): Promise<ReminderRule[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('reminder_rules')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`获取提醒规则失败: ${error.message}`);
  return data || [];
}

/**
 * 根据触发事件获取提醒规则
 */
export async function getReminderRulesByEvent(event: string): Promise<ReminderRule[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('reminder_rules')
    .select('*')
    .eq('is_active', true)
    .eq('trigger_event', event)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`获取提醒规则失败: ${error.message}`);
  return data || [];
}

/**
 * 获取规则的接收人列表
 */
export async function getRuleRecipients(ruleId: string): Promise<ReminderRecipient[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('reminder_recipients')
    .select('*')
    .eq('rule_id', ruleId);

  if (error) throw new Error(`获取接收人失败: ${error.message}`);
  return data || [];
}

/**
 * 获取消息模板
 */
export async function getMessageTemplate(templateId: string): Promise<MessageTemplate | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('message_templates')
    .select('*')
    .eq('id', templateId)
    .single();

  if (error) return null;
  return data;
}

/**
 * 解析接收人ID为实际的用户ID列表
 */
export async function resolveRecipientIds(
  recipients: ReminderRecipient[]
): Promise<{ userId: string; recipientType: string }[]> {
  const result: { userId: string; recipientType: string }[] = [];

  for (const recipient of recipients) {
    if (recipient.recipient_type === 'user') {
      // 直接用户ID
      result.push({
        userId: recipient.recipient_id,
        recipientType: 'user_id',
      });
    } else if (recipient.recipient_type === 'role') {
      // 根据角色查询用户
      const { data: users } = await getSupabaseAdmin()
        .from('users')
        .select('id')
        .contains('roles', [recipient.recipient_id]);

      if (users) {
        for (const user of users) {
          result.push({
            userId: user.id,
            recipientType: 'user_id',
          });
        }
      }
    } else if (recipient.recipient_type === 'group') {
      // 群聊ID
      result.push({
        userId: recipient.recipient_id,
        recipientType: 'chat_id',
      });
    }
  }

  return result;
}

/**
 * 记录提醒日志
 */
export async function logReminder(params: {
  ruleId?: string;
  recipientId: string;
  recipientType: string;
  messageId?: string;
  status: string;
  priority?: string;
  errorMessage?: string;
}): Promise<void> {
  await getSupabaseAdmin()
    .from('reminder_logs')
    .insert({
      rule_id: params.ruleId || null,
      recipient_id: params.recipientId,
      recipient_type: params.recipientType,
      message_id: params.messageId || null,
      status: params.status,
      priority: params.priority || 'medium',
      error_message: params.errorMessage || null,
      sent_at: params.status === 'sent' ? new Date().toISOString() : null,
    });
}

/**
 * 发送评审进度提醒
 */
export async function sendReviewProgressReminder(params: {
  ruleId: string;
  reviewerIds: string[];
  pendingCount: number;
  submissionIds?: string[];
}): Promise<{ sent: number; failed: number }> {
  const { ruleId, reviewerIds, pendingCount, submissionIds } = params;

  const rule = await getSupabaseAdmin()
    .from('reminder_rules')
    .select('*')
    .eq('id', ruleId)
    .single();

  if (!rule.data) throw new Error('提醒规则不存在');

  const template = rule.data.template_id
    ? await getMessageTemplate(rule.data.template_id)
    : null;

  let sent = 0;
  let failed = 0;

  for (const reviewerId of reviewerIds) {
    try {
      let messageContent: string | object;

      if (template?.card_template) {
        // 使用卡片模板
        messageContent = renderTemplate(JSON.stringify(template.card_template), {
          count: pendingCount,
          action_url: `${process.env.NEXT_PUBLIC_APP_URL}/competitions`,
        });
        messageContent = JSON.parse(messageContent as string);
      } else if (template) {
        // 使用文本模板
        messageContent = renderTemplate(template.content_template, {
          count: pendingCount,
        });
      } else {
        // 使用默认卡片
        messageContent = buildReviewReminderCard({
          title: '📋 评审进度提醒',
          content: `您有 **${pendingCount}** 个待评审方案，请及时处理。`,
          submissionId: submissionIds?.[0] || '',
          priority: rule.data.priority as any,
        });
      }

      const result = await sendFeishuCardMessage(
        reviewerId,
        'user_id',
        messageContent as object,
        rule.data.priority as any
      );

      await logReminder({
        ruleId,
        recipientId: reviewerId,
        recipientType: 'user',
        messageId: result.messageId,
        status: result.status,
        priority: rule.data.priority,
        errorMessage: result.error,
      });

      if (result.status === 'sent') {
        sent++;
      } else {
        failed++;
      }
    } catch (error) {
      failed++;
      await logReminder({
        ruleId,
        recipientId: reviewerId,
        recipientType: 'user',
        status: 'failed',
        priority: rule.data.priority,
        errorMessage: error instanceof Error ? error.message : '未知错误',
      });
    }
  }

  return { sent, failed };
}

/**
 * 发送截止日期提醒
 */
export async function sendDeadlineReminder(params: {
  ruleId: string;
  deadline: string;
  remainingDays: number;
  submissionCount: number;
}): Promise<{ sent: number; failed: number }> {
  const { ruleId, deadline, remainingDays, submissionCount } = params;

  const rule = await getSupabaseAdmin()
    .from('reminder_rules')
    .select('*')
    .eq('id', ruleId)
    .single();

  if (!rule.data) throw new Error('提醒规则不存在');

  // 获取接收人
  const recipients = await getRuleRecipients(ruleId);
  const resolvedRecipients = await resolveRecipientIds(recipients);

  let sent = 0;
  let failed = 0;

  for (const recipient of resolvedRecipients) {
    try {
      const cardContent = buildDeadlineReminderCard({
        title: '⏰ 评审截止日期提醒',
        deadline,
        remainingDays,
        submissionCount,
        priority: rule.data.priority as any,
      });

      const result = await sendFeishuCardMessage(
        recipient.userId,
        recipient.recipientType as any,
        cardContent,
        rule.data.priority as any
      );

      await logReminder({
        ruleId,
        recipientId: recipient.userId,
        recipientType: recipient.recipientType,
        messageId: result.messageId,
        status: result.status,
        priority: rule.data.priority,
        errorMessage: result.error,
      });

      if (result.status === 'sent') {
        sent++;
      } else {
        failed++;
      }
    } catch (error) {
      failed++;
      await logReminder({
        ruleId,
        recipientId: recipient.userId,
        recipientType: recipient.recipientType,
        status: 'failed',
        priority: rule.data.priority,
        errorMessage: error instanceof Error ? error.message : '未知错误',
      });
    }
  }

  return { sent, failed };
}

/**
 * 发送新方案提醒
 */
export async function sendNewSubmissionReminder(params: {
  ruleId: string;
  submissionId: string;
  title: string;
  submitter: string;
}): Promise<{ sent: number; failed: number }> {
  const { ruleId, submissionId, title, submitter } = params;

  const rule = await getSupabaseAdmin()
    .from('reminder_rules')
    .select('*')
    .eq('id', ruleId)
    .single();

  if (!rule.data) throw new Error('提醒规则不存在');

  // 获取接收人（通常是评委）
  const recipients = await getRuleRecipients(ruleId);
  const resolvedRecipients = await resolveRecipientIds(recipients);

  let sent = 0;
  let failed = 0;

  for (const recipient of resolvedRecipients) {
    try {
      const cardContent = {
        config: { wide_screen_mode: true },
        header: {
          title: { tag: 'plain_text', content: '🆕 新方案提交提醒' },
          template: 'green',
        },
        elements: [
          {
            tag: 'div',
            text: {
              tag: 'lark_md',
              content: `🆕 **新方案提交提醒**\n\n**方案名称**: ${title}\n**提交人**: ${submitter}`,
            },
          },
          { tag: 'hr' },
          {
            tag: 'action',
            actions: [
              {
                tag: 'button',
                text: { tag: 'plain_text', content: '查看详情' },
                type: 'primary',
                url: `${process.env.NEXT_PUBLIC_APP_URL}/competitions/${submissionId}`,
              },
            ],
          },
        ],
      };

      const result = await sendFeishuCardMessage(
        recipient.userId,
        recipient.recipientType as any,
        cardContent,
        rule.data.priority as any
      );

      await logReminder({
        ruleId,
        recipientId: recipient.userId,
        recipientType: recipient.recipientType,
        messageId: result.messageId,
        status: result.status,
        priority: rule.data.priority,
        errorMessage: result.error,
      });

      if (result.status === 'sent') {
        sent++;
      } else {
        failed++;
      }
    } catch (error) {
      failed++;
      await logReminder({
        ruleId,
        recipientId: recipient.userId,
        recipientType: recipient.recipientType,
        status: 'failed',
        priority: rule.data.priority,
        errorMessage: error instanceof Error ? error.message : '未知错误',
      });
    }
  }

  return { sent, failed };
}

/**
 * 发送评审完成通知
 */
export async function sendReviewCompletedNotification(params: {
  submissionId: string;
  title: string;
  submitterId: string;
  score: number;
  maxScore: number;
  result: string;
}): Promise<MessageResponse> {
  const { submissionId, title, submitterId, score, maxScore, result } = params;

  const cardContent = {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: '✅ 评审完成通知' },
      template: 'green',
    },
    elements: [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `✅ **评审完成通知**\n\n**方案名称**: ${title}\n**评审结果**: ${result}\n**总分**: ${score.toFixed(1)}/${maxScore}`,
        },
      },
      { tag: 'hr' },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '查看详情' },
            type: 'primary',
            url: `${process.env.NEXT_PUBLIC_APP_URL}/competitions/${submissionId}`,
          },
        ],
      },
    ],
  };

  const response = await sendFeishuCardMessage(
    submitterId,
    'user_id',
    cardContent,
    'medium'
  );

  await logReminder({
    recipientId: submitterId,
    recipientType: 'user',
    messageId: response.messageId,
    status: response.status,
    priority: 'medium',
    errorMessage: response.error,
  });

  return response;
}
