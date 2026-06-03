import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// POST /api/interactions — 点赞/收藏 toggle
export async function POST(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  try {
    const { action, target_type, target_id } = await request.json();

    if (!action || !target_type || !target_id) {
      return NextResponse.json({ error: '参数不完整' }, { status: 400 });
    }

    const table = action === 'like' ? 'likes' : action === 'bookmark' ? 'bookmarks' : 'dislikes';

    // Check if exists
    const { data: existing } = await getSupabaseAdmin()
      .from(table)
      .select('id')
      .eq('user_id', userId)
      .eq('target_type', target_type)
      .eq('target_id', target_id)
      .maybeSingle();

    if (existing) {
      // Remove
      await getSupabaseAdmin().from(table).delete().eq('id', existing.id);
    } else {
      // Add
      const { error: insertErr } = await getSupabaseAdmin().from(table).insert({ user_id: userId, target_type, target_id });
      if (insertErr) console.error('Insert interaction error:', insertErr);
    }

    // Sync denormalized count columns from actual records
    const countTable = target_type === 'case' ? 'cases' : target_type === 'course' ? 'courses' : target_type === 'app' ? 'apps' : null;
    if (countTable) {
      const { count: likeCount } = await getSupabaseAdmin()
        .from('likes').select('*', { count: 'exact', head: true })
        .eq('target_type', target_type).eq('target_id', target_id);
      const { count: bookmarkCount } = await getSupabaseAdmin()
        .from('bookmarks').select('*', { count: 'exact', head: true })
        .eq('target_type', target_type).eq('target_id', target_id);
      await getSupabaseAdmin().from(countTable).update({
        like_count: likeCount ?? 0,
        bookmark_count: bookmarkCount ?? 0,
      }).eq('id', target_id);
    }

    return NextResponse.json({ active: !existing });
  } catch {
    return NextResponse.json({ error: '操作失败' }, { status: 500 });
  }
}

// GET /api/interactions?target_type=case&target_id=xxx — 查询交互状态
// GET /api/interactions?target_type=course&target_id=xxx&action=count — 查询计数
export async function GET(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  const { searchParams } = new URL(request.url);
  const target_type = searchParams.get('target_type');
  const target_id = searchParams.get('target_id');
  const action = searchParams.get('action');

  if (!target_type || !target_id) {
    return NextResponse.json({ error: '参数不完整' }, { status: 400 });
  }

  // Return actual counts — count from likes/bookmarks tables directly
  if (action === 'count') {
    const [{ count: likeCount }, { count: bookmarkCount }] = await Promise.all([
      getSupabaseAdmin()
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('target_type', target_type)
        .eq('target_id', target_id),
      getSupabaseAdmin()
        .from('bookmarks')
        .select('*', { count: 'exact', head: true })
        .eq('target_type', target_type)
        .eq('target_id', target_id),
    ]);
    return NextResponse.json({ like_count: likeCount ?? 0, bookmark_count: bookmarkCount ?? 0 });
  }

  const result: Record<string, boolean> = {};

  if (userId) {
    const tables = ['likes', 'bookmarks', 'dislikes'] as const;
    const keys = ['liked', 'bookmarked', 'disliked'] as const;

    for (let i = 0; i < tables.length; i++) {
      const { data } = await getSupabaseAdmin()
        .from(tables[i])
        .select('id')
        .eq('user_id', userId)
        .eq('target_type', target_type)
        .eq('target_id', target_id)
        .maybeSingle();
      result[keys[i]] = !!data;
    }
  }

  return NextResponse.json(result);
}
