import { NextRequest, NextResponse } from 'next/server';
import { getTenantAccessToken } from '@/lib/feishu';
import { getSupabaseAdmin, ensureBucket, uploadToStorage } from '@/lib/supabase-admin';

const BASE_APP = 'Hc6DbL3Wia2ejMsQn7TcE9g2njc';
const TABLE_ID = 'tbl12tkH7lOR9rrq';
const FEISHU_API = 'https://open.feishu.cn/open-apis';
const BUCKET = 'competition-attachments';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// 确保值是数组（数据库 TEXT[] 列需要）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toArray(val: any): string[] | null {
  if (val == null) return null;
  if (Array.isArray(val)) return val.filter(Boolean);
  return [String(val)];
}

function errMsg(err: any): string {
  if (err instanceof Error) return err.message;
  if (err?.message) return err.message;
  if (typeof err === 'string') return err;
  try { return JSON.stringify(err); } catch { return String(err); }
}

// 飞书字段名 → 前端字段名映射
const FIELD_NAME_MAP: Record<string, string> = {
  '方案标题_AI': 'title',
  '提交人': 'submitter',
  '提报人团队': 'team',
  '请选择提报赛道': 'track',
  '提效/增值场景分类': 'sceneCategory',
  'AI工具': 'aiTools',
  '提报提效比例': 'efficiencyRate',
  '提报月均节省工时': 'monthlySavedHours',
  '原场景与流程_AI润色': 'beforeProcess',
  '核心痛点': 'painPoints',
  '现工作流程': 'afterProcess',
  '原人均每月投入工时': 'beforeHoursPerPerson',
  '原月均投入人数': 'beforePeopleCount',
  '现人均每月投入工时': 'afterHoursPerPerson',
  '现月均投入人数': 'afterPeopleCount',
  '月均任务消耗AI费用': 'aiCost',
  '其他价值：准确率提升 / 质量提升 / 员工体验提升 等': 'extraValue',
  '工时数据真实性确认人': 'verifier',
  '补充说明：方案说明SOP文档链接、GitHub仓库地址等': 'sourceUrl',
  '评审周期': 'period',
  '组队团队成员': 'teamMembers',
  '赛事进展': 'status',
  '自动编号': 'proposalNo',
  '补充附件': 'attachments',
  // 新增字段
  '实现过程': 'implementation',
  '新工作次数': 'newOperationCount',
  '原操作次数': 'oldOperationCount',
  '提报组队类型': 'teamType',
  '原每次工时': 'oldHoursPerTask',
  '新执行时长': 'newDuration',
  '新执行人数': 'newPeopleCount',
  '原执行人数': 'oldPeopleCount',
  '原工作频率': 'oldFrequency',
  '新工作频率': 'newFrequency',
  '用户': 'reviewers',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRecord(record: any): Record<string, unknown> {
  const mapped: Record<string, unknown> = {
    id: record.record_id,
    recordUrl: `https://ztn.feishu.cn/base/${BASE_APP}?table=${TABLE_ID}&record=${record.record_id}`,
  };
  for (const [fieldName, value] of Object.entries(record.fields ?? {})) {
    const key = FIELD_NAME_MAP[fieldName];
    if (!key) continue;
    if (value == null) continue;

    // attachment field: [{file_token, name, type, url}] → 保留原对象
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && ('file_token' in value[0] || ('url' in value[0] && 'type' in value[0]))) {
      mapped[key] = value;
    }
    else if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && 'text' in value[0]) {
      mapped[key] = value.map((v: { text?: string }) => v.text ?? '').join('');
    }
    else if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && 'name' in value[0]) {
      mapped[key] = value.map((v: { name?: string }) => v.name ?? '');
    }
    else if (typeof value === 'object' && value !== null && 'name' in value) {
      mapped[key] = [(value as { name?: string }).name ?? ''];
    }
    else if (Array.isArray(value)) {
      mapped[key] = value;
    }
    else {
      mapped[key] = value;
    }
  }
  return mapped;
}

