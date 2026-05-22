import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// POST /api/topics — 创建话题
export async function POST(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  try {
    const { title, content, tags } = await request.json();

    if (!title || !content) {
      return NextResponse.json({ error: '标题和内容不能为空' }, { status: 400 });
    }

    const { data, error } = await getSupabaseAdmin()
      .from('topics')
      .insert({
        title,
        content,
        tags: tags || [],
        author_id: userId,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ topic: data });
  } catch {
    return NextResponse.json({ error: '发布失败' }, { status: 500 });
  }
}
