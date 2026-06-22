import { NextRequest, NextResponse } from 'next/server';
import { getTenantAccessToken } from '@/lib/feishu';
import { hasPermission } from '@/lib/permissions';
import { getSupabaseAdmin, ensureBucket, uploadToStorage } from '@/lib/supabase-admin';
import { getActiveFieldMap } from '@/lib/bitable/field-map-reader';
import { FALLBACK_FIELD_MAP, type FieldMapEntry } from '@/lib/bitable/field-map';
import { syncFieldMapFromFeishu } from '@/lib/bitable/sync-field-map';

const BASE_APP = 'LRROwulJciI7JYkIT55cQtdpnze';
const TABLE_ID = 'tbl9WJyxl9bbtYjb';
const WIKI_TOKEN = 'LRROwulJciI7JYkIT55cQtdpnze';
const VIEW_ID = 'vewEjYjj9S';
const LEGACY_TABLE_ID = 'tbl12tkH7lOR9rrq';  // 旧"方案提交"表 — 用于关联 id
const FEISHU_API = 'https://open.feishu.cn/open-apis';
const BUCKET = 'competition-attachments';

// 确保值是数组（数据库 TEXT[] 列需要）
function toArray(val: unknown): string[] | null {
  if (val == null) return null;
  if (Array.isArray(val)) return val.filter(Boolean);
  return [String(val)];
}

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) return String(err.message);
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

/**
 * 统一前端 key → sync 内部 key（sync 内部仍用 `oldOperationCount` 等历史命名，
 * 因为这些名字已经写到 DB 列名上，不能轻易改）。
 * 未列出的 key 直接用 key 自己（绝大多数情况）。
 */
const SYNC_KEY_ALIAS: Record<string, string> = {
  competitionProgress: 'status',           // → status（DB 列）
  reviewPeriod: 'period',                  // → period
  coreValue: 'extraValue',                 // → extraValue（DB 列）
  beforeOperationCount: 'oldOperationCount',
  afterOperationCount: 'newOperationCount',
  beforeHoursPerTask: 'oldHoursPerTask',
  afterHoursPerTask: 'newDuration',
  beforeFrequency: 'oldFrequency',
  afterFrequency: 'newFrequency',
  costSavedHours: 'monthlyCostSavingHours',
  totalSavedHours: 'totalMonthlySavedHours',
  totalEfficiencyRate: 'efficiencyRate',
  regionCoefficientValue: 'sceneRegionCoefficientValue',
  reuseValueNumber: 'reuseValueCoefficient',
};

/** 把统一 key 转成 sync 内部 key（用于 mapped.xxx 读取） */
function toSyncKey(unifiedKey: string): string {
  return SYNC_KEY_ALIAS[unifiedKey] ?? unifiedKey;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRecord(record: any, map: Record<string, FieldMapEntry>): Record<string, unknown> {
  // 优先用"关联参赛项目"指向旧表 tbl12tkH7lOR9rrq 的 record_id 当主 id
  // — 保证 13 条记录 upsert 到原来的 13 条上（不出现 13+13 双份）
  const linkedLegacy = (record.fields?.['关联参赛项目'] as Array<{ record_ids?: string[] }> | undefined)?.[0]?.record_ids?.[0];
  const mapped: Record<string, unknown> = {
    id: linkedLegacy || record.record_id,
    recordUrl: `https://ztn.feishu.cn/wiki/${WIKI_TOKEN}?table=${TABLE_ID}&view=${VIEW_ID}&record=${record.record_id}`,
    legacy_submission_id: record.record_id,  // 保留新表 record_id 供 cross-ref
  };
  for (const [fieldName, value] of Object.entries(record.fields ?? {})) {
    const entry = map[fieldName];
    if (!entry) continue;
    const syncKey = toSyncKey(entry.key);
    if (value == null) continue;

    // 大赛进展（统一 key = competitionProgress, sync 内部 key = status）特殊处理：
    // 飞书 opt ID 数组 → 汉字字符串；单选字符串直接用
    if (syncKey === 'status') {
      if (Array.isArray(value) && value.length > 0) {
        const optId = String(value[0]);
        mapped[syncKey] = FEISHU_STATUS_MAP[optId] ?? optId;
      } else if (typeof value === 'string') {
        mapped[syncKey] = value;
      }
      continue;
    }
    // attachment field: [{file_token, name, type, url}] → 保留原对象
    else if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && ('file_token' in value[0] || ('url' in value[0] && 'type' in value[0]))) {
      mapped[syncKey] = value;
    }
    // link field: {link: "url", text: "display"} → 提取 link URL
    else if (typeof value === 'object' && value !== null && 'link' in value) {
      mapped[syncKey] = (value as { link?: string }).link ?? '';
    }
    else if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && 'text' in value[0]) {
      mapped[syncKey] = value.map((v: { text?: string }) => v.text ?? '').join('');
    }
    else if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && 'name' in value[0]) {
      mapped[syncKey] = value.map((v: { name?: string }) => v.name ?? '');
    }
    else if (typeof value === 'object' && value !== null && 'name' in value) {
      mapped[syncKey] = [(value as { name?: string }).name ?? ''];
    }
    else if (Array.isArray(value)) {
      mapped[syncKey] = value;
    }
    else {
      mapped[syncKey] = value;
    }
  }
  // status 默认"评审中"（6 月期方案状态字段尚未填写时补默认）
  if (!mapped.status) {
    mapped.status = '评审中';
  }
  return mapped;
}

