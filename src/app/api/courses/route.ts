import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// 验证 admin 权限
async function requireAdmin(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) return null;
  const { data: user } = await getSupabaseAdmin()
    .from('users').select('id, role').eq('id', userId).single();
  if (!user || (user.role !== 'admin' && user.role !== 'moderator')) return null;
  return user;
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
      category, difficulty, content_type,
      cover_image, courseware_url, video_url,
    } = await request.json();

    if (!title || !description || !instructor || !duration || !difficulty) {
      return NextResponse.json({ error: '请填写必要字段' }, { status: 400 });
    }

    const { data, error } = await getSupabaseAdmin()
      .from('courses')
      .insert({
        title,
        description,
        instructor,
        duration,
        category: category || [],
        difficulty,
        content_type: content_type || [],
        cover_image: cover_image || '',
        courseware_url: courseware_url || '',
        video_url: video_url || '',
      })
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
