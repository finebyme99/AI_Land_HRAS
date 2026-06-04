import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/** GET /api/cases/[id] — 获取单个案例详情（含 developers） */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getSupabaseAdmin();

  const { data, error } = await db
    .from('cases')
    .select('*, author:users!author_id(id, name, avatar, department)')
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: '案例不存在' }, { status: 404 });
  }

  // 获取 developers
  const { data: devs } = await db
    .from('case_developers')
    .select('user:users!user_id(id, name, avatar, department)')
    .eq('case_id', id);

  const developers = (devs ?? []).map(d =>
    d.user as unknown as { id: string; name: string; avatar: string; department: string }
  );

  return NextResponse.json({ ...data, developers });
}
