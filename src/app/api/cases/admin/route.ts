import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/** GET /api/cases/admin — 管理员获取所有状态的案例 */
export async function GET(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const db = getSupabaseAdmin();
  const { data: user } = await db.from('users').select('roles').eq('id', userId).single();
  const isAdmin = user?.roles?.some((r: string) => ['admin', 'moderator'].includes(r));
  if (!isAdmin) return NextResponse.json({ error: '无权限' }, { status: 403 });

  const { data, error } = await db
    .from('cases')
    .select('*, author:users!author_id(id, name, avatar, department)')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 批量获取 developers
  const caseIds = (data ?? []).map(c => c.id);
  let devMap: Record<string, { id: string; name: string; avatar: string; department: string }[]> = {};
  if (caseIds.length > 0) {
    const { data: devs } = await db
      .from('case_developers')
      .select('case_id, user:users!user_id(id, name, avatar, department)')
      .in('case_id', caseIds);
    if (devs) {
      for (const d of devs) {
        if (!devMap[d.case_id]) devMap[d.case_id] = [];
        devMap[d.case_id].push(d.user as unknown as { id: string; name: string; avatar: string; department: string });
      }
    }
  }

  const cases = (data ?? []).map(c => ({
    ...c,
    developers: devMap[c.id] || [],
  }));

  return NextResponse.json({ cases });
}

/** PUT /api/cases/admin — 管理员编辑案例 */
export async function PUT(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const db = getSupabaseAdmin();
  const { data: user } = await db.from('users').select('roles').eq('id', userId).single();
  const isAdmin = user?.roles?.some((r: string) => ['admin', 'moderator'].includes(r));
  if (!isAdmin) return NextResponse.json({ error: '无权限' }, { status: 403 });

  try {
    const { id, developers, ...updates } = await request.json();
    if (!id) return NextResponse.json({ error: '缺少案例 ID' }, { status: 400 });

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

    const { data, error } = await db
      .from('cases')
      .update(filtered)
      .eq('id', id)
      .select('id, title, category, status, created_at')
      .single();

    if (error) throw error;

    // 同步 developers
    if (Array.isArray(developers)) {
      await db.from('case_developers').delete().eq('case_id', id);
      if (developers.length > 0) {
        await db.from('case_developers').insert(developers.map((uid: string) => ({ case_id: id, user_id: uid })));
      }
    }

    return NextResponse.json({ case: data });
  } catch (err: unknown) {
    console.error('Case admin update error:', err);
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }
}
