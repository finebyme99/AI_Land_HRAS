import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getTenantAccessTokenFor } from '@/lib/feishu';

// ── 飞书多维表格配置 ──
const BASE_APP = 'LRROwulJciI7JYkIT55cQtdpnze';
const TABLE_ID = 'tbl9WJyxl9bbtYjb';
const WIKI_TOKEN = 'LRROwulJciI7JYkIT55cQtdpnze';
const ZT_APP_ID = 'cli_a84a9ed9597fd01c';
const FEISHU_API = 'https://open.feishu.cn/open-apis';

// ── 字段映射（按飞书 API 返回的中文字段名索引）──
const FIELD_MAP: Record<string, { key: string; type: 'text' | 'number' | 'select' | 'multi_select' | 'person' | 'formula' | 'date' | 'url' }> = {
  // 场景信息
  '场景编号':                 { key: 'proposalNo', type: 'text' },
  '场景名称':                 { key: 'title', type: 'text' },
  '一句话简介':               { key: 'briefIntro', type: 'text' },
  '场景分类':                 { key: 'sceneCategory', type: 'select' },
  '核心价值':                 { key: 'coreValue', type: 'select' },
  '场景来源':                 { key: 'sceneSource', type: 'select' },

  // 大赛相关
  '大赛进展':                 { key: 'competitionProgress', type: 'select' },
  '评审周期':                 { key: 'reviewPeriod', type: 'text' },
  '提报人':                   { key: 'submitter', type: 'person' },
  '组队成员':                 { key: 'teamMembers', type: 'person' },
  '提报团队':                 { key: 'team', type: 'select' },
  '提报组队类型':             { key: 'teamType', type: 'select' },
  'AI工具':                  { key: 'aiTools', type: 'multi_select' },

  // 落地进展
  '落地进展':                 { key: 'landingProgress', type: 'select' },

  // AI前指标
  '原业务场景及流程':         { key: 'beforeProcess', type: 'text' },
  '原核心痛点':               { key: 'painPoints', type: 'multi_select' },
  '原操作频次':               { key: 'beforeFreq', type: 'formula' },
  '原操作人数':               { key: 'beforePeopleCount', type: 'number' },
  '原单次操作耗时':           { key: 'beforeHoursPerTask', type: 'number' },
  '原月均耗时':               { key: 'beforeMonthlyHours', type: 'formula' },

  // AI后指标
  '新业务流程':               { key: 'afterProcess', type: 'text' },
  '新操作频次':               { key: 'afterFreq', type: 'formula' },
  '新操作人数':               { key: 'afterPeopleCount', type: 'number' },
  '新单次操作耗时':           { key: 'afterHoursPerTask', type: 'number' },
  '新月均耗时':               { key: 'afterMonthlyHours', type: 'formula' },
  '月均Token费用':            { key: 'aiCost', type: 'number' },

  // 价值计分
  '月均提效节省工时':         { key: 'monthlySavedHours', type: 'formula' },
  '月均降本费用（不含人力成本）': { key: 'monthlySavedCost', type: 'number' },
  '月均降本折算工时':         { key: 'costSavedHours', type: 'formula' },
  '月均节省总工时':           { key: 'totalSavedHours', type: 'formula' },
  '总降本提效比例':           { key: 'totalEfficiencyRate', type: 'formula' },
  '场景归属地区系数':         { key: 'regionCoefficient', type: 'select' },
  '推广复用价值系数':         { key: 'reuseValue', type: 'select' },
  '推广复用价值等级':         { key: 'reuseValueLevel', type: 'select' },
  '最终价值计分':             { key: 'finalValueScore', type: 'formula' },
  '价值排名':                 { key: 'valueRank', type: 'formula' },

  // 实现
  'AI实现过程简述':           { key: 'implementation', type: 'text' },
  'AI实现效果':               { key: 'implementationLink', type: 'url' },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractValue(value: any, type: string): unknown {
  if (value == null) return null;
  switch (type) {
    case 'text':
      if (typeof value === 'string') return value;
      if (Array.isArray(value)) return value.map((v: { text?: string }) => v.text ?? '').join('');
      return String(value);
    case 'number':
      if (typeof value === 'number') return value;
      if (typeof value === 'string') return Number(value) || null;
      return null;
    case 'formula':
      if (typeof value === 'number') return value;
      if (typeof value === 'string') return Number(value) || null;
      if (Array.isArray(value) && value.length > 0) {
        const first = value[0];
        if (typeof first === 'object' && first !== null && 'text' in first) return Number(first.text) || null;
        return Number(first) || null;
      }
      return null;
    case 'select':
      if (typeof value === 'string') return value;
      if (typeof value === 'object' && value !== null && 'text' in value) return value.text;
      if (Array.isArray(value) && value.length > 0) {
        const first = value[0];
        if (typeof first === 'object' && first !== null && 'text' in first) return first.text;
        return String(first);
      }
      return null;
    case 'multi_select':
      if (Array.isArray(value)) {
        return value.map((v: unknown) => {
          if (typeof v === 'string') return v;
          if (typeof v === 'object' && v !== null && 'text' in v) return (v as { text: string }).text;
          return String(v);
        });
      }
      if (typeof value === 'string') return [value];
      return [];
    case 'person':
      if (Array.isArray(value)) {
        return value.map((v: { name?: string; id?: string }) => v.name ?? v.id ?? '');
      }
      if (typeof value === 'object' && value !== null) {
        return [value.name ?? value.id ?? ''];
      }
      return [];
    case 'date':
      if (typeof value === 'number') return new Date(value).toISOString();
      if (typeof value === 'string') return value;
      return null;
    case 'url':
      if (typeof value === 'object' && value !== null && 'link' in value) return value.link;
      if (typeof value === 'string') return value;
      return null;
    default:
      return value;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRecord(record: any): Record<string, unknown> {
  const fields = record.fields ?? {};
  const mapped: Record<string, unknown> = {
    id: record.record_id,
    recordUrl: `https://ztn.feishu.cn/wiki/${WIKI_TOKEN}?table=${TABLE_ID}&record=${record.record_id}`,
  };
  for (const [fieldId, value] of Object.entries(fields)) {
    const config = FIELD_MAP[fieldId];
    if (!config) continue;
    mapped[config.key] = extractValue(value, config.type);
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

    // 映射字段 + 过滤参赛方案（大赛进展 ≠ 未参赛 且 评审周期非空）
    const allMapped = allRecords.map(mapRecord);
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
