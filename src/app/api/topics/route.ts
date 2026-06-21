import { NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

async function requirePermission(request: NextRequest, permission: string) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) return null;
  if (!(await hasPermission(userId, permission))) return null;
  return { id: userId };
}

// POST /api/topics — 创建话题
export async function POST(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }
  if (!(await hasPermission(userId, 'case.submit'))) {
    return NextResponse.json({ error: '无提交案例权限' }, { status: 403 });
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

// PATCH /api/topics — 更新话题精选状态
export async function PATCH(request: NextRequest) {
  const admin = await requirePermission(request, 'case.feature');
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
