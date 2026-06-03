import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, ensureBucket, uploadToStorage } from '@/lib/supabase-admin';

const BUCKET = 'avatars';
const MAX_SIZE = 500 * 1024; // 500KB

/** POST /api/user/avatar — 上传头像 */
export async function POST(req: NextRequest) {
  const userId = req.cookies.get('feishu_user_id')?.value;
  if (!userId) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: '请选择图片' }, { status: 400 });

  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: '仅支持图片格式' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: '图片大小不能超过 500KB' }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  await ensureBucket(BUCKET);

  const ext = file.name.split('.').pop() || 'png';
  const path = `${userId}/avatar.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  const url = await uploadToStorage(BUCKET, path, arrayBuffer, file.type);

  const { error } = await db
    .from('users')
    .update({ avatar: url })
    .eq('id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ avatar: url });
}
