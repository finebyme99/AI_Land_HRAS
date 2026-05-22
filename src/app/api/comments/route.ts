import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// POST /api/comments — 创建评论
export async function POST(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  try {
    const { target_type, target_id, content } = await request.json();

    if (!target_type || !target_id || !content) {
      return NextResponse.json({ error: '参数不完整' }, { status: 400 });
    }

    const { data, error } = await getSupabaseAdmin()
      .from('comments')
      .insert({
        target_type,
        target_id,
        content,
        author_id: userId,
      })
      .select('id, content, author:users!author_id(name, avatar), created_at')
      .single();

    if (error) throw error;

    return NextResponse.json({ comment: data });
  } catch {
    return NextResponse.json({ error: '评论失败' }, { status: 500 });
  }
}
