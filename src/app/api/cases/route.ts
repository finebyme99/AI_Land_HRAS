import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// PATCH /api/cases — 更新案例（admin only，用于下架/精选等）
export async function PATCH(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const { data: user } = await getSupabaseAdmin()
    .from('users').select('id, role').eq('id', userId).single();
  if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
    return NextResponse.json({ error: '仅管理员可操作' }, { status: 403 });
  }

  try {
    const { id, ...updates } = await request.json();
    if (!id) {
      return NextResponse.json({ error: '缺少案例 ID' }, { status: 400 });
    }

    const { data, error } = await getSupabaseAdmin()
      .from('cases')
      .update(updates)
      .eq('id', id)
      .select('id, status, is_featured')
      .single();

    if (error) throw error;
    return NextResponse.json({ case: data });
  } catch (err: unknown) {
    console.error('Case update error:', err);
    return NextResponse.json({ error: '操作失败' }, { status: 500 });
  }
}

// POST /api/cases — 创建案例（admin only）
export async function POST(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  // 验证管理员权限
  const { data: user } = await getSupabaseAdmin()
    .from('users').select('id, role').eq('id', userId).single();
  if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
    return NextResponse.json({ error: '仅管理员可发布案例' }, { status: 403 });
  }

  try {
    const { title, summary, content, category, ai_tools, team, business_scenario } = await request.json();

    if (!title || !summary || !content || !category) {
      return NextResponse.json({ error: '请填写必要字段' }, { status: 400 });
    }

    const { data, error } = await getSupabaseAdmin()
      .from('cases')
      .insert({
        title,
        summary,
        content,
        category,
        ai_tools: ai_tools || [],
        team: team || '',
        business_scenario: business_scenario || '',
        author_id: userId,
        status: 'published',
      })
      .select('id, title, category, status, created_at')
      .single();

    if (error) throw error;

    return NextResponse.json({ case: data });
  } catch (err: unknown) {
    console.error('Case creation error:', err);
    const msg = err && typeof err === 'object' && 'message' in err
      ? String((err as { message: unknown }).message)
      : '发布失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
