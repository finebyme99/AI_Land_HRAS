import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, ensureBucket, uploadToStorage } from '@/lib/supabase-admin';

const BUCKET = 'app-logos';
const MAX_SIZE = 500 * 1024; // 500KB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

/** POST /api/apps/logo — 上传工具图片 */
export async function POST(req: NextRequest) {
  const userId = req.cookies.get('feishu_user_id')?.value;
  if (!userId) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: '请选择图片' }, { status: 400 });

  // 支持常见图片格式 + SVG
  const isImage = file.type.startsWith('image/') || file.name.endsWith('.svg');
  if (!isImage) {
    return NextResponse.json({ error: '仅支持图片格式（JPG/PNG/GIF/WebP/SVG）' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: '图片大小不能超过 500KB' }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  await ensureBucket(BUCKET);

  const ext = file.name.split('.').pop() || 'png';
  const timestamp = Date.now();
  const path = `${userId}/${timestamp}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();
  const contentType = file.type || (ext === 'svg' ? 'image/svg+xml' : `image/${ext}`);

  const url = await uploadToStorage(BUCKET, path, arrayBuffer, contentType);

  return NextResponse.json({ url });
}
