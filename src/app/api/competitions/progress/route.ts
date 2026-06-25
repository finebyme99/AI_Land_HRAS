import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getActiveFieldMap } from '@/lib/bitable/field-map-reader';
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

// GET: 从 Supabase 快照读取大赛参赛数据（WishItem 格式，与 wish-pool API 对齐）
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const [{ data, error }, fieldMap] = await Promise.all([
      supabase
        .from('competition_submissions')
        .select(COMPETITION_SNAPSHOT_SELECT)
        .order('period', { ascending: true })
        .order('final_value_score', { ascending: false, nullsFirst: false }),
      getActiveFieldMap(BASE_APP, TABLE_ID, 'wish-pool'),
    ]);
    if (error) throw error;

    const fieldDescriptions = collectFieldDescriptions(fieldMap);
    const fieldOptions = collectFieldOptions(fieldMap);

    const snapshotRows = (data ?? []) as unknown as CompetitionSnapshotRow[];
    const lastSyncedAt = getLatestSyncedAt(snapshotRows);
    const allMapped = snapshotRows.map(mapCompetitionSnapshotRowToWishItem);
    const cleanItems = filterExcludedBitableRecords(allMapped);

    // 过滤参赛方案（只上岛：评审中 + 终审通过 + 有评审周期）
    const items = cleanItems.filter((d) => {
      const status = d.competitionProgress as string;
      const period = d.reviewPeriod as string;
      return (status === '评审中' || status === '终审通过') && period;
    });

    // ── 价值星级计算（同 wish-pool API）──
    assignValueStarLevels(items as unknown as Record<string, unknown>[]);

    // ── 复用价值系数数值提取 ──
    items.forEach((d) => {
      if (d.reuseValueNumber == null && d.reuseValue) {
        const m = String(d.reuseValue).match(/×(\d+)/);
        if (m) d.reuseValueNumber = Number(m[1]);
      }
    });

    // 提取所有评审周期（去重 + 排序）
    const periodSet = new Set<string>();
    items.forEach((d) => {
      const p = d.reviewPeriod as string;
      if (p) periodSet.add(p);
    });
    const periods = Array.from(periodSet).sort();

    // 推断当前期（最新期）
    const currentPeriod = periods.length > 0 ? periods[periods.length - 1] : '';

    // ── 按周期统计 ──
    const periodMap: Record<string, { total: number; byStatus: Record<string, number> }> = {};
    items.forEach((d) => {
      const p = (d.reviewPeriod as string) || '';
      const s = (d.competitionProgress as string) || '未知';
      if (!periodMap[p]) periodMap[p] = { total: 0, byStatus: {} };
      periodMap[p].total++;
      periodMap[p].byStatus[s] = (periodMap[p].byStatus[s] || 0) + 1;
    });

    // ── 5指标 summary（口径与 ChoDashboard 对齐）──
    // 注意：summary 基于 items（当前期数据），随前端 selectedPeriod 变化会重新计算
    const computeSummary = (list: object[]) => {
      return summarizeValueMetrics(list);
    };

    // 当前期的 summary
    const currentItems = items.filter((d) => d.reviewPeriod === currentPeriod);
    const summary = computeSummary(currentItems);

    // 全量 summary（跨所有周期）
    const globalSummary = computeSummary(items);

    // 当期的补充统计（保留给前端分类等用途）
    const categoryMap: Record<string, number> = {};
    currentItems.forEach((d) => {
      const cat = (d.sceneCategory as string) || '未分类';
      categoryMap[cat] = (categoryMap[cat] || 0) + 1;
    });
    const teamMap: Record<string, number> = {};
    currentItems.forEach((d) => {
      const team = (d.team as string) || '未填写';
      teamMap[team] = (teamMap[team] || 0) + 1;
    });
    const teamCount = Object.keys(teamMap).filter((t) => t !== '未填写').length;

    return NextResponse.json({
      items: currentItems,
      allItems: items,
      periods,
      currentPeriod,
      lastSyncedAt,
      fieldDescriptions,
      fieldOptions,
      summary,
      globalSummary,
      stats: {
        total: items.length,
        currentPeriodCount: currentItems.length,
        teamCount,
        totalSavedHours: summary.totalSavedEfficiency,
        categoryMap,
        teamMap,
        periodMap,
      },
    });
  } catch (err) {
    console.error('获取大赛进展数据失败:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
