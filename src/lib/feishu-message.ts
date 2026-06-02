// src/lib/feishu-message.ts
// 飞书消息发送服务

import { getTenantAccessToken } from './feishu';

const FEISHU_API_BASE = 'https://open.feishu.cn/open-apis';

export interface SendMessageParams {
  recipientId: string;
  recipientType: 'user_id' | 'open_id' | 'chat_id';
  messageType: 'text' | 'interactive';
  content: string | object;
  priority?: 'high' | 'medium' | 'low';
}

export interface MessageResponse {
  messageId: string;
  status: 'sent' | 'failed';
  error?: string;
}

/**
 * 发送飞书消息
 */
export async function sendFeishuMessage(params: SendMessageParams): Promise<MessageResponse> {
  const { recipientId, recipientType, messageType, content, priority = 'medium' } = params;

  try {
    const token = await getTenantAccessToken();

    // 根据接收人类型构建请求体
    const requestBody: any = {
      receive_id: recipientId,
      msg_type: messageType,
      content: typeof content === 'string' ? content : JSON.stringify(content),
    };

    // 设置接收人类型
    if (recipientType === 'user_id') {
      requestBody.receive_id_type = 'user_id';
    } else if (recipientType === 'open_id') {
      requestBody.receive_id_type = 'open_id';
    } else if (recipientType === 'chat_id') {
      requestBody.receive_id_type = 'chat_id';
    }

    // 根据优先级设置消息紧急程度
    if (priority === 'high') {
      requestBody.urgent = true;
    }

    const response = await fetch(`${FEISHU_API_BASE}/im/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (data.code !== 0) {
      throw new Error(`发送消息失败: ${data.msg}`);
    }

    return {
      messageId: data.data.message_id,
      status: 'sent',
    };
  } catch (error) {
    return {
      messageId: '',
      status: 'failed',
      error: error instanceof Error ? error.message : '未知错误',
    };
  }
}

/**
 * 发送飞书卡片消息
 */
export async function sendFeishuCardMessage(
  recipientId: string,
  recipientType: 'user_id' | 'open_id' | 'chat_id',
  cardContent: object,
  priority: 'high' | 'medium' | 'low' = 'medium'
): Promise<MessageResponse> {
  return sendFeishuMessage({
    recipientId,
    recipientType,
    messageType: 'interactive',
    content: cardContent,
    priority,
  });
}

/**
 * 查询消息状态
 */
export async function getMessageStatus(messageId: string): Promise<{
  status: string;
  readAt?: string;
}> {
  try {
    const token = await getTenantAccessToken();

    const response = await fetch(`${FEISHU_API_BASE}/im/v1/messages/${messageId}/read_users`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (data.code !== 0) {
      throw new Error(`查询消息状态失败: ${data.msg}`);
    }

    // 检查是否有已读用户
    const readUsers = data.data.items || [];
    const isRead = readUsers.length > 0;

    return {
      status: isRead ? 'read' : 'sent',
      readAt: isRead ? readUsers[0].read_time : undefined,
    };
  } catch (error) {
    return {
      status: 'unknown',
    };
  }
}

/**
 * 构建评审提醒卡片
 */
export function buildReviewReminderCard(params: {
  title: string;
  content: string;
  submissionId: string;
  proposalNo?: number;
  priority: 'high' | 'medium' | 'low';
  actionUrl?: string;
}): object {
  const { title, content, submissionId, proposalNo, priority, actionUrl } = params;

  // 根据优先级设置颜色
  const headerColor = priority === 'high' ? 'red' : priority === 'medium' ? 'blue' : 'grey';

  return {
    config: {
      wide_screen_mode: true,
    },
    header: {
      title: {
        tag: 'plain_text',
        content: title,
      },
      template: headerColor,
    },
    elements: [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: content,
        },
      },
      {
        tag: 'hr',
      },
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**方案编号**: ${proposalNo || submissionId}`,
        },
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: {
              tag: 'plain_text',
              content: '查看详情',
            },
            type: 'primary',
            url: actionUrl || `${process.env.NEXT_PUBLIC_APP_URL}/competitions/${submissionId}`,
          },
        ],
      },
    ],
  };
}

/**
 * 构建截止日期提醒卡片
 */
export function buildDeadlineReminderCard(params: {
  title: string;
  deadline: string;
  remainingDays: number;
  submissionCount: number;
  priority: 'high' | 'medium' | 'low';
}): object {
  const { title, deadline, remainingDays, submissionCount, priority } = params;

  const headerColor = priority === 'high' ? 'red' : priority === 'medium' ? 'orange' : 'blue';

  return {
    config: {
      wide_screen_mode: true,
    },
    header: {
      title: {
        tag: 'plain_text',
        content: title,
      },
      template: headerColor,
    },
    elements: [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `⏰ **评审截止日期提醒**\n\n距离评审截止还有 **${remainingDays} 天**\n截止时间: ${deadline}`,
        },
      },
      {
        tag: 'hr',
      },
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `📊 当前待评审方案: **${submissionCount}** 个`,
        },
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: {
              tag: 'plain_text',
              content: '立即评审',
            },
            type: 'primary',
            url: `${process.env.NEXT_PUBLIC_APP_URL}/competitions`,
          },
        ],
      },
    ],
  };
}

/**
 * 渲染模板变量
 */
export function renderTemplate(template: string, variables: Record<string, any>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
  }
  return result;
}
