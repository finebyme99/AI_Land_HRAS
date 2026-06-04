import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// 验证 admin 权限
async function requireAdmin(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) return null;
  const { data: user } = await getSupabaseAdmin()
    .from('users').select('id, roles').eq('id', userId).single();
  if (!user || !user.roles?.some((r: string) => ['admin', 'moderator'].includes(r))) return null;
  return user;
}

// GET /api/courses — 获取课程列表
export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('courses')
      .select('id, title, instructor, difficulty, category, description, cover_image, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ courses: data ?? [] });
  } catch (err) {
    console.error('获取课程列表失败:', err);
    return NextResponse.json({ error: '获取课程列表失败' }, { status: 500 });
  }
}

// POST /api/courses — 创建课程（admin only）
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: '仅管理员可发布课程' }, { status: 403 });
  }

  try {
    const {
      title, description, instructor, duration,
      difficulty, content_type,
      cover_image, courseware_url, video_url,
      created_at,
    } = await request.json();

    if (!title || !description || !instructor || !duration || !difficulty) {
      return NextResponse.json({ error: '请填写必要字段' }, { status: 400 });
    }

    const insertData: Record<string, unknown> = {
      title,
      description,
      instructor,
      duration,
      difficulty,
      content_type: content_type || [],
      cover_image: cover_image || '',
      courseware_url: courseware_url || '',
      video_url: video_url || '',
    };
    if (created_at) insertData.created_at = created_at;

    const { data, error } = await getSupabaseAdmin()
      .from('courses')
      .insert(insertData)
      .select('id, title, category, difficulty, created_at')
      .single();

    if (error) throw error;

    return NextResponse.json({ course: data });
  } catch (err: unknown) {
    console.error('Course creation error:', err);
    const msg = err && typeof err === 'object' && 'message' in err
      ? String((err as { message: unknown }).message)
      : '发布失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH /api/courses?id=xxx — 更新课程（admin only）
export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: '仅管理员可编辑课程' }, { status: 403 });
  }

  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: '缺少课程 ID' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const updates: Record<string, unknown> = {};
    const allowed = ['title', 'description', 'instructor', 'duration', 'difficulty', 'content_type', 'cover_image', 'courseware_url', 'video_url', 'created_at'];
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: '没有可更新的字段' }, { status: 400 });
    }

    const { data, error } = await getSupabaseAdmin()
      .from('courses')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return NextResponse.json({ course: data });
  } catch (err: unknown) {
    console.error('Course update error:', err);
    const msg = err && typeof err === 'object' && 'message' in err
      ? String((err as { message: unknown }).message)
      : '更新失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
