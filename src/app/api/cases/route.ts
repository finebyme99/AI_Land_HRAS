import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// PATCH /api/cases — 更新案例（admin only，用于下架/精选等）
export async function PATCH(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const { data: user } = await getSupabaseAdmin()
    .from('users').select('id, roles').eq('id', userId).single();
  if (!user || !user.roles?.some((r: string) => ['admin', 'moderator'].includes(r))) {
    return NextResponse.json({ error: '仅管理员可操作' }, { status: 403 });
  }

  try {
    const { id, developers, ...updates } = await request.json();
    if (!id) {
      return NextResponse.json({ error: '缺少案例 ID' }, { status: 400 });
    }

    // 允许更新的字段
    const allowedFields = [
      'title', 'summary', 'content', 'category', 'team', 'business_scenario',
      'team_members', 'original_business_scenario', 'pain_points',
      'monthly_saved_hours', 'efficiency_ratio', 'ai_tools',
      'demo_link', 'other_values', 'status', 'is_featured',
    ];
    const filtered: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in updates) filtered[key] = updates[key];
    }

    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from('cases')
      .update(filtered)
      .eq('id', id)
      .select('id, status, is_featured')
      .single();

    if (error) throw error;

    // 同步 developers
    if (Array.isArray(developers)) {
      await syncDevelopers(db, id, developers);
    }

    return NextResponse.json({ case: data });
  } catch (err: unknown) {
    console.error('Case update error:', err);
    return NextResponse.json({ error: '操作失败' }, { status: 500 });
  }
}

// POST /api/cases — 创建案例（登录用户均可提交）
export async function POST(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const db = getSupabaseAdmin();
  const { data: user } = await db
    .from('users').select('id, roles').eq('id', userId).single();
  const isAdmin = user?.roles?.some((r: string) => ['admin', 'moderator'].includes(r));

  try {
    const {
      title, summary, content, category, team, business_scenario,
      team_members, original_business_scenario, pain_points,
      monthly_saved_hours, efficiency_ratio, ai_tools,
      demo_link, other_values, developers,
    } = await request.json();

    if (!title || !summary || !content || !category || !team || !business_scenario ||
        !team_members || !original_business_scenario || !pain_points?.length ||
        monthly_saved_hours == null || efficiency_ratio == null || !ai_tools?.length || !demo_link) {
      return NextResponse.json({ error: '请填写所有必填字段' }, { status: 400 });
    }

    const { data, error } = await db
      .from('cases')
      .insert({
        title,
        summary,
        content,
        category,
        team,
        business_scenario,
        team_members,
        original_business_scenario,
        pain_points,
        monthly_saved_hours,
        efficiency_ratio,
        ai_tools,
        demo_link,
        other_values: other_values || [],
        author_id: userId,
        status: isAdmin ? 'published' : 'pending',
      })
      .select('id, title, category, status, created_at')
      .single();

    if (error) throw error;

    // 写入 developers（默认 = [userId]）
    const devIds = Array.isArray(developers) && developers.length > 0 ? developers : [userId];
    await syncDevelopers(db, data.id, devIds);

    return NextResponse.json({ case: data });
  } catch (err: unknown) {
    console.error('Case creation error:', err);
    const msg = err && typeof err === 'object' && 'message' in err
      ? String((err as { message: unknown }).message)
      : '提交失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** 同步 case_developers 表 */
async function syncDevelopers(db: ReturnType<typeof getSupabaseAdmin>, caseId: string, userIds: string[]) {
  // 先删后插
  await db.from('case_developers').delete().eq('case_id', caseId);
  if (userIds.length > 0) {
    const rows = userIds.map(uid => ({ case_id: caseId, user_id: uid }));
    await db.from('case_developers').insert(rows);
  }
}
