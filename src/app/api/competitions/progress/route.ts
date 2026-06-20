import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getTenantAccessTokenFor } from '@/lib/feishu';
import { getActiveFieldMap } from '@/lib/bitable/field-map-reader';
import { extractValue, type FieldMapEntry, type FieldSelectOption } from '@/lib/bitable/field-map';

// ── 飞书多维表格配置 ──
const BASE_APP = 'LRROwulJciI7JYkIT55cQtdpnze';
const TABLE_ID = 'tbl9WJyxl9bbtYjb';
const WIKI_TOKEN = 'LRROwulJciI7JYkIT55cQtdpnze';
const ZT_APP_ID = 'cli_a84a9ed9597fd01c';
const FEISHU_API = 'https://open.feishu.cn/open-apis';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRecord(record: any, map: Record<string, FieldMapEntry>): Record<string, unknown> {
  const fields = record.fields ?? {};
  const mapped: Record<string, unknown> = {
    id: record.record_id,
    recordUrl: `https://ztn.feishu.cn/wiki/${WIKI_TOKEN}?table=${TABLE_ID}&record=${record.record_id}`,
  };
  for (const [fieldId, value] of Object.entries(fields)) {
    const entry = map[fieldId];
    if (!entry) continue;
    mapped[entry.key] = extractValue(value, entry.type);
  }
  return mapped;
}

// GET: 从飞书实时读取大赛参赛数据（WishItem 格式，与 wish-pool API 对齐）
export async function GET() {
  try {
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

    // 加载字段映射（DB 优先，fallback 硬编码）——用 wish-pool role 获取完整字段集
    const fieldMap = await getActiveFieldMap(BASE_APP, TABLE_ID, 'wish-pool');

    // 字段注释 map：前端 key → 飞书字段注释（用于表头问号 tooltip）
    const fieldDescriptions: Record<string, string> = {};
    for (const entry of Object.values(fieldMap)) {
      if (entry.description) fieldDescriptions[entry.key] = entry.description;
    }

    // select 字段选项列表（用于前端筛选枚举动态化）
    const fieldOptions: Record<string, FieldSelectOption[]> = {};
    for (const entry of Object.values(fieldMap)) {
      if (entry.options && entry.options.length > 0) {
        fieldOptions[entry.key] = entry.options;
      }
    }
    // 永久排除"数据补充中"选项
    for (const key of ['landingProgress', 'competitionProgress']) {
      if (fieldOptions[key]) {
        fieldOptions[key] = fieldOptions[key].filter(o => o.name !== '数据补充中');
      }
    }

    // 映射字段 + 过滤脏数据（排除"数据补充中"）
    const allMapped = allRecords.map((r) => mapRecord(r, fieldMap));
    const cleanItems = allMapped.filter((d) =>
      (d.competitionProgress as string) !== '数据补充中' &&
      (d.landingProgress as string) !== '数据补充中'
    );

    // 过滤参赛方案（只上岛：评审中 + 终审通过 + 有评审周期）
    const items = cleanItems.filter((d) => {
      const status = d.competitionProgress as string;
      const period = d.reviewPeriod as string;
      return (status === '评审中' || status === '终审通过') && period;
    });

    // ── 价值星级计算（同 wish-pool API）──
    const withScore = items.filter((d) => d.finalValueScore != null && (d.finalValueScore as number) > 0);
    withScore.sort((a, b) => ((b.finalValueScore as number) ?? 0) - ((a.finalValueScore as number) ?? 0));
    const scoreTotal = withScore.length;
    withScore.forEach((d, idx) => {
      const percentile = (idx + 1) / scoreTotal;
      if (percentile <= 0.2) d.valueStarLevel = 5;
      else if (percentile <= 0.4) d.valueStarLevel = 4;
      else if (percentile <= 0.6) d.valueStarLevel = 3;
      else if (percentile <= 0.8) d.valueStarLevel = 2;
      else d.valueStarLevel = 1;
    });
    // 无 finalValueScore 的不评级
    items.filter((d) => !d.finalValueScore || (d.finalValueScore as number) <= 0)
      .forEach((d) => { d.valueStarLevel = null; });

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
    const computeSummary = (list: Record<string, unknown>[]) => {
      const count = list.length;
      const totalPeople = list.reduce((sum, d) => sum + ((d.beforePeopleCount as number) ?? 0), 0);
      // 月均提效节省工时：monthlySavedHours 飞书公式字段求和
      const totalSavedEfficiency = Math.round(list.reduce((sum, d) => sum + ((d.monthlySavedHours as number) ?? 0), 0) * 10) / 10;
      // 月均降本费用：monthlySavedCost 解析数值求和
      const totalMonthlySavedCost = list.reduce((sum, d) => {
        const cost = d.monthlySavedCost as number | string | null;
        if (!cost) return sum;
        const num = typeof cost === 'number' ? cost : parseFloat(String(cost).replace(/[^0-9.\-]/g, ''));
        return sum + (num > 0 ? num : 0);
      }, 0);
      const totalMonthlySavedCostDisplay = totalMonthlySavedCost > 0 ? `¥${Math.round(totalMonthlySavedCost)}` : '—';
      // 月均节省总工时：totalSavedHours 飞书公式字段求和
      const totalMonthlySavedHoursSum = Math.round(list.reduce((sum, d) => sum + ((d.totalSavedHours as number) ?? 0), 0) * 10) / 10;
      return {
        count,
        totalPeople,
        totalSavedEfficiency,
        totalMonthlySavedCostDisplay,
        totalMonthlySavedHoursSum,
      };
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
