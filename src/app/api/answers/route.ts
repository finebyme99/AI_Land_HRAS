import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// POST /api/answers — 创建回答
export async function POST(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  try {
    const { topic_id, content } = await request.json();

    if (!topic_id || !content) {
      return NextResponse.json({ error: '参数不完整' }, { status: 400 });
    }

    const { data, error } = await getSupabaseAdmin()
      .from('answers')
      .insert({
        topic_id,
        content,
        author_id: userId,
      })
      .select('id, content, author:users!author_id(name, avatar, department), vote_count, is_accepted, created_at')
      .single();

    if (error) throw error;

    // 更新话题回答数
    const { data: topic } = await getSupabaseAdmin().from('topics').select('answer_count').eq('id', topic_id).single();
    if (topic) {
      await getSupabaseAdmin().from('topics').update({ answer_count: topic.answer_count + 1 }).eq('id', topic_id);
    }

    return NextResponse.json({ answer: data });
  } catch {
    return NextResponse.json({ error: '回答失败' }, { status: 500 });
  }
}
