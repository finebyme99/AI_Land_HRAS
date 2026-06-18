import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getTenantAccessTokenFor } from '@/lib/feishu';
import { getActiveFieldMap } from '@/lib/bitable/field-map-reader';
import { extractValue, type FieldMapEntry } from '@/lib/bitable/field-map';

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

// GET: 从飞书实时读取大赛参赛数据
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

    // 加载字段映射（DB 优先，fallback 硬编码）
    const fieldMap = await getActiveFieldMap(BASE_APP, TABLE_ID, 'progress');

    // 映射字段 + 过滤参赛方案（大赛进展 ≠ 未参赛 且 评审周期非空）
    const allMapped = allRecords.map((r) => mapRecord(r, fieldMap));
    const items = allMapped.filter((d) => {
      const status = d.competitionProgress as string;
      const period = d.reviewPeriod as string;
      return status && status !== '未参赛' && period;
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

    // ── 统计 ──
    // 按周期统计
    const periodMap: Record<string, { total: number; byStatus: Record<string, number> }> = {};
    items.forEach((d) => {
      const p = (d.reviewPeriod as string) || '';
      const s = (d.competitionProgress as string) || '未知';
      if (!periodMap[p]) periodMap[p] = { total: 0, byStatus: {} };
      periodMap[p].total++;
      periodMap[p].byStatus[s] = (periodMap[p].byStatus[s] || 0) + 1;
    });

    // 当期方案
    const currentItems = items.filter((d) => d.reviewPeriod === currentPeriod);

    // 场景分类统计（当期）
    const categoryMap: Record<string, number> = {};
    currentItems.forEach((d) => {
      const cat = (d.sceneCategory as string) || '未分类';
      categoryMap[cat] = (categoryMap[cat] || 0) + 1;
    });

    // 提报团队统计（当期）
    const teamMap: Record<string, number> = {};
    currentItems.forEach((d) => {
      const team = (d.team as string) || '未填写';
      teamMap[team] = (teamMap[team] || 0) + 1;
    });

    // 参赛团队数（当期去重）
    const teamCount = Object.keys(teamMap).filter((t) => t !== '未填写').length;

    // 当期月省总工时
    const totalSavedHours = currentItems.reduce((sum, d) => {
      return sum + ((d.totalSavedHours as number) || (d.monthlySavedHours as number) || 0);
    }, 0);

    return NextResponse.json({
      items: currentItems,
      allItems: items,
      periods,
      currentPeriod,
      stats: {
        total: items.length,
        currentPeriodCount: currentItems.length,
        teamCount,
        totalSavedHours,
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
