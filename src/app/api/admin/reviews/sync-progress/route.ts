import { NextResponse } from 'next/server';
import { getTenantAccessToken } from '@/lib/feishu';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { computeWeightedScore } from '@/types';
import type { CompetitionReview, ReviewerRole } from '@/types';

const FEISHU_API = 'https://open.feishu.cn/open-apis';

// 评审进度表 — wiki 内嵌多维表格
const WIKI_NODE = 'LRROwulJciI7JYkIT55cQtdpnze';
const TABLE_NAME = '评审进度';

const ROLE_LABELS: Record<ReviewerRole, string> = { user: '用户评委', business: '业务评委', tech: '技术评委' };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function feishuGet(url: string, token: string): Promise<any> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const json = await res.json();
  if (json.code !== 0) throw new Error(`飞书 API 错误: ${json.msg ?? JSON.stringify(json)}`);
  return json.data;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function feishuPost(url: string, token: string, body: any): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (json.code !== 0) throw new Error(`飞书 API 错误: ${json.msg ?? JSON.stringify(json)}`);
  return json.data;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function feishuPut(url: string, token: string, body: any): Promise<any> {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (json.code !== 0) throw new Error(`飞书 API 错误: ${json.msg ?? JSON.stringify(json)}`);
  return json.data;
}

/** 通过 wiki 节点获取多维表格的 app_token */
async function getBitableAppToken(token: string): Promise<string> {
  const data = await feishuGet(`${FEISHU_API}/wiki/v2/spaces/get_node?token=${WIKI_NODE}`, token);
  const node = data?.node;
  if (!node?.obj_token) throw new Error('无法获取 wiki 节点的 obj_token');
  return node.obj_token;
}

/** 确保评审进度表存在，返回 table_id */
async function ensureTable(appToken: string, token: string): Promise<string> {
  // 查找已有的表
  const listData = await feishuGet(`${FEISHU_API}/bitable/v1/apps/${appToken}/tables`, token);
  const existing = listData?.items?.find((t: { name: string }) => t.name === TABLE_NAME);
  if (existing) return existing.table_id;

  // 创建新表
  const createData = await feishuPost(`${FEISHU_API}/bitable/v1/apps/${appToken}/tables`, token, {
    table: {
      name: TABLE_NAME,
      default_view_name: '评审进度总览',
      fields: [
        { field_name: '评委姓名', type: 1 },
        { field_name: '部门', type: 1 },
        { field_name: '角色', type: 3, property: { options: [{ name: '用户评委' }, { name: '业务评委' }, { name: '技术评委' }] } },
        { field_name: '分配方案数', type: 2 },
        { field_name: '已评审数', type: 2 },
        { field_name: '进度', type: 1 },
        { field_name: '均分', type: 1 },
        { field_name: '最后评审时间', type: 5 },
      ],
    },
  });
  return createData.table_id;
}

export async function POST() {
  try {
    const token = await getTenantAccessToken();

    // 1. 获取多维表格 app_token（wiki 内嵌）
    const appToken = await getBitableAppToken(token);

    // 2. 确保评审进度表存在
    const tableId = await ensureTable(appToken, token);

    // 3. 从 Supabase 拉取评审记录 + 方案列表
    const supabase = getSupabaseAdmin();
    const [{ data: reviewsData }, { data: subsData }] = await Promise.all([
      supabase.from('competition_reviews').select('*, reviewer:users!reviewer_id(name, department)').order('created_at', { ascending: true }),
      supabase.from('competition_submissions').select('id, reviewers').eq('period', '2605'),
    ]);
    const reviews = (reviewsData ?? []) as (CompetitionReview & { reviewer: { name: string; department: string } })[];
    const submissions = (subsData ?? []) as { id: string; reviewers: string[] | null }[];

    // 4. 汇总每个评委的进度
    const byReviewer: Record<string, {
      name: string; department: string; role: ReviewerRole | null;
      reviewed: number; avgScore: number; scoreCount: number; lastReviewedAt: string | null;
    }> = {};
    for (const r of reviews) {
      const key = r.reviewer_id;
      if (!byReviewer[key]) {
        byReviewer[key] = {
          name: r.reviewer?.name || r.reviewer_id,
          department: r.reviewer?.department || '-',
          role: r.reviewer_role ?? null,
          reviewed: 0, avgScore: 0, scoreCount: 0, lastReviewedAt: null,
        };
      }
      if (r.decision === 'reviewed') {
        byReviewer[key].reviewed++;
        byReviewer[key].lastReviewedAt = r.created_at;
        if (r.scores && r.reviewer_role) {
          byReviewer[key].avgScore += computeWeightedScore(r.scores, r.reviewer_role);
          byReviewer[key].scoreCount++;
        }
      }
    }

    // 5. 拉取多维表格已有记录（用于判重）
    const existingMap = new Map<string, string>(); // 评委姓名 → record_id
    let pageToken: string | undefined;
    do {
      const url = new URL(`${FEISHU_API}/bitable/v1/apps/${appToken}/tables/${tableId}/records`);
      url.searchParams.set('page_size', '200');
      if (pageToken) url.searchParams.set('page_token', pageToken);
      const data = await feishuGet(url.toString(), token);
      for (const rec of data?.items ?? []) {
        const name = rec.fields?.['评委姓名'];
        if (typeof name === 'string') existingMap.set(name, rec.record_id);
      }
      pageToken = data?.has_more ? data.page_token : undefined;
    } while (pageToken);

    // 6. 构建待写入记录
    const toCreate: { fields: Record<string, unknown> }[] = [];
    const toUpdate: { record_id: string; fields: Record<string, unknown> }[] = [];

    for (const rv of Object.values(byReviewer)) {
      const assignedCount = rv.role === 'user'
        ? submissions.filter((s) => s.reviewers?.some((r) => r.includes(rv.name) || rv.name.includes(r))).length
        : submissions.length;
      const avg = rv.scoreCount > 0 ? (rv.avgScore / rv.scoreCount).toFixed(1) : '-';
      const pct = assignedCount > 0 ? `${Math.min(Math.round((rv.reviewed / assignedCount) * 100), 100)}%` : '0%';

      const fields: Record<string, unknown> = {
        '评委姓名': rv.name,
        '部门': rv.department,
        '角色': rv.role ? ROLE_LABELS[rv.role] : '-',
        '分配方案数': assignedCount,
        '已评审数': rv.reviewed,
        '进度': pct,
        '均分': avg,
        '最后评审时间': rv.lastReviewedAt ? new Date(rv.lastReviewedAt).getTime() : null,
      };

      const existingId = existingMap.get(rv.name);
      if (existingId) {
        toUpdate.push({ record_id: existingId, fields });
      } else {
        toCreate.push({ fields });
      }
    }

    // 7. 写入飞书多维表格
    // 新建（批量，每批最多 500）
    for (let i = 0; i < toCreate.length; i += 500) {
      await feishuPost(`${FEISHU_API}/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_create`, token, {
        records: toCreate.slice(i, i + 500),
      });
    }

    // 更新（逐条 PUT）
    let updated = 0;
    for (const rec of toUpdate) {
      await feishuPut(`${FEISHU_API}/bitable/v1/apps/${appToken}/tables/${tableId}/records/${rec.record_id}`, token, {
        fields: rec.fields,
      });
      updated++;
    }

    return NextResponse.json({
      ok: true,
      created: toCreate.length,
      updated,
      tableUrl: `https://ztn.feishu.cn/wiki/${WIKI_NODE}?table=${tableId}`,
    });
  } catch (err) {
    console.error('同步评审进度到飞书失败:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : '同步失败' }, { status: 500 });
  }
}