// GET: 从 Supabase 读取已同步的数据
// ?discover=fields → 返回飞书多维表格实际字段名 vs FALLBACK_FIELD_MAP 对比
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
      const mappedNames = new Set(Object.keys(FALLBACK_FIELD_MAP));
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

// POST: 从飞书同步到 Supabase
export async function POST(request: NextRequest) {
  const period = request.nextUrl.searchParams.get('period') ?? '2605';

  try {
    // 校验登录
    const userId = request.cookies.get('feishu_user_id')?.value;
    if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });
    if (!(await hasPermission(userId, 'competition.sync'))) {
      return NextResponse.json({ error: '仅有大赛同步权限的用户可同步' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

    // 确保 Storage bucket 存在
    await ensureBucket(BUCKET);

    const token = await getTenantAccessToken();

    // 先同步字段 schema，再加载字段映射。字段改名时必须先用稳定 field_id 刷新 field_name。
    let fieldDescriptions: Record<string, string> = {};
    try {
      const fieldMapResult = await syncFieldMapFromFeishu(BASE_APP, TABLE_ID);
      if (fieldMapResult.ok) {
        fieldDescriptions = fieldMapResult.fieldDescriptions;
      } else {
        console.warn('[sync] 字段映射同步失败:', fieldMapResult.error);
      }
    } catch (fmErr) {
      console.warn('[sync] 字段映射同步异常:', fmErr);
    }

    // 加载字段映射（DB 优先，fallback 硬编码）
    const fieldMap = await getActiveFieldMap(BASE_APP, TABLE_ID, 'sync');
    const reviewPeriodFieldName = Object.entries(fieldMap).find(([, entry]) => entry.key === 'reviewPeriod')?.[0] ?? '评审周期';

    // 分页拉取飞书记录（优先服务端按评审周期过滤）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allRecords: any[] = [];
    let pageToken: string | undefined;
    let filterSupported = true;

    do {
      const url = new URL(`${FEISHU_API}/bitable/v1/apps/${BASE_APP}/tables/${TABLE_ID}/records`);
      url.searchParams.set('page_size', '100');
      if (filterSupported) {
        url.searchParams.set('filter', `AND(CurrentValue.[${reviewPeriodFieldName}]="${period}")`);
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
          const periodField = fields[reviewPeriodFieldName];
          if (Array.isArray(periodField) && periodField.length > 0 && typeof periodField[0] === 'object' && 'text' in periodField[0]) {
            return periodField.map((v: { text?: string }) => v.text ?? '').join('') === period;
          }
          return periodField === period;
        });

    // 预检：从 DB 读取已存在的附件元数据（包含 file_token 用于判断文件是否被替换）
    const recordIds = periodRecords.map((r) => r.record_id);
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
      const mapped = mapRecord(record, fieldMap);
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
      fieldDescriptions,
    });
  } catch (err) {
    console.error('同步大赛方案失败:', err);
    return NextResponse.json({ error: `同步失败: ${errMsg(err)}` }, { status: 500 });
  }
}
