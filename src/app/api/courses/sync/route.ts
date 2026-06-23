import { NextRequest, NextResponse } from 'next/server';
import { getTenantAccessToken } from '@/lib/feishu';
import { hasPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { assertCourseWriteSucceeded } from '@/lib/course-sync';

const BASE_TOKEN = 'Wsj0bXtWcaxOtRsfXAYcvNXQnOa';
const TABLE_ID = 'tbl8wQKUIqRZoCdn';
const FEISHU_API = 'https://open.feishu.cn/open-apis';

/* ─── 工具函数 ─── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractText(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  if (typeof val === 'object' && val.text) return val.text;
  return String(val);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractUserName(val: any): string {
  if (!val) return '';
  if (Array.isArray(val) && val.length > 0 && val[0].name) return val[0].name;
  if (typeof val === 'object' && val.name) return val.name;
  return String(val);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractDate(val: any): string | null {
  if (!val) return null;
  if (typeof val === 'number') return new Date(val).toISOString();
  if (typeof val === 'string') return new Date(val).toISOString();
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractContentTypes(val: any): string[] {
  if (!val) return [];
  const items = Array.isArray(val) ? val : [val];
  const map: Record<string, string> = { '视频': 'video', '文档': 'doc' };
  return items.filter(Boolean).map((v: string) => map[v] || v);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractFirstAttachment(val: any): { file_token: string; name: string } | null {
  if (!Array.isArray(val) || val.length === 0) return null;
  const first = val[0];
  if (first && first.file_token) return { file_token: first.file_token, name: first.name || '' };
  return null;
}

/** 从多维表格下载附件 → 上传飞书IM → 返回 image_key */
async function uploadAttachmentToIM(token: string, fileToken: string): Promise<string | null> {
  try {
    // 1. 获取临时下载URL
    const tmpRes = await fetch(
      `${FEISHU_API}/drive/v1/medias/batch_get_tmp_download_url?file_tokens=${fileToken}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const tmpJson = await tmpRes.json();
    const tmpUrl = tmpJson.data?.tmp_download_urls?.[0]?.tmp_download_url;
    if (!tmpUrl) return null;

    // 2. 下载图片
    const imgRes = await fetch(tmpUrl);
    if (!imgRes.ok) return null;
    const imgBuffer = await imgRes.arrayBuffer();

    // 3. 上传到飞书IM获取image_key
    const formData = new FormData();
    formData.append('image_type', 'message');
    formData.append('image', new Blob([imgBuffer], { type: 'image/png' }), 'poster.png');

    const uploadRes = await fetch(`${FEISHU_API}/im/v1/images`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const uploadJson = await uploadRes.json();
    if (uploadJson.code !== 0) {
      console.error('上传图片到IM失败:', uploadJson.msg);
      return null;
    }
    return uploadJson.data?.image_key || null;
  } catch (e) {
    console.error('图片处理失败:', e);
    return null;
  }
}

/* ─── 主流程 ─── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRecord(record: any) {
  const f = record.fields ?? {};
  return {
    id: record.record_id as string,
    title: extractText(f['主题']),
    instructor: extractUserName(f['主讲人']),
    created_at: extractDate(f['发布日期']),
    video_url: extractUrl(f['录屏']),
    courseware_url: extractUrl(f['课件文档']),
    content_type: extractContentTypes(f['资源类型']),
    period: extractText(f['期数']) || null,
    season: extractText(f['季数']) || null,
    poster_attachment: extractFirstAttachment(f['海报']),
  };
}

// POST: 从飞书多维表格同步课程数据到 Supabase
export async function POST(request: NextRequest) {
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (!(await hasPermission(userId, 'course.sync'))) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }
  const supabase = getSupabaseAdmin();

  try {
    const token = await getTenantAccessToken();

    // 拉取多维表格记录
    const allRecords: ReturnType<typeof mapRecord>[] = [];
    let pageToken: string | undefined;

    do {
      const url = new URL(`${FEISHU_API}/bitable/v1/apps/${BASE_TOKEN}/tables/${TABLE_ID}/records`);
      url.searchParams.set('page_size', '100');
      if (pageToken) url.searchParams.set('page_token', pageToken);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.code !== 0) throw new Error(json.msg || '获取多维表格记录失败');

      for (const item of json.data?.items ?? []) {
        allRecords.push(mapRecord(item));
      }
      pageToken = json.data?.has_more ? json.data.page_token : undefined;
    } while (pageToken);

    // 处理海报图片 + 构建行数据
    const rows: Record<string, unknown>[] = [];
    let skipped = 0;
    for (const r of allRecords) {
      if (!r.title) {
        skipped++;
        continue;
      }

      // 上传海报到飞书IM获取image_key
      let cover_image_key: string | null = null;
      if (r.poster_attachment) {
        cover_image_key = await uploadAttachmentToIM(token, r.poster_attachment.file_token);
      }

      rows.push({
        id: r.id,
        title: r.title,
        description: '',
        instructor: r.instructor || '待定',
        duration: '',
        difficulty: '初阶',
        created_at: r.created_at,
        video_url: r.video_url,
        courseware_url: r.courseware_url,
        content_type: r.content_type.length > 0 ? r.content_type : ['doc'],
        period: r.period,
        season: r.season,
        cover_image_key,
        synced_at: new Date().toISOString(),
      });
    }

    // 分批幂等写入。不要先清空表，避免字段/约束错误导致生产数据被删后插不回。
    let synced = 0;
    for (let i = 0; i < rows.length; i += 200) {
      const batch = rows.slice(i, i + 200);
      const { error } = await supabase.from('courses').upsert(batch, { onConflict: 'id' });
      assertCourseWriteSucceeded(error);
      synced += batch.length;
    }

    return NextResponse.json({ total: allRecords.length, synced, inserted: synced, skipped });
  } catch (err) {
    console.error('课程同步失败:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '同步失败' },
      { status: 500 }
    );
  }
}