// GET: 从 Supabase 读取已同步的数据
export async function GET(request: NextRequest) {
  const period = request.nextUrl.searchParams.get('period') ?? '2605';

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('competition_submissions')
      .select('*')
      .eq('period', period)
      .order('monthly_saved_hours', { ascending: false, nullsFirst: false });

    if (error) throw error;

    // DB 字段 → 前端字段
    const items = (data ?? []).map((row) => ({
      id: row.id,
      recordUrl: row.record_url,
      title: row.title,
      submitter: row.submitter,
      teamMembers: row.team_members,
      team: row.team,
      track: row.track,
      sceneCategory: row.scene_category,
      aiTools: row.ai_tools,
      efficiencyRate: row.efficiency_rate,
      monthlySavedHours: row.monthly_saved_hours,
      beforeProcess: row.before_process,
      painPoints: row.pain_points,
      afterProcess: row.after_process,
      beforeHoursPerPerson: row.before_hours_per_person,
      beforePeopleCount: row.before_people_count,
      afterHoursPerPerson: row.after_hours_per_person,
      afterPeopleCount: row.after_people_count,
      aiCost: row.ai_cost,
      extraValue: row.extra_value,
      verifier: row.verifier,
      sourceUrl: row.source_url,
      status: row.status,
      proposalNo: row.proposal_no,
      attachments: (row.attachments ?? []).map((a: { name: string; type?: string; size?: number; storage_path: string }) => ({
        name: a.name,
        type: a.type,
        size: a.size,
        url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${a.storage_path}`,
      })),
      // 新增字段
      implementation: row.implementation,
      newOperationCount: row.new_operation_count,
      oldOperationCount: row.old_operation_count,
      teamType: row.team_type,
      oldHoursPerTask: row.old_hours_per_task,
      newDuration: row.new_duration,
      newPeopleCount: row.new_people_count,
      oldPeopleCount: row.old_people_count,
      oldFrequency: row.old_frequency,
      newFrequency: row.new_frequency,
      reviewers: row.reviewers,
    }));

    return NextResponse.json({ items, total: items.length, period });
  } catch (err) {
    console.error('读取大赛方案失败:', err);
    return NextResponse.json({ error: '读取数据失败' }, { status: 500 });
  }
}

// POST: 从飞书同步到 Supabase（任何登录用户可触发）
export async function POST(request: NextRequest) {
  const period = request.nextUrl.searchParams.get('period') ?? '2605';

  try {
    // 校验登录
    const userId = request.cookies.get('feishu_user_id')?.value;
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const supabase = getSupabaseAdmin();
    const { data: user } = await supabase.from('users').select('id').eq('id', userId).single();
    if (!user) return NextResponse.json({ error: '用户不存在' }, { status: 401 });

    // 确保 Storage bucket 存在
    await ensureBucket(BUCKET);

    const token = await getTenantAccessToken();

    // 分页拉取飞书记录
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allRecords: any[] = [];
    let pageToken: string | undefined;

    do {
      const url = new URL(`${FEISHU_API}/bitable/v1/apps/${BASE_APP}/tables/${TABLE_ID}/records`);
      url.searchParams.set('page_size', '100');
      if (pageToken) url.searchParams.set('page_token', pageToken);

      const res = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const json = await res.json();

      if (json.code !== 0) {
        console.error('飞书 API 错误:', JSON.stringify(json, null, 2));
        return NextResponse.json({ error: json.msg ?? '飞书 API 错误' }, { status: 502 });
      }

      allRecords.push(...(json.data?.items ?? []));
      pageToken = json.data?.has_more ? json.data.page_token : undefined;
    } while (pageToken);

    // 过滤当前周期
    const periodRecords = allRecords.filter((r) => {
      const fields = r.fields ?? {};
      const periodField = fields['评审周期'];
      if (Array.isArray(periodField) && periodField.length > 0 && typeof periodField[0] === 'object' && 'text' in periodField[0]) {
        return periodField.map((v: { text?: string }) => v.text ?? '').join('') === period;
      }
      return periodField === period;
    });

    // 逐条处理：下载附件 → 上传 Storage → 准备 DB 数据
    const rows: Record<string, unknown>[] = [];

    for (const record of periodRecords) {
      const mapped = mapRecord(record);
      const attachments = Array.isArray(mapped.attachments) ? mapped.attachments : [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const processedAttachments: any[] = [];

      for (const att of attachments) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const a = att as any;
        if (!a.name) continue;

        const safeName = a.name.replace(/[^a-zA-Z0-9._\-\u4e00-\u9fff]/g, '_');
        const storagePath = `${mapped.id}/${safeName}`;

        try {
          // 先用 token 从飞书下载，失败则用 tmp_url 公开链接
          let fileRes: Response | null = null;
          if (a.url) {
            fileRes = await fetch(a.url, { headers: { 'Authorization': `Bearer ${token}` } });
          }
          if (!fileRes?.ok && a.tmp_url) {
            fileRes = await fetch(a.tmp_url);
          }

          if (fileRes?.ok) {
            const buffer = await fileRes.arrayBuffer();
            await uploadToStorage(BUCKET, storagePath, buffer, a.type || 'application/octet-stream');
            processedAttachments.push({ name: a.name, type: a.type, size: a.size, storage_path: storagePath });
          } else {
            console.error(`附件下载失败 ${a.name}: ${fileRes?.status ?? 'no url'}`);
          }
        } catch (e) {
          console.error(`附件处理异常 ${a.name}:`, e);
        }
      }

      rows.push({
        id: mapped.id,
        period,
        proposal_no: mapped.proposalNo ?? null,
        title: mapped.title ?? '',
        submitter: toArray(mapped.submitter),
        team_members: toArray(mapped.teamMembers),
        team: toArray(mapped.team),
        track: mapped.track ?? null,
        scene_category: mapped.sceneCategory ?? null,
        ai_tools: toArray(mapped.aiTools),
        efficiency_rate: mapped.efficiencyRate ?? null,
        monthly_saved_hours: mapped.monthlySavedHours ?? null,
        before_process: mapped.beforeProcess ?? null,
        pain_points: toArray(mapped.painPoints),
        after_process: mapped.afterProcess ?? null,
        before_hours_per_person: mapped.beforeHoursPerPerson ?? null,
        before_people_count: mapped.beforePeopleCount ?? null,
        after_hours_per_person: mapped.afterHoursPerPerson ?? null,
        after_people_count: mapped.afterPeopleCount ?? null,
        ai_cost: mapped.aiCost ?? null,
        extra_value: mapped.extraValue ?? null,
        verifier: toArray(mapped.verifier),
        source_url: mapped.sourceUrl ?? null,
        status: mapped.status ?? null,
        attachments: processedAttachments,
        record_url: mapped.recordUrl ?? null,
        synced_at: new Date().toISOString(),
        // 新增字段
        implementation: mapped.implementation ?? null,
        new_operation_count: mapped.newOperationCount ?? null,
        old_operation_count: mapped.oldOperationCount ?? null,
        team_type: mapped.teamType ?? null,
        old_hours_per_task: mapped.oldHoursPerTask ?? null,
        new_duration: mapped.newDuration ?? null,
        new_people_count: mapped.newPeopleCount ?? null,
        old_people_count: mapped.oldPeopleCount ?? null,
        old_frequency: mapped.oldFrequency ?? null,
        new_frequency: mapped.newFrequency ?? null,
        reviewers: toArray(mapped.reviewers),
      });
    }

    // Upsert 到 Supabase
    if (rows.length > 0) {
      const { error } = await supabase
        .from('competition_submissions')
        .upsert(rows, { onConflict: 'id' });
      if (error) throw new Error(`写入数据库失败: ${errMsg(error)}`);
    }

    return NextResponse.json({ synced: rows.length, period });
  } catch (err) {
    console.error('同步大赛方案失败:', err);
    return NextResponse.json({ error: `同步失败: ${errMsg(err)}` }, { status: 500 });
  }
}
