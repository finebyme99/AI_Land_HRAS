import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getActiveFieldMap } from '@/lib/bitable/field-map-reader';
import { isLandedState } from '@/lib/bitable/enums';
import {
  COMPETITION_SNAPSHOT_SELECT,
  mapCompetitionSnapshotRowToWishItem,
  type CompetitionSnapshotRow,
} from '@/lib/competition-snapshot';
import {
  assignValueStarLevels,
  collectFieldDescriptions,
  collectFieldOptions,
  filterExcludedBitableRecords,
  summarizeValueMetrics,
} from '@/lib/bitable/metrics';
import { getLatestSyncedAt } from '@/lib/sync-status';

const BASE_APP = 'LRROwulJciI7JYkIT55cQtdpnze';
const TABLE_ID = 'tbl9WJyxl9bbtYjb';

// GET: 从 Supabase 快照读取场景池数据。飞书同步由手动/定时同步入口刷新快照。
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const [{ data, error }, fieldMap] = await Promise.all([
      supabase
        .from('competition_submissions')
        .select(COMPETITION_SNAPSHOT_SELECT)
        .order('final_value_score', { ascending: false, nullsFirst: false }),
      getActiveFieldMap(BASE_APP, TABLE_ID, 'wish-pool'),
    ]);
    if (error) throw error;

    const fieldDescriptions = collectFieldDescriptions(fieldMap);
    const fieldOptions = collectFieldOptions(fieldMap);

    const snapshotRows = (data ?? []) as unknown as CompetitionSnapshotRow[];
    const lastSyncedAt = getLatestSyncedAt(snapshotRows);
    const rawItems = snapshotRows.map(mapCompetitionSnapshotRowToWishItem);
    const items = filterExcludedBitableRecords(rawItems);

    // 价值星级计算（前端计算字段，不从飞书同步）
    // 按 finalValueScore 降序排序，根据排名百分位分配星级
    assignValueStarLevels(items as unknown as Record<string, unknown>[]);
    const withScore = items.filter((d) => d.finalValueScore != null && (d.finalValueScore as number) > 0);

    // 计算统计指标
    const total = items.length;
    const avgScore = withScore.length > 0
      ? Math.round(withScore.reduce((s, d) => s + (d.finalValueScore as number), 0) / withScore.length * 10) / 10
      : 0;

    // 落地进展统计
    const progressMap: Record<string, number> = {};
    items.forEach((d) => {
      const prog = (d.landingProgress as string) || '未标记';
      progressMap[prog] = (progressMap[prog] || 0) + 1;
    });

    // 大赛进展统计
    const contestMap: Record<string, number> = {};
    items.forEach((d) => {
      const contest = (d.competitionProgress as string) || '未参赛';
      contestMap[contest] = (contestMap[contest] || 0) + 1;
    });

    // 场景分类统计
    const categoryMap: Record<string, number> = {};
    items.forEach((d) => {
      const cat = (d.sceneCategory as string) || '未分类';
      categoryMap[cat] = (categoryMap[cat] || 0) + 1;
    });

    // 提报团队统计（select 类型，单个字符串值）
    const teamMap: Record<string, number> = {};
    items.forEach((d) => {
      const team = (d.team as string) || '';
      const label = team || '未填写';
      teamMap[label] = (teamMap[label] || 0) + 1;
    });

    // 新增指标：已落地场景数（动态判断所有"上线"状态）
    const landedCount = Object.entries(progressMap)
      .filter(([k]) => isLandedState(k))
      .reduce((s, [, v]) => s + v, 0);

    const valueSummary = summarizeValueMetrics(items);

    // 价值排名排序
    const ranked = [...items]
      .filter((d) => d.valueRank != null)
      .sort((a, b) => ((a.valueRank as number) ?? 999) - ((b.valueRank as number) ?? 999));

    return NextResponse.json({
      items,
      ranked,
      total,
      lastSyncedAt,
      fieldDescriptions,
      fieldOptions,
      stats: {
        total,
        lastSyncedAt,
        avgScore,
        withScoreCount: withScore.length,
        progressMap,
        contestMap,
        categoryMap,
        teamMap,
        landedCount,
        totalMonthlySavedHours: valueSummary.totalSavedEfficiency,
        totalSavedEfficiency: valueSummary.totalSavedEfficiency,
        totalMonthlySavedHoursSum: valueSummary.totalMonthlySavedHoursSum,
        totalMonthlySavedCost: valueSummary.totalMonthlySavedCost,
      },
    });
  } catch (err) {
    console.error('获取场景池数据失败:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
