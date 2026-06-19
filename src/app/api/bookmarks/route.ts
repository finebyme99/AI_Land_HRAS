import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  try {
    // Fetch all bookmarks for the user
    const { data: bookmarks, error } = await getSupabaseAdmin()
      .from('bookmarks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Fetch target details for each bookmark
    const results = await Promise.all(
      (bookmarks || []).map(async (bm) => {
        let target = null;

        if (bm.target_type === 'course') {
          const { data } = await getSupabaseAdmin()
            .from('courses')
            .select('id, title, description, like_count')
            .eq('id', bm.target_id)
            .maybeSingle();
          target = data;
        }

        return { ...bm, target };
      })
    );

    return NextResponse.json(results);
  } catch (err) {
    console.error('Failed to fetch bookmarks:', err);
    return NextResponse.json({ error: '获取收藏失败' }, { status: 500 });
  }
}
