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
    const countTable = target_type === 'case' ? 'cases' : target_type === 'topic' ? 'topics' : target_type === 'course' ? 'courses' : null;
    const countField = action === 'like' ? 'like_count' : action === 'bookmark' ? 'bookmark_count' : 'dislike_count';

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
      if (countTable) {
        const { data: item } = await getSupabaseAdmin().from(countTable).select(countField).eq('id', target_id).single();
        if (item) {
          const val = (item as Record<string, number>)[countField] || 0;
          await getSupabaseAdmin().from(countTable).update({ [countField]: Math.max(0, val - 1) }).eq('id', target_id);
        }
      }
      return NextResponse.json({ active: false });
    } else {
      // Add
      await getSupabaseAdmin().from(table).insert({ user_id: userId, target_type, target_id });
      if (countTable) {
        const { data: item } = await getSupabaseAdmin().from(countTable).select(countField).eq('id', target_id).single();
        if (item) {
          const val = (item as Record<string, number>)[countField] || 0;
          await getSupabaseAdmin().from(countTable).update({ [countField]: val + 1 }).eq('id', target_id);
        }
      }
      return NextResponse.json({ active: true });
    }
  } catch {
    return NextResponse.json({ error: '操作失败' }, { status: 500 });
  }
}

// GET /api/interactions?target_type=case&target_id=xxx — 查询交互状态
export async function GET(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  const { searchParams } = new URL(request.url);
  const target_type = searchParams.get('target_type');
  const target_id = searchParams.get('target_id');

  if (!target_type || !target_id) {
    return NextResponse.json({ error: '参数不完整' }, { status: 400 });
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
