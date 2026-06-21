import { NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/permissions';
import { getTenantAccessToken } from '@/lib/feishu';

async function requireAdmin(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) return null;
  if (!(await hasPermission(userId, 'admin.reminders'))) return null;
  return { id: userId };
}

/**
 * GET /api/admin/feishu/chats
 * 拉机器人已加入的飞书群聊列表（admin only）
 * 用于 admin/reminders UI 选"按群聊"时的下拉数据源
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: '仅管理员可访问' }, { status: 403 });

  try {
    const token = await getTenantAccessToken();
    const chats: { chat_id: string; name: string; description?: string }[] = [];
    let pageToken: string | undefined;
    do {
      const url = new URL('https://open.feishu.cn/open-apis/im/v1/chats');
      url.searchParams.set('page_size', '50');
      if (pageToken) url.searchParams.set('page_token', pageToken);
      const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!res.ok || json.code !== 0) {
        throw new Error(`飞书 API 错误: ${json.msg ?? res.status}`);
      }
      for (const c of (json.data?.items ?? [])) {
        chats.push({ chat_id: c.chat_id, name: c.name, description: c.description });
      }
      pageToken = json.data?.has_more ? json.data.page_token : undefined;
    } while (pageToken);

    return NextResponse.json({ chats });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '获取群聊失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
