import { NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendFeishuCardMessage } from '@/lib/feishu-message';
import { buildResourceCard } from '@/lib/feishu-cards';

interface ResourceCardRequestBody {
  resourceId?: unknown;
}

interface ResourceCardAuthor {
  name?: string | null;
}

export async function POST(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  if (!(await hasPermission(userId, 'resource.generate-feishu-card'))) {
    return NextResponse.json({ error: '无生成飞书卡片权限' }, { status: 403 });
  }

  let body: ResourceCardRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }

  if (typeof body.resourceId !== 'string' || body.resourceId.length === 0) {
    return NextResponse.json({ error: '缺少工具ID' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const [{ data: user }, { data: resource }] = await Promise.all([
      supabase
        .from('users')
        .select('id, feishu_open_id')
        .eq('id', userId)
        .single(),
      supabase
        .from('apps')
        .select('id, name, category, scenarios, description, official_url, logo, created_at, status, author:users!author_id(name)')
        .eq('id', body.resourceId)
        .single(),
    ]);

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }
    if (!user.feishu_open_id) {
      return NextResponse.json({ error: '当前账号没有飞书 Open ID，无法发送到飞书' }, { status: 400 });
    }
    if (!resource || resource.status !== 'published') {
      return NextResponse.json({ error: '工具不存在或未发布' }, { status: 404 });
    }

    const author = resource.author as ResourceCardAuthor | ResourceCardAuthor[] | null;
    const authorName = Array.isArray(author) ? author[0]?.name : author?.name;
    const card = buildResourceCard({
      id: resource.id,
      name: resource.name,
      category: resource.category,
      scenarios: resource.scenarios,
      description: resource.description,
      official_url: resource.official_url,
      logo: resource.logo,
      created_at: resource.created_at,
      author_name: authorName ?? undefined,
    });

    const result = await sendFeishuCardMessage(user.feishu_open_id, 'open_id', card, 'low');
    if (!result.messageId) {
      return NextResponse.json({ error: result.error || '飞书发送失败' }, { status: 502 });
    }

    return NextResponse.json({ messageId: result.messageId });
  } catch (err) {
    console.error('发送工具飞书卡片失败:', err);
    return NextResponse.json({ error: '发送工具飞书卡片失败' }, { status: 500 });
  }
}
