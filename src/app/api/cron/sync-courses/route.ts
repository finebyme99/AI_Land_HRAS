import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, ensureBucket, uploadToStorage } from '@/lib/supabase-admin';
import { getTenantAccessToken } from '@/lib/feishu';

const BASE_TOKEN = 'Wsj0bXtWcaxOtRsfXAYcvNXQnOa';
const TABLE_ID = 'tbl8wQKUIqRZoCdn';
const BASE_APP = BASE_TOKEN;
const FEISHU_API = 'https://open.feishu.cn/open-apis';
const BUCKET = 'course-attachments';

// --- 内联工具（与 courses/sync/route.ts 保持同步）---
/* eslint-disable @typescript-eslint/no-explicit-any */
function extractUrl(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') {
    const match = val.match(/\]\((https?:\/\/[^\s)]+)\)/);
    if (match) return match[1];
    if (val.startsWith('http')) return val;
    return '';
  }
  if (typeof val === 'object' && !Array.isArray(val) && val.link) return val.link;
  if (Array.isArray(val) && val.length > 0 && val[0].link) return val[0].link;
  return '';
}
function extractText(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  if (typeof val === 'object' && val.text) return val.text;
  return String(val);
}
function mapRecord(record: any) {
  const f = record.fields ?? {};
  return {
    id: record.record_id,
    title: extractText(f['主题']),
    description: extractText(f['描述']),
    instructor: extractText(f['讲师']),
    duration: extractText(f['时长']),
    difficulty: extractText(f['难度']) || '初阶',
    contentType: extractText(f['资源形式']),
    coverImage: extractUrl(f['封面']),
    coursewareUrl: extractUrl(f['课件文档']),
    videoUrl: extractUrl(f['录屏']),
    period: extractText(f['期数']) || null,
  };
}
function toArray(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String);
  return [String(val)];
}
function errMsg(e: any): string {
  return e && typeof e === 'object' && 'message' in e ? String(e.message) : String(e);
}
/* eslint-enable @typescript-eslint/no-explicit-any */

async function requireCronSecret(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  return { ok: true };
}

/**
 * GET /api/cron/sync-courses
 * 由 vercel.json 在每天 19:40 CST 触发，从飞书同步课程到 Supabase。
 * 飞书 bitable 不支持 modified_since 过滤，"增量"=全量 upsert（幂等）+ 写回 last_synced_at。
 */
export async function GET(request: NextRequest) {
  const auth = await requireCronSecret(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = getSupabaseAdmin();

  try {
    // 1. 读上次同步时间
    const { data: setting } = await supabase
      .from('platform_settings')
      .select('courses_last_synced_at')
      .eq('id', 1)
      .maybeSingle();
    const lastSyncedAt = setting?.courses_last_synced_at ?? null;

    // 2. 确保 Storage bucket 存在
    await ensureBucket(BUCKET);

    // 3. 拉飞书记录
    const token = await getTenantAccessToken();
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

    // 4. 逐条处理：仅当有"主题"才入库；附件下载（与手动同步一致）
    const rows: Record<string, unknown>[] = [];
    let downloaded = 0;
    let skipped = 0;

    for (const record of allRecords) {
      const mapped = mapRecord(record);
      if (!mapped.title) {
        skipped++;
        continue;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const processedAttachments: any[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const attachments = (record.fields?.['附件'] ?? []) as any[];
      for (const a of attachments) {
        if (!a?.name) continue;
        const safeName = a.name.replace(/[^a-zA-Z0-9._\-一-鿿]/g, '_');
        const storagePath = `${mapped.id}/${safeName}`;
        let fileDone = false;
        if (a.url) {
          try {
            const fileRes = await fetch(a.url, { headers: { Authorization: `Bearer ${token}` } });
            if (fileRes.ok) {
              const buffer = await fileRes.arrayBuffer();
              await uploadToStorage(BUCKET, storagePath, buffer, a.type || 'application/octet-stream');
              processedAttachments.push({ name: a.name, type: a.type, size: a.size, file_token: a.file_token, storage_path: storagePath });
              downloaded++;
              fileDone = true;
            }
          } catch {}
        }
        if (!fileDone && a.file_token) {
          try {
            const mediaUrl = `${FEISHU_API}/drive/v1/medias/${a.file_token}/download`;
            const fileRes = await fetch(mediaUrl, { headers: { Authorization: `Bearer ${token}` } });
            if (fileRes.ok) {
              const buffer = await fileRes.arrayBuffer();
              await uploadToStorage(BUCKET, storagePath, buffer, a.type || 'application/octet-stream');
              processedAttachments.push({ name: a.name, type: a.type, size: a.size, file_token: a.file_token, storage_path: storagePath });
              downloaded++;
              fileDone = true;
            }
          } catch {}
        }
        if (!fileDone) skipped++;
      }

      rows.push({
        id: mapped.id,
        title: mapped.title,
        description: mapped.description,
        instructor: mapped.instructor,
        duration: mapped.duration,
        difficulty: mapped.difficulty,
        content_type: toArray(mapped.contentType),
        cover_image: mapped.coverImage,
        courseware_url: mapped.coursewareUrl,
        video_url: mapped.videoUrl,
        period: mapped.period,
        synced_at: new Date().toISOString(),
        attachments: processedAttachments,
      });
    }

    // 5. Upsert
    if (rows.length > 0) {
      const { error: upErr } = await supabase.from('courses').upsert(rows, { onConflict: 'id' });
      if (upErr) throw new Error(`写入失败: ${errMsg(upErr)}`);
    }

    // 6. 写回 last_synced_at
    const now = new Date().toISOString();
    await supabase.from('platform_settings').update({ courses_last_synced_at: now }).eq('id', 1);

    return NextResponse.json({
      synced: rows.length,
      lastSyncedAt,
      newSyncedAt: now,
      skipped,
      attachments: { downloaded, skipped },
      source: 'cron',
    });
  } catch (err: unknown) {
    console.error('[cron/sync-courses] failed:', err);
    return NextResponse.json({ error: `同步失败: ${errMsg(err)}` }, { status: 500 });
  }
}
