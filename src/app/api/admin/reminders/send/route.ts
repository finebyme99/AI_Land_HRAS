import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { executeReminders } from '@/lib/reminder-service';

async function requireAdmin(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) return null;
  const { data: user } = await getSupabaseAdmin()
    .from('users').select('id, roles').eq('id', userId).single();
  if (!user || !user.roles?.includes('admin')) return null;
  return user;
}

// POST — 手动触发发送
// ?dry_run=true 只预览不发送（生产环境安全）
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: '仅管理员可操作' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const dryRun = searchParams.get('dry_run') === 'true';

  try {
    const result = await executeReminders(dryRun);
    return NextResponse.json({
      dry_run: dryRun,
      ...result,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : '发送失败',
    }, { status: 500 });
  }
}
