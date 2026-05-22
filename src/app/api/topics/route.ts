import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// 验证 admin 权限
async function requireAdmin(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) return null;
  const { data: user } = await getSupabaseAdmin()
    .from('users').select('id, role').eq('id', userId).single();
  if (!user || (user.role !== 'admin' && user.role !== 'moderator')) return null;
  return user;
}

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

// PATCH /api/topics — 更新话题（admin: 精选/取消精选）
export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  try {
    const { id, is_featured } = await request.json();
    if (!id) {
      return NextResponse.json({ error: '缺少话题 ID' }, { status: 400 });
    }

    const { error } = await getSupabaseAdmin()
      .from('topics')
      .update({ is_featured: is_featured ?? false })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}
