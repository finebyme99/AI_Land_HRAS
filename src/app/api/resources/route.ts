import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

type ResourceCategory = string;

/** GET /api/resources?category=AI工具&search=xxx */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const search = searchParams.get('search') || '';

  const db = getSupabaseAdmin();
  let query = db
    .from('apps')
    .select('*')
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  if (category) query = query.eq('category', category);
  if (search) query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** POST /api/resources — 提交新资源（管理员直接发布，其他人待审核） */
export async function POST(req: NextRequest) {
  const userId = req.cookies.get('feishu_user_id')?.value;
  if (!userId) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const body = await req.json();
  const { name, description, content, category, scenarios, official_url, logo } = body;

  if (!name || !description || !category) {
    return NextResponse.json({ error: '缺少必填字段' }, { status: 400 });
  }

  const db = getSupabaseAdmin();

  // 管理员提交直接发布
  const { data: user } = await db.from('users').select('roles').eq('id', userId).single();
  const isAdmin = user?.roles?.some((r: string) => ['admin', 'moderator'].includes(r));

  const { data, error } = await db
    .from('apps')
    .insert({
      name,
      description,
      content: content || '',
      category,
      scenarios: scenarios || [],
      official_url: official_url || '',
      logo: logo || '',
      status: isAdmin ? 'published' : 'pending',
      author_id: userId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

/** PATCH /api/resources — 管理员审核资源（通过/驳回） */
export async function PATCH(req: NextRequest) {
  const userId = req.cookies.get('feishu_user_id')?.value;
  if (!userId) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const db = getSupabaseAdmin();
  const { data: user } = await db.from('users').select('roles').eq('id', userId).single();
  const isAdmin = user?.roles?.some((r: string) => ['admin', 'moderator'].includes(r));
  if (!isAdmin) return NextResponse.json({ error: '无权限' }, { status: 403 });

  const body = await req.json();
  const { id, status } = body;
  if (!id || !['published', 'rejected'].includes(status)) {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }

  const { data, error } = await db
    .from('apps')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
