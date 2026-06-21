import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getTenantAccessTokenFor } from '@/lib/feishu';
import { getActiveFieldMap } from '@/lib/bitable/field-map-reader';
import { mapFeishuRecord } from '@/lib/bitable/field-map';
import { isLandedState } from '@/lib/bitable/enums';
import {
  assignValueStarLevels,
  collectFieldDescriptions,
  collectFieldOptions,
  filterExcludedBitableRecords,
  summarizeValueMetrics,
} from '@/lib/bitable/metrics';

// ── 飞书多维表格配置 ──
const BASE_APP = 'LRROwulJciI7JYkIT55cQtdpnze';
const TABLE_ID = 'tbl9WJyxl9bbtYjb';
const WIKI_TOKEN = 'LRROwulJciI7JYkIT55cQtdpnze';
const VIEW_ID = 'vewKWNtKDJ';  // 场景池视图
const ZT_APP_ID = 'cli_a84a9ed9597fd01c';
const FEISHU_API = 'https://open.feishu.cn/open-apis';

// GET: 从飞书实时读取场景池数据
export async function GET() {
  try {
    // 从数据库获取 ZT 应用凭证
    const { data: app } = await getSupabaseAdmin()
      .from('feishu_apps')
      .select('app_id, app_secret')
      .eq('app_id', ZT_APP_ID)
      .single();

    if (!app) {
      return NextResponse.json({ error: '未找到 ZT 飞书应用' }, { status: 500 });
    }

    const token = await getTenantAccessTokenFor(app.app_id, app.app_secret);

    // 分页拉取飞书记录
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allRecords: any[] = [];
    let pageToken: string | undefined;

    do {
      const url = new URL(`${FEISHU_API}/bitable/v1/apps/${BASE_APP}/tables/${TABLE_ID}/records`);
      url.searchParams.set('page_size', '100');
      url.searchParams.set('view_id', VIEW_ID);  // 使用场景池视图
      if (pageToken) url.searchParams.set('page_token', pageToken);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();

      if (!res.ok || json.code !== 0) {
        throw new Error(`飞书 API 错误: ${json.msg ?? res.status}`);
      }

      allRecords.push(...(json.data?.items ?? []));
      pageToken = json.data?.has_more ? json.data.page_token : undefined;
    } while (pageToken);

    // 加载字段映射（DB 优先，fallback 硬编码）
    const fieldMap = await getActiveFieldMap(BASE_APP, TABLE_ID, 'wish-pool');

    const fieldDescriptions = collectFieldDescriptions(fieldMap);
    const fieldOptions = collectFieldOptions(fieldMap);

    // 映射字段
    const rawItems = allRecords.map((record) => mapFeishuRecord(
      record,
      (recordId) => `https://ztn.feishu.cn/wiki/${WIKI_TOKEN}?table=${TABLE_ID}&view=${VIEW_ID}&record=${recordId}`,
      fieldMap,
    ));

    // 过滤脏数据：排除大赛进展或落地进展为"数据补充中"的记录
    const items = filterExcludedBitableRecords(rawItems);

    // 价值星级计算（前端计算字段，不从飞书同步）
    // 按 finalValueScore 降序排序，根据排名百分位分配星级
    assignValueStarLevels(items);
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
      fieldDescriptions,
      fieldOptions,
      stats: {
        total,
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
