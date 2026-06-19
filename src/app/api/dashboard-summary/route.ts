import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const LANDED_STATES = ['试点上线', '推广上线', '全面上线'];

/**
 * GET /api/dashboard-summary
 *
 * 公开接口：首页指标带使用。
 * 聚合 competition_submissions 表的三个指标：
 *   - totalMonthlySavedHours: SUM(total_monthly_saved_hours) — 月均节省总工时
 *   - totalPeople: SUM(before_people_count) — 总覆盖执行人数
 *   - landedCount: COUNT where landing_progress in LANDED_STATES — 已落地场景数
 *
 * 数据口径与 ChoDashboard 成效看板一致，仅统计 status='评审中' 的方案。
 */
export async function GET() {
  const supabase = getSupabaseAdmin();

  try {
    const { data, error } = await supabase
      .from('competition_submissions')
      .select('total_monthly_saved_hours, before_people_count, landing_progress')
      .eq('status', '评审中');

    if (error) throw error;

    const rows = data ?? [];
    const totalMonthlySavedHours = rows.reduce(
      (sum, r) => sum + (r.total_monthly_saved_hours ?? 0), 0
    );
    const totalPeople = rows.reduce(
      (sum, r) => sum + (r.before_people_count ?? 0), 0
    );
    const landedCount = rows.filter(
      (r) => LANDED_STATES.includes(r.landing_progress)
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
