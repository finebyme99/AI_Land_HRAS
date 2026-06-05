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
  '当前用户': 'reviewers',
  'Demo链接': 'demoLink',
  '量化数据来源': 'dataSource',
  '量化数据来源说明': 'dataSourceNote',
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
        demo_link: mapped.demoLink ?? null,
        data_source: mapped.dataSource ?? null,
        data_source_note: mapped.dataSourceNote ?? null,
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
