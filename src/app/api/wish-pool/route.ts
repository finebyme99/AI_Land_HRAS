import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getTenantAccessTokenFor } from '@/lib/feishu';

// ── 飞书多维表格配置 ──
const BASE_APP = 'LRROwulJciI7JYkIT55cQtdpnze';
const TABLE_ID = 'tbl9WJyxl9bbtYjb';
const WIKI_TOKEN = 'LRROwulJciI7JYkIT55cQtdpnze';
const VIEW_ID = 'vewKWNtKDJ';  // 场景池视图
const ZT_APP_ID = 'cli_a84a9ed9597fd01c';
const FEISHU_API = 'https://open.feishu.cn/open-apis';

// ── 字段映射（按飞书 API 返回的中文字段名索引）──
// 飞书 bitable API 的 records 接口以字段名（非 field_id）作为 key
const FIELD_MAP: Record<string, { key: string; type: 'text' | 'number' | 'select' | 'multi_select' | 'person' | 'formula' | 'date' | 'url' }> = {
  // 场景信息
  '场景编号':             { key: 'proposalNo', type: 'text' },
  '场景名称':             { key: 'title', type: 'text' },
  '一句话简介':           { key: 'briefIntro', type: 'text' },
  '场景分类':             { key: 'sceneCategory', type: 'select' },
  '核心价值':             { key: 'coreValue', type: 'select' },
  '场景来源':             { key: 'sceneSource', type: 'select' },
  '业务负责人':           { key: 'bizOwner', type: 'person' },
  'AI负责人':            { key: 'aiOwner', type: 'person' },

  // 落地进展
  '落地进展':             { key: 'landingProgress', type: 'select' },
  '计划启动日期':         { key: 'plannedStartDate', type: 'date' },
  '试点上线日期':         { key: 'pilotDate', type: 'date' },
  '推广上线日期':         { key: 'rolloutDate', type: 'date' },
  '全面上线日期':         { key: 'fullLaunchDate', type: 'date' },
  '进展记录&链接':        { key: 'progressRecord', type: 'text' },

  // AI大赛
  '大赛进展':             { key: 'competitionProgress', type: 'select' },
  '评审周期':             { key: 'reviewPeriod', type: 'text' },
  '提报人':               { key: 'submitter', type: 'person' },
  '组队成员':             { key: 'teamMembers', type: 'person' },
  '创建人':               { key: 'creator', type: 'person' },
  '提报团队':             { key: 'team', type: 'select' },
  '提报组队类型':         { key: 'teamType', type: 'select' },
  'AI工具':              { key: 'aiTools', type: 'multi_select' },

  // AI前指标
  '原业务场景及流程':     { key: 'beforeProcess', type: 'text' },
  '原核心痛点':           { key: 'painPoints', type: 'multi_select' },
  '原操作频率':           { key: 'beforeFrequency', type: 'select' },
  '原操作次数':           { key: 'beforeOperationCount', type: 'number' },
  '原操作频次':           { key: 'beforeFreq', type: 'formula' },
  '原操作人数':           { key: 'beforePeopleCount', type: 'number' },
  '原单次操作耗时':       { key: 'beforeHoursPerTask', type: 'number' },
  '原月均耗时':           { key: 'beforeMonthlyHours', type: 'formula' },

  // AI后指标
  '新业务流程':           { key: 'afterProcess', type: 'text' },
  '新操作频率':           { key: 'afterFrequency', type: 'select' },
  '新操作次数':           { key: 'afterOperationCount', type: 'number' },
  '新操作频次':           { key: 'afterFreq', type: 'formula' },
  '新操作人数':           { key: 'afterPeopleCount', type: 'number' },
  '新单次操作耗时':       { key: 'afterHoursPerTask', type: 'number' },
  '新月均耗时':           { key: 'afterMonthlyHours', type: 'formula' },
  '月均Token费用':        { key: 'aiCost', type: 'number' },

  // 价值计分
  '月均提效节省工时':     { key: 'monthlySavedHours', type: 'formula' },
  '月均降本费用（不含人力成本）': { key: 'monthlySavedCost', type: 'number' },
  '降本费用说明':         { key: 'costReductionNote', type: 'text' },
  '月均降本折算工时':     { key: 'costSavedHours', type: 'formula' },
  '月均节省总工时':       { key: 'totalSavedHours', type: 'formula' },
  '总降本提效比例':       { key: 'totalEfficiencyRate', type: 'formula' },
  '场景归属地区系数':     { key: 'regionCoefficient', type: 'select' },
  '场景归属地区系数值':   { key: 'regionCoefficientValue', type: 'number' },
  '推广复用价值系数':     { key: 'reuseValue', type: 'select' },
  '推广复用价值系数值':   { key: 'reuseValueNumber', type: 'number' },
  '推广复用价值等级':     { key: 'reuseValueLevel', type: 'select' },
  '最终价值计分':         { key: 'finalValueScore', type: 'formula' },
  '价值排名':             { key: 'valueRank', type: 'formula' },

  // 实现过程
  'AI实现过程简述':       { key: 'implementation', type: 'text' },
  'AI实现效果':           { key: 'implementationLink', type: 'url' },
};

