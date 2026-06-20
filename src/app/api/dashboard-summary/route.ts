import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getActiveFieldMap } from '@/lib/bitable/field-map-reader';
import { isLandedState } from '@/lib/bitable/enums';

const CURRENT_PERIOD = '2605';

/**
 * GET /api/dashboard-summary
 *
 * 公开接口：首页指标带使用。
 * 聚合 competition_submissions 表的三个指标：
 *   - totalMonthlySavedHours: SUM(total_monthly_saved_hours) — 月均节省总工时
 *   - totalPeople: SUM(before_people_count) — 总覆盖执行人数
 *   - landedCount: COUNT where landing_progress 为已落地状态 — 已落地场景数
 *
 * 数据口径与 ChoDashboard 成效看板一致：
 *   period=CURRENT_PERIOD + status='评审中' + scene_source='AI大赛'
 */
export async function GET() {
  const supabase = getSupabaseAdmin();

  try {
    // 获取字段映射（sync 角色，与 ChoDashboard 一致）
    await getActiveFieldMap('LRROwulJciI7JYkIT55cQtdpnze', 'tbl9WJyxl9bbtYjb', 'sync');

    const { data, error } = await supabase
      .from('competition_submissions')
      .select('total_monthly_saved_hours, before_people_count, landing_progress')
      .eq('period', CURRENT_PERIOD)
      .eq('status', '评审中')
      .eq('scene_source', 'AI大赛');

    if (error) throw error;

    const rows = data ?? [];
    const totalMonthlySavedHours = rows.reduce(
      (sum, r) => sum + (r.total_monthly_saved_hours ?? 0), 0
    );
    const totalPeople = rows.reduce(
      (sum, r) => sum + (r.before_people_count ?? 0), 0
    );
    const landedCount = rows.filter(
      (r) => isLandedState(r.landing_progress ?? '')
    ).length;

    return NextResponse.json({
      totalMonthlySavedHours,
      totalPeople,
      landedCount,
    });
  } catch (err) {
    console.error('dashboard-summary error:', err);
    return NextResponse.json(
      { totalMonthlySavedHours: 0, totalPeople: 0, landedCount: 0 },
      { status: 200 }
    );
  }
}
