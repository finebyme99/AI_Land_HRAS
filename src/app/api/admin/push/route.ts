import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendFeishuCardMessage } from '@/lib/feishu-message';
import { buildCourseCard, buildResourceCard, buildCaseCard, buildSubmissionCard } from '@/lib/feishu-cards';

const BUCKET = 'competition-attachments';

// GET: 预览卡片 — ?type=course&id=xxx
export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get('type');
  const id = request.nextUrl.searchParams.get('id');
  if (!type || !id) return NextResponse.json({ error: '缺少参数' }, { status: 400 });

  try {
    const supabase = getSupabaseAdmin();
    const card = await buildCard(supabase, type, id);
    if (!card) return NextResponse.json({ error: '内容不存在' }, { status: 404 });
    return NextResponse.json({ card });
  } catch (err) {
    console.error('预览卡片失败:', err);
    return NextResponse.json({ error: '预览失败' }, { status: 500 });
  }
}

// POST: 执行推送
export async function POST(request: NextRequest) {
  try {
    // 校验管理员
    const userId = request.cookies.get('feishu_user_id')?.value;
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });
    const supabase = getSupabaseAdmin();
    const { data: user } = await supabase.from('users').select('roles').eq('id', userId).single();
    if (!user || !user.roles?.some((r: string) => ['admin', 'moderator'].includes(r))) {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    const body = await request.json();
    const { chat_id, chat_name, items } = body as {
      chat_id: string;
      chat_name?: string;
      items: { content_type: string; content_id: string }[];
    };

    if (!chat_id || !items?.length) {
      return NextResponse.json({ error: '缺少 chat_id 或 items' }, { status: 400 });
    }

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const item of items) {
      try {
        const card = await buildCard(supabase, item.content_type, item.content_id);
        if (!card) {
          failed++;
          errors.push(`${item.content_type}:${item.content_id} 内容不存在`);
          continue;
        }

        const result = await sendFeishuCardMessage(chat_id, 'chat_id', card, 'low');

        // 记录日志
        const title = extractTitle(card);
        await supabase.from('push_logs').insert({
          content_type: item.content_type,
          content_id: item.content_id,
          content_title: title,
          target_chat_id: chat_id,
          target_chat_name: chat_name || chat_id,
          card_json: card,
          status: result.messageId ? 'sent' : 'failed',
          error_message: result.messageId ? null : '发送失败',
          pushed_by: userId,
        });

        if (result.messageId) success++;
        else {
          failed++;
          errors.push(`${item.content_type}:${item.content_id} 发送失败`);
        }
      } catch (e) {
        failed++;
        errors.push(`${item.content_type}:${item.content_id} ${e instanceof Error ? e.message : '未知错误'}`);
      }
    }

    return NextResponse.json({ success, failed, errors: errors.length > 0 ? errors : undefined });
  } catch (err) {
    console.error('推送失败:', err);
    return NextResponse.json({ error: '推送失败' }, { status: 500 });
  }
}

// 根据内容类型构建卡片
async function buildCard(supabase: ReturnType<typeof getSupabaseAdmin>, contentType: string, contentId: string) {
  switch (contentType) {
    case 'course': {
      const { data } = await supabase.from('courses').select('id, title, instructor, difficulty, description, duration, video_url, courseware_url, created_at, period, cover_image_key').eq('id', contentId).single();
      if (!data) return null;
      return buildCourseCard(data);
    }
    case 'resource': {
      const { data } = await supabase.from('apps').select('id, name, category, description, official_url, logo, created_at').eq('id', contentId).single();
      if (!data) return null;
      return buildResourceCard(data);
    }
    case 'case': {
      const { data } = await supabase.from('cases').select('id, title, category, summary, author:users!author_id(name, department)').eq('id', contentId).single();
      if (!data) return null;
      return buildCaseCard({
        id: data.id,
        title: data.title,
        author: (data.author as { name?: string })?.name,
        category: data.category,
        summary: data.summary,
      });
    }
    case 'submission': {
      const { data } = await supabase.from('competition_submissions').select('id, title, submitter, track, after_process').eq('id', contentId).single();
      if (!data) return null;
      return buildSubmissionCard({
        id: data.id,
        title: data.title,
        submitter: Array.isArray(data.submitter) ? data.submitter[0] : data.submitter,
        track: data.track,
        afterProcess: data.after_process,
      });
    }
    default:
      return null;
  }
}

// 从卡片 JSON 中提取标题
function extractTitle(card: { header?: { title?: { content?: string } } }): string {
  return card.header?.title?.content ?? '';
}
