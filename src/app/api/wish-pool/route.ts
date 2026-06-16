import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getTenantAccessTokenFor } from '@/lib/feishu';

// ── 飞书多维表格配置 ──
const BASE_APP = 'LRROwulJciI7JYkIT55cQtdpnze';
const TABLE_ID = 'tbl9WJyxl9bbtYjb';
const WIKI_TOKEN = 'LRROwulJciI7JYkIT55cQtdpnze';
const VIEW_ID = 'vewKWNtKDJ';  // 许愿池视图
const ZT_APP_ID = 'cli_a84a9ed9597fd01c';
const FEISHU_API = 'https://open.feishu.cn/open-apis';

// ── 字段ID映射（避免改名后失效）──
const FIELD_MAP: Record<string, { key: string; type: 'text' | 'number' | 'select' | 'multi_select' | 'person' | 'formula' }> = {
  fldDcOTnW4: { key: 'title', type: 'text' },
  fldlpawKgA: { key: 'briefIntro', type: 'text' },
  fldE8SZzmI: { key: 'sceneCategory', type: 'select' },
  fldPxacMpt: { key: 'coreValue', type: 'select' },
  fldThy9kKb: { key: 'sceneSource', type: 'select' },
  fldXhEnBvg: { key: 'regionCoefficient', type: 'select' },
  fldhwT0rxo: { key: 'landingProgress', type: 'select' },
  fldB6kfpnh: { key: 'competitionProgress', type: 'select' },
  fldOPdGFRc: { key: 'bizOwner', type: 'person' },
  fld3pVZQVL: { key: 'aiOwner', type: 'person' },
  fld9yLQYLi: { key: 'submitter', type: 'person' },
  fldOgRb9sy: { key: 'teamMembers', type: 'person' },
  fldSV3R1G8: { key: 'team', type: 'multi_select' },
  fldtBn1gev: { key: 'teamType', type: 'select' },
  fldkkE1EGV: { key: 'beforeProcess', type: 'text' },
  fldNALVQXX: { key: 'painPoints', type: 'multi_select' },
  fldUptCqVS: { key: 'beforeFrequency', type: 'select' },
  fldw19zbWG: { key: 'beforeOperationCount', type: 'number' },
  fldDtaPr2p: { key: 'beforeFreq', type: 'formula' },
  fldx49PLQr: { key: 'beforePeopleCount', type: 'number' },
  fldV4jkM2n: { key: 'beforeHoursPerTask', type: 'number' },
  fldmy5aJih: { key: 'beforeMonthlyHours', type: 'formula' },
  fld6rI1t6G: { key: 'monthlySavedHours', type: 'formula' },
  fldzOLsLo8: { key: 'monthlySavedCost', type: 'number' },
  flddlLIFbK: { key: 'costReductionNote', type: 'text' },
  fldDSt92Tf: { key: 'costSavedHours', type: 'formula' },
  fld5C3AaoI: { key: 'totalSavedHours', type: 'formula' },
  fld7o13soD: { key: 'afterProcess', type: 'text' },
  fldsfXkpC8: { key: 'afterFrequency', type: 'select' },
  fldGv5AfiQ: { key: 'afterOperationCount', type: 'number' },
  fld5yUP3uT: { key: 'afterFreq', type: 'formula' },
  fldn45vqCo: { key: 'afterPeopleCount', type: 'number' },
  flda1D6jod: { key: 'afterHoursPerTask', type: 'number' },
  fldsCdkEyn: { key: 'afterMonthlyHours', type: 'formula' },
  fld4DkPbMz: { key: 'reuseValue', type: 'select' },
  fldbn5SIVj: { key: 'totalEfficiencyRate', type: 'formula' },
  fldkABrLqx: { key: 'finalValueScore', type: 'formula' },
  flddtbTw7z: { key: 'valueRank', type: 'formula' },
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
      return typeof value === 'number' ? value : Number(value) || null;

    case 'formula':
      if (typeof value === 'number') return value;
      if (typeof value === 'string') return Number(value) || null;
      if (Array.isArray(value) && value.length > 0) {
        const first = value[0];
        if (typeof first === 'object' && 'text' in first) return Number(first.text) || null;
        return Number(first) || null;
      }
      return null;

    case 'select':
      if (typeof value === 'object' && value !== null && 'text' in value) return value.text;
      if (Array.isArray(value) && value.length > 0) {
        const first = value[0];
        if (typeof first === 'object' && 'text' in first) return first.text;
        return String(first);
      }
      if (typeof value === 'string') return value;
      return null;

    case 'multi_select':
      if (Array.isArray(value)) {
        return value.map((v: unknown) => {
          if (typeof v === 'object' && v !== null && 'text' in v) return (v as { text: string }).text;
          return String(v);
        });
      }
      return [];

    case 'person':
      if (Array.isArray(value)) {
        return value.map((v: { name?: string; id?: string }) => v.name ?? v.id ?? '');
      }
      return [];

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

// GET: 从飞书实时读取许愿池数据
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
      url.searchParams.set('view_id', VIEW_ID);  // 使用许愿池视图
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

    // 提报团队统计
    const teamMap: Record<string, number> = {};
    items.forEach((d) => {
      const teams = (d.team as string[]) || [];
      if (teams.length === 0) {
        teamMap['未填写'] = (teamMap['未填写'] || 0) + 1;
      } else {
        teams.forEach((t) => {
          teamMap[t] = (teamMap[t] || 0) + 1;
        });
      }
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
    console.error('获取许愿池数据失败:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
