// src/app/api/feishu/card-callback/route.ts
// 飞书卡片回调入口
// 处理 url_verification 握手 + 路由 card.action.trigger 事件

import { NextRequest, NextResponse } from 'next/server';
import { verifyAndDecryptCardEvent } from '@/lib/feishu-card';
import { handleCourseCardSubmit } from '@/lib/course-card-handler';

export async function POST(request: NextRequest) {
  const raw = await request.text();
  // 1. 提取 tenant_key（明文 payload 才看得到 header.tenant_key；加密 payload 也含 header）
  let tenantKey: string | null = null;
  try {
    const peek = JSON.parse(raw);
    tenantKey = (peek?.header?.tenant_key as string) || null;
  } catch {
    // 后面 verifyAndDecryptCardEvent 会再处理
  }

  // 2. 验签 + 解密
  const result = await verifyAndDecryptCardEvent(raw, tenantKey);
  if (!result.ok || !result.body) {
    return NextResponse.json({ error: result.error || 'verify failed' }, { status: 401 });
  }
  const body = result.body;

  // 3. url_verification 握手
  if (body.type === 'url_verification' && body.challenge) {
    return NextResponse.json({ challenge: body.challenge });
  }
  if (body.challenge) {
    return NextResponse.json({ challenge: body.challenge });
  }

  // 4. 路由事件
  const header = (body.header ?? {}) as Record<string, unknown>;
  const event = (body.event ?? {}) as Record<string, unknown>;
  const eventType = header.event_type as string;
  const action = event.action as Record<string, unknown> | undefined;

  if (
    eventType === 'card.action.trigger' &&
    action?.tag === 'form_submit' &&
    action?.name === 'course_form'
  ) {
    const messageId = (action.message_id as string) || (header.message_id as string);
    if (!messageId) {
      return NextResponse.json({ ok: false, error: 'missing message_id' }, { status: 400 });
    }
    const handleResult = await handleCourseCardSubmit(
      (action.form_value as Record<string, unknown>) ?? {},
      messageId,
    );
    return NextResponse.json({ ok: handleResult.ok, error: handleResult.error });
  }

  // 未知事件类型，200 OK 让飞书停止重试
  return NextResponse.json({ ok: true, ignored: true, eventType });
}
