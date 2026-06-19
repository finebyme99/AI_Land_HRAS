import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * GET /api/dashboard-summary
 *
 * 公开接口：首页提效数据总览卡片使用。
 * 聚合 competition_submissions 表的两个指标：
 *   - totalMonthlySavedHours: SUM(total_monthly_saved_hours) — 月均节省总工时
 *   - totalPeople: SUM(before_people_count) — 总覆盖执行人数
 *
 * 数据口径与 ChoDashboard 成效看板一致，仅统计 status='评审中' 的方案。
 */
export async function GET() {
  const supabase = getSupabaseAdmin();

  try {
    const { data, error } = await supabase
      .from('competition_submissions')
      .select('total_monthly_saved_hours, before_people_count')
      .eq('status', '评审中');

    if (error) throw error;

    const rows = data ?? [];
    const totalMonthlySavedHours = rows.reduce(
      (sum, r) => sum + (r.total_monthly_saved_hours ?? 0), 0
    );
    const totalPeople = rows.reduce(
      (sum, r) => sum + (r.before_people_count ?? 0), 0
    );

    return NextResponse.json({
      totalMonthlySavedHours,
      totalPeople,
    });
  } catch (err) {
    console.error('dashboard-summary error:', err);
    return NextResponse.json(
      { totalMonthlySavedHours: 0, totalPeople: 0 },
      { status: 200 }
    );
  }
}
