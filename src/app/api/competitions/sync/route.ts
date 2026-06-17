import { NextRequest, NextResponse } from 'next/server';
import { getTenantAccessToken } from '@/lib/feishu';
import { getSupabaseAdmin, ensureBucket, uploadToStorage } from '@/lib/supabase-admin';

const BASE_APP = 'LRROwulJciI7JYkIT55cQtdpnze';
const TABLE_ID = 'tbl9WJyxl9bbtYjb';
const WIKI_TOKEN = 'LRROwulJciI7JYkIT55cQtdpnze';
const VIEW_ID = 'vewEjYjj9S';
const LEGACY_TABLE_ID = 'tbl12tkH7lOR9rrq';  // 旧"方案提交"表 — 用于关联 id
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

// 飞书选项 ID → 汉字 status（AI大赛状态 / 赛事状态 字段共用同一组 opt）
const FEISHU_STATUS_MAP: Record<string, string> = {
  'optxLj2E2B': '待提交人补充方案',
  'optM3cOYIf': '待提交人调整方案',
  'opt0wYpR4p': '评审中',
  'optyEbcJfg': '终审通过',
  'optcp8dDAi': '并入其他方案',
};

// 飞书字段名 → 前端字段名映射（新表 tbl9WJyxl9bbtYjb · AI 大赛项目管理）
const FIELD_NAME_MAP: Record<string, string> = {
  '场景名称': 'title',
  '提报人': 'submitter',
  '提报团队': 'team',
  '场景分类': 'sceneCategory',
  'AI工具': 'aiTools',
  '月均提效节省工时': 'monthlySavedHours',
  '月均Token费用': 'aiCost',
  '原业务场景及流程': 'beforeProcess',
  '原核心痛点': 'painPoints',
  '新业务流程': 'afterProcess',
  '原操作人数': 'beforePeopleCount',
  '新操作人数': 'afterPeopleCount',
  '原操作次数': 'oldOperationCount',
  '新操作次数': 'newOperationCount',
  '原单次操作耗时': 'oldHoursPerTask',
  '新单次操作耗时': 'newDuration',
  '原操作频率': 'oldFrequency',
  '新操作频率': 'newFrequency',
  '推广复用价值系数': 'reuseValue',
  '推广复用价值等级': 'reuseValueLevel',
  '月均降本费用（不含人力成本）': 'monthlySavedCost',
  '降本费用说明': 'costReductionNote',
  'AI实现效果': 'implementationLink',
  '场景编号': 'proposalNo',
  '提报组队类型': 'teamType',
  '组队成员': 'teamMembers',
  '核心价值': 'extraValue',
  'AI实现过程简述': 'implementation',
  '评审周期': 'period',
  '大赛进展': 'status',
  '最终价值计分': 'finalValueScore',
  '一句话简介': 'briefIntro',
  // ── 飞书公式字段（直接同步，不再客户端计算） ──
  '原操作频次': 'beforeFreq',
  '新操作频次': 'afterFreq',
  '原月均耗时': 'beforeMonthlyHours',
  '新月均耗时': 'afterMonthlyHours',
  '场景归属地区系数值': 'sceneRegionCoefficientValue',
  '月均降本折算工时': 'monthlyCostSavingHours',
  '月均节省总工时': 'totalMonthlySavedHours',
  '推广复用价值系数值': 'reuseValueCoefficient',
  '总降本提效比例': 'efficiencyRate',
  '场景归属地区系数': 'regionCoefficient',
  '场景来源': 'sceneSource',
  '落地进展': 'landingProgress',
  // 暂不映射：业务负责人 / AI负责人 / 进展记录&链接 / 计划启动日期 / 试点上线日期 / 推广上线日期 / 全面上线日期 / 价值排名 / 原月均执行次数 / 新月均执行次数 / 新月均耗时 / 【参考】原人均月耗时
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRecord(record: any): Record<string, unknown> {
  // 优先用"关联参赛项目"指向旧表 tbl12tkH7lOR9rrq 的 record_id 当主 id
  // — 保证 13 条记录 upsert 到原来的 13 条上（不出现 13+13 双份）
  const linkedLegacy = (record.fields?.['关联参赛项目'] as Array<{ record_ids?: string[] }> | undefined)?.[0]?.record_ids?.[0];
  const mapped: Record<string, unknown> = {
    id: linkedLegacy || record.record_id,
    recordUrl: `https://ztn.feishu.cn/wiki/${WIKI_TOKEN}?table=${TABLE_ID}&view=${VIEW_ID}&record=${record.record_id}`,
    legacy_submission_id: record.record_id,  // 保留新表 record_id 供 cross-ref
  };
  for (const [fieldName, value] of Object.entries(record.fields ?? {})) {
    const key = FIELD_NAME_MAP[fieldName];
    if (!key) continue;
    if (value == null) continue;

    // status 字段特殊处理：飞书 opt ID 数组 → 汉字字符串；单选字符串直接用
    if (key === 'status') {
      if (Array.isArray(value) && value.length > 0) {
        const optId = String(value[0]);
        mapped[key] = FEISHU_STATUS_MAP[optId] ?? optId;
      } else if (typeof value === 'string') {
        mapped[key] = value;
      }
      continue;
    }
    // attachment field: [{file_token, name, type, url}] → 保留原对象
    else if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && ('file_token' in value[0] || ('url' in value[0] && 'type' in value[0]))) {
      mapped[key] = value;
    }
    // link field: {link: "url", text: "display"} → 提取 link URL
    else if (typeof value === 'object' && value !== null && 'link' in value) {
      mapped[key] = (value as { link?: string }).link ?? '';
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
  // status 默认"评审中"（6 月期方案状态字段尚未填写时补默认）
  if (!mapped.status) {
    mapped.status = '评审中';
  }
  return mapped;
}

// GET: 从 Supabase 读取已同步的数据
// ?discover=fields → 返回飞书多维表格实际字段名 vs FIELD_NAME_MAP 对比
// ?peek=records     → 临时：拉新表前 N 条 records 看数据形态（不写 DB）
export async function GET(request: NextRequest) {
  const period = request.nextUrl.searchParams.get('period') ?? '2605';

  // 临时 peek：拉新表前 N 条 records
  if (request.nextUrl.searchParams.get('peek') === 'records') {
    try {
      const token = await getTenantAccessToken();
      const limit = parseInt(request.nextUrl.searchParams.get('limit') ?? '3', 10);
      const url = new URL(`${FEISHU_API}/bitable/v1/apps/${BASE_APP}/tables/${TABLE_ID}/records`);
      url.searchParams.set('page_size', String(Math.min(limit, 10)));
      if (period) {
        url.searchParams.set('filter', `AND(CurrentValue.[评审周期]="${period}")`);
      }
      const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!res.ok || json.code !== 0) {
        return NextResponse.json({ error: `飞书 API 错误: ${json.msg}` }, { status: 502 });
      }
      const items = (json.data?.items ?? []).map((r: { record_id: string; fields?: Record<string, unknown> }) => ({
        record_id: r.record_id,
        fields: r.fields ?? {},
      }));
      return NextResponse.json({ count: items.length, total: json.data?.total ?? 0, period, items });
    } catch (e) {
      return NextResponse.json({ error: errMsg(e) }, { status: 500 });
    }
  }

  // 字段发现模式
  if (request.nextUrl.searchParams.get('discover') === 'fields') {
    try {
      const token = await getTenantAccessToken();
      const fieldsUrl = `${FEISHU_API}/bitable/v1/apps/${BASE_APP}/tables/${TABLE_ID}/fields?page_size=100`;
      const res = await fetch(fieldsUrl, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!res.ok || json.code !== 0) {
        return NextResponse.json({ error: `飞书 API 错误: ${json.msg}` }, { status: 502 });
      }
      // 返回每个字段的完整对象（含 group_id / group_name 等元信息）
      const fieldsAll = (json.data?.items ?? []) as Array<Record<string, unknown>>;
      const feishuFields: string[] = fieldsAll.map((f) => (f.field_name as string) ?? '');
      const mappedNames = new Set(Object.keys(FIELD_NAME_MAP));
      const matched = feishuFields.filter((n) => mappedNames.has(n));
      const unmatchedFeishu = feishuFields.filter((n) => !mappedNames.has(n));
      const unmatchedCode = [...mappedNames].filter((n) => !feishuFields.includes(n));
      // 字段编组聚合：按 group_id/group_name 分组
      const groupsMap = new Map<string, { groupId: string; groupName: string; fields: Array<{ name: string; type: number; fieldId: string }> }>();
      for (const f of fieldsAll) {
        const groupId = (f.group_id as string) ?? '_ungrouped';
        const groupName = (f.group_name as string) ?? '未分组';
        const name = (f.field_name as string) ?? '';
        const type = (f.type as number) ?? 0;
        const fieldId = (f.field_id as string) ?? '';
        const key = `${groupId}::${groupName}`;
        if (!groupsMap.has(key)) {
          groupsMap.set(key, { groupId, groupName, fields: [] });
        }
        groupsMap.get(key)!.fields.push({ name, type, fieldId });
      }
      const groups = Array.from(groupsMap.values());
      return NextResponse.json({
        feishuFields,
        fieldsAll,         // 每个字段的完整对象（含 type/group_id/group_name 等）
        groups,            // 按编组聚合
        matched,
        unmatchedFeishu,   // 多维表格有，代码没映射
        unmatchedCode,     // 代码有映射，多维表格没找到（可能是改名了）
      });
    } catch (e) {
      return NextResponse.json({ error: errMsg(e) }, { status: 500 });
    }
  }

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
      demoLink: row.demo_link,
      dataSource: row.data_source,
      dataSourceNote: row.data_source_note,
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

    // 分页拉取飞书记录（优先服务端按评审周期过滤）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allRecords: any[] = [];
    let pageToken: string | undefined;
    let filterSupported = true;

    do {
      const url = new URL(`${FEISHU_API}/bitable/v1/apps/${BASE_APP}/tables/${TABLE_ID}/records`);
      url.searchParams.set('page_size', '100');
      if (filterSupported) {
        url.searchParams.set('filter', `AND(CurrentValue.[评审周期]="${period}")`);
      }
      if (pageToken) url.searchParams.set('page_token', pageToken);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();

      if (!res.ok || json.code !== 0) {
        if (filterSupported && json.code === 1254043) {
          filterSupported = false;
          continue;
        }
        throw new Error(`飞书 API 错误: ${json.msg ?? res.status}`);
      }

      allRecords.push(...(json.data?.items ?? []));
      pageToken = json.data?.has_more ? json.data.page_token : undefined;
    } while (pageToken);

    // filter 未生效时，内存过滤
    const periodRecords = filterSupported
      ? allRecords
      : allRecords.filter((r) => {
          const fields = r.fields ?? {};
          const periodField = fields['评审周期'];
          if (Array.isArray(periodField) && periodField.length > 0 && typeof periodField[0] === 'object' && 'text' in periodField[0]) {
            return periodField.map((v: { text?: string }) => v.text ?? '').join('') === period;
          }
          return periodField === period;
        });

    // 预检：从 DB 读取已存在的附件元数据（包含 file_token 用于判断文件是否被替换）
    const recordIds = periodRecords.map((r) => r.record_id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingAttachments = new Map<string, { name: string; file_token?: string; size?: number }>();
    const BATCH_SIZE = 50;
    for (let i = 0; i < recordIds.length; i += BATCH_SIZE) {
      const batch = recordIds.slice(i, i + BATCH_SIZE);
      const { data: rows } = await getSupabaseAdmin()
        .from('competition_submissions')
        .select('id, attachments')
        .in('id', batch);
      for (const row of rows ?? []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const a of (row.attachments ?? []) as any[]) {
          const key = `${row.id}/${a.name}`;
          existingAttachments.set(key, { name: a.name, file_token: a.file_token, size: a.size });
        }
      }
    }

    // 逐条处理：下载附件 → 上传 Storage → 准备 DB 数据
    const rows: Record<string, unknown>[] = [];
    let skippedAttachments = 0;
    let downloadedAttachments = 0;
    let replacedAttachments = 0;

    for (const record of periodRecords) {
      const mapped = mapRecord(record);
      const attachments = Array.isArray(mapped.attachments) ? mapped.attachments : [];

      // 筛选出需要下载的附件
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const toDownload: { att: any; storagePath: string }[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const processedAttachments: any[] = [];

      for (const att of attachments) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const a = att as any;
        if (!a.name) continue;

        const safeName = a.name.replace(/[^a-zA-Z0-9._\-\u4e00-\u9fff]/g, '_');
        const storagePath = `${mapped.id}/${safeName}`;
        const existing = existingAttachments.get(storagePath);

        if (existing) {
          // 文件存在，通过 file_token 判断是否被替换
          if (existing.file_token && a.file_token) {
            // 两边都有 file_token，精确比较
            if (a.file_token === existing.file_token) {
              processedAttachments.push({ name: a.name, type: a.type, size: a.size, file_token: a.file_token, storage_path: storagePath });
              skippedAttachments++;
            } else {
              toDownload.push({ att: a, storagePath });
              replacedAttachments++;
            }
          } else {
            // 旧数据没有 file_token，回退到大小比较；大小信息也不足则重新下载以确保正确
            const sizeMatch = a.size && existing.size && a.size === existing.size;
            if (sizeMatch) {
              processedAttachments.push({ name: a.name, type: a.type, size: a.size, file_token: a.file_token, storage_path: storagePath });
              skippedAttachments++;
            } else {
              toDownload.push({ att: a, storagePath });
              replacedAttachments++;
            }
          }
        } else {
          // 新附件，需要下载
          toDownload.push({ att: a, storagePath });
        }
      }

      // 并发下载上传（最多 5 个并发）
      const CONCURRENCY = 5;
      for (let i = 0; i < toDownload.length; i += CONCURRENCY) {
        const batch = toDownload.slice(i, i + CONCURRENCY);
        const results = await Promise.allSettled(
          batch.map(async ({ att: a, storagePath }) => {
            let fileRes: Response | null = null;
            // 1) 直接 url
            if (a.url) {
              fileRes = await fetch(a.url, { headers: { 'Authorization': `Bearer ${token}` } });
            }
            // 2) tmp_url 兜底
            if (!fileRes?.ok && a.tmp_url) {
              fileRes = await fetch(a.tmp_url);
            }
            // 3) 通过 file_token 调飞书媒体下载 API 兜底
            if (!fileRes?.ok && a.file_token) {
              const mediaUrl = `${FEISHU_API}/drive/v1/medias/${a.file_token}/download`;
              fileRes = await fetch(mediaUrl, { headers: { 'Authorization': `Bearer ${token}` } });
            }
            if (fileRes?.ok) {
              const buffer = await fileRes.arrayBuffer();
              await uploadToStorage(BUCKET, storagePath, buffer, a.type || 'application/octet-stream');
              return { name: a.name, type: a.type, size: a.size, file_token: a.file_token, storage_path: storagePath };
            }
            throw new Error(`下载失败 [${a.name}]: ${fileRes?.status ?? 'no url'} (url=${!!a.url}, tmp=${!!a.tmp_url}, token=${!!a.file_token})`);
          }),
        );
        for (const r of results) {
          if (r.status === 'fulfilled') {
            processedAttachments.push(r.value);
            downloadedAttachments++;
          } else {
            console.error('附件处理异常:', r.reason);
          }
        }
      }

      rows.push({
        id: mapped.id,
        period,
        // proposal_no: 新表"场景编号"是 "AI044" 字符串，DB 列是 integer 不兼容 → 暂不传
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
        before_people_count: mapped.beforePeopleCount ?? null,
        after_people_count: mapped.afterPeopleCount ?? null,
        ai_cost: mapped.aiCost ?? null,
        extra_value: mapped.extraValue ?? null,
        verifier: toArray(mapped.verifier),
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
        old_frequency: mapped.oldFrequency ?? null,
        new_frequency: mapped.newFrequency ?? null,
        reuse_value: mapped.reuseValue ?? null,
        reuse_value_level: mapped.reuseValueLevel ?? null,
        monthly_saved_cost: mapped.monthlySavedCost ?? null,
        cost_reduction_note: mapped.costReductionNote ?? null,
        implementation_link: mapped.implementationLink ?? null,
        final_value_score: mapped.finalValueScore ?? null,
        brief_intro: mapped.briefIntro ?? null,
        // 飞书公式字段（直接同步）
        before_freq: mapped.beforeFreq != null ? Number(mapped.beforeFreq) || null : null,
        after_freq: mapped.afterFreq != null ? Number(mapped.afterFreq) || null : null,
        before_monthly_hours: mapped.beforeMonthlyHours != null ? Number(mapped.beforeMonthlyHours) || null : null,
        after_monthly_hours: mapped.afterMonthlyHours != null ? Number(mapped.afterMonthlyHours) || null : null,
        scene_region_coefficient_value: mapped.sceneRegionCoefficientValue != null ? Number(mapped.sceneRegionCoefficientValue) || null : null,
        monthly_cost_saving_hours: mapped.monthlyCostSavingHours != null ? Number(mapped.monthlyCostSavingHours) || null : null,
        total_monthly_saved_hours: mapped.totalMonthlySavedHours != null ? Number(mapped.totalMonthlySavedHours) || null : null,
        reuse_value_coefficient: mapped.reuseValueCoefficient != null ? Number(mapped.reuseValueCoefficient) || null : null,
        region_coefficient: mapped.regionCoefficient ?? null,
        scene_source: mapped.sceneSource ?? null,
        landing_progress: mapped.landingProgress ?? null,
      });
    }

    // Upsert 到 Supabase
    if (rows.length > 0) {
      const { error } = await supabase
        .from('competition_submissions')
        .upsert(rows, { onConflict: 'id' });
      if (error) throw new Error(`写入数据库失败: ${errMsg(error)}`);
    }

    // 自动回填 reviewer 角色：扫本次同步的所有 submissions 的 reviewers + verifier 字段，
    // 给对应的 users 加上 'reviewer' 角色（仅在没加过时；管理员等已含其他角色的不动）
    let reviewerAutoGranted = 0;
    const reviewerNameSet = new Set<string>();
    for (const r of rows) {
      for (const name of ((r.reviewers as unknown[]) ?? [])) {
        if (typeof name === 'string' && name) reviewerNameSet.add(name);
      }
      for (const name of ((r.verifier as unknown[]) ?? [])) {
        if (typeof name === 'string' && name) reviewerNameSet.add(name);
      }
    }
    for (const name of reviewerNameSet) {
      const { data: matched } = await supabase
        .from('users')
        .select('id, name, roles')
        .or(`name.eq.${name},name.ilike.${name}`)
        .limit(2);
      const u = (matched ?? []).find((x) => x.name === name) ?? matched?.[0];
      if (!u) continue;
      if ((u.roles ?? []).includes('reviewer')) continue;
      const next = [...new Set([...(u.roles ?? []), 'reviewer'])];
      const { error: upErr } = await supabase.from('users').update({ roles: next }).eq('id', u.id);
      if (upErr) {
        console.error(`[auto-grant] failed for ${name}:`, upErr.message);
        continue;
      }
      reviewerAutoGranted++;
      console.log(`[auto-grant] ${name} (${u.id}) → roles:`, next);
    }

    return NextResponse.json({
      synced: rows.length,
      period,
      attachments: { downloaded: downloadedAttachments, skipped: skippedAttachments, replaced: replacedAttachments },
      reviewerAutoGranted,
    });
  } catch (err) {
    console.error('同步大赛方案失败:', err);
    return NextResponse.json({ error: `同步失败: ${errMsg(err)}` }, { status: 500 });
  }
}
