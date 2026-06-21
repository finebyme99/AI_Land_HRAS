import { NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

async function requireSettingsEditor(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) return null;
  if (!(await hasPermission(userId, 'settings.save'))) return null;
  return { id: userId };
}

// GET /api/admin/settings — 获取平台设置
export async function GET(request: NextRequest) {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('platform_settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (error || !data) {
      // 返回默认值
      return NextResponse.json({
        saved_hours: 0,
        participant_count: 0,
        award_count: 0,
        updated_at: null,
      });
    }

    return NextResponse.json({
      saved_hours: data.saved_hours || 0,
      participant_count: data.participant_count || 0,
      award_count: data.award_count || 0,
      updated_at: data.updated_at,
    });
  } catch {
    return NextResponse.json({ saved_hours: 0, participant_count: 0, award_count: 0, updated_at: null });
  }
}

// PUT /api/admin/settings — 更新平台设置（admin only）
export async function PUT(request: NextRequest) {
  const editor = await requireSettingsEditor(request);
  if (!editor) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  try {
    const { saved_hours, participant_count, award_count } = await request.json();

    const { error } = await getSupabaseAdmin()
      .from('platform_settings')
      .upsert({
        id: 1,
        saved_hours: saved_hours ?? 0,
        participant_count: participant_count ?? 0,
        award_count: award_count ?? 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }
}
