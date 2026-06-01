import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import type { ResourceType, ResourceCategory } from '@/types';

/** GET /api/resources?type=ai_tool&category=对话类&search=xxx */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const resourceType = searchParams.get('type') as ResourceType | null;
  const category = searchParams.get('category') as ResourceCategory | null;
  const search = searchParams.get('search') || '';

  const db = getSupabaseAdmin();
  let query = db
    .from('apps')
    .select('*')
    .eq('status', 'published')
    .order('rating', { ascending: false });

  if (resourceType) query = query.eq('resource_type', resourceType);
  if (category) query = query.eq('category', category);
  if (search) query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** POST /api/resources — 提交新资源（需登录，status=pending） */
export async function POST(req: NextRequest) {
  const userId = req.cookies.get('feishu_user_id')?.value;
  if (!userId) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const body = await req.json();
  const { resource_type, name, description, content, category, scenarios, official_url, logo } = body;

  if (!resource_type || !name || !description || !category) {
    return NextResponse.json({ error: '缺少必填字段' }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('apps')
    .insert({
      resource_type,
      name,
      description,
      content: content || '',
      category,
      scenarios: scenarios || [],
      official_url: official_url || '',
      logo: logo || '',
      status: 'pending',
      author_id: userId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