// 构建反向映射（key → fieldId）
const KEY_TO_FIELD_ID: Record<string, string> = {};
for (const [fieldId, config] of Object.entries(FIELD_MAP)) {
  KEY_TO_FIELD_ID[config.key] = fieldId;
}

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
      // 飞书公式字段返回值类型不固定：可能是 number、string、或 [{text}] 数组
      if (typeof value === 'number') return value;
      if (typeof value === 'string') return Number(value) || null;
      if (Array.isArray(value) && value.length > 0) {
        const first = value[0];
        if (typeof first === 'object' && first !== null && 'text' in first) return Number(first.text) || null;
        return Number(first) || null;
      }
      return null;

    case 'select':
      // 飞书单选字段可能返回纯字符串或 {text} 对象
      if (typeof value === 'string') return value;
      if (typeof value === 'object' && value !== null && 'text' in value) return value.text;
      if (Array.isArray(value) && value.length > 0) {
        const first = value[0];
        if (typeof first === 'object' && first !== null && 'text' in first) return first.text;
        return String(first);
      }
      return null;

    case 'multi_select':
      // 飞书多选字段可能返回纯字符串数组或 [{text}] 数组
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
      // 单个人员字段可能返回单个对象
      if (typeof value === 'object' && value !== null) {
        return [value.name ?? value.id ?? ''];
      }
      return [];

    case 'date':
      // 飞书日期字段返回时间戳（毫秒）
      if (typeof value === 'number') return new Date(value).toISOString();
      if (typeof value === 'string') return value;
      return null;

    case 'url':
      // 飞书链接字段返回 {link, text} 对象或纯字符串
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
    recordUrl: `https://ztn.feishu.cn/wiki/${WIKI_TOKEN}?table=${TABLE_ID}&view=${VIEW_ID}&record=${record.record_id}`,
  };

  for (const [fieldId, value] of Object.entries(fields)) {
    const config = FIELD_MAP[fieldId];
    if (!config) continue;
    mapped[config.key] = extractValue(value, config.type);
  }

  return mapped;
}

// GET: 从飞书实时读取场景池数据
export async function GET(request: NextRequest) {
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

    // 映射字段
    const items = allRecords.map(mapRecord);

    // 计算统计指标
    const total = items.length;
    const withScore = items.filter((d) => d.finalValueScore != null && (d.finalValueScore as number) > 0);
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

    // 价值排名排序
    const ranked = [...items]
      .filter((d) => d.valueRank != null)
      .sort((a, b) => ((a.valueRank as number) ?? 999) - ((b.valueRank as number) ?? 999));

    return NextResponse.json({
      items,
      ranked,
      total,
      stats: {
        total,
        avgScore,
        withScoreCount: withScore.length,
        progressMap,
        contestMap,
        categoryMap,
        teamMap,
      },
    });
  } catch (err) {
    console.error('获取场景池数据失败:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
