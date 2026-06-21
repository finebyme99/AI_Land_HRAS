import { NextRequest, NextResponse } from 'next/server';
import { getTenantAccessToken } from '@/lib/feishu';
import { hasPermission } from '@/lib/permissions';

const FEISHU_API = 'https://open.feishu.cn/open-apis';

// GET: 获取机器人所在的群列表
export async function GET(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (!(await hasPermission(userId, 'admin.push'))) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  try {
    const token = await getTenantAccessToken();
    const chats: { chat_id: string; name: string; chat_type: string; avatar: string }[] = [];
    let pageToken: string | undefined;

    do {
      const url = new URL(`${FEISHU_API}/im/v1/chats`);
      url.searchParams.set('page_size', '50');
      if (pageToken) url.searchParams.set('page_token', pageToken);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();

      if (!res.ok || json.code !== 0) {
        throw new Error(json.msg || '获取群列表失败');
      }

      for (const item of json.data?.items ?? []) {
        chats.push({
          chat_id: item.chat_id,
          name: item.name,
          chat_type: item.chat_type,
          avatar: item.avatar ?? '',
        });
      }

      pageToken = json.data?.has_more ? json.data.page_token : undefined;
    } while (pageToken);

    return NextResponse.json({ chats });
  } catch (err) {
    console.error('获取飞书群列表失败:', err);
    return NextResponse.json({ error: '获取群列表失败' }, { status: 500 });
  }
}
