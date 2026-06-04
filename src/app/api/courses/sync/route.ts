import { NextRequest, NextResponse } from 'next/server';
import { getTenantAccessToken } from '@/lib/feishu';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const BASE_TOKEN = 'Wsj0bXtWcaxOtRsfXAYcvNXQnOa';
const TABLE_ID = 'tbl8wQKUIqRZoCdn';
const FEISHU_API = 'https://open.feishu.cn/open-apis';

// 飞书多维表格字段名 → courses 表字段名
// 多维表格: 主题、主讲人、发布日期、录屏、课件文档、资源类型
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractUrl(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') {
    // 飞书超链接字段格式: [显示文本](URL)
    const match = val.match(/\]\((https?:\/\/[^\s)]+)\)/);
    if (match) return match[1];
    // 纯 URL
    if (val.startsWith('http')) return val;
    return '';
  }
  // 飞书 URL 类型字段返回 {link, text} 对象
  if (typeof val === 'object' && !Array.isArray(val) && val.link) return val.link;
  // 有时也返回数组 [{link, text}]
  if (Array.isArray(val) && val.length > 0 && val[0].link) return val[0].link;
  return '';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractText(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') {
    // 去掉 markdown 链接语法，只取文本
    return val.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  }
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
  if (typeof val === 'number') {
    // 飞书 datetime 是毫秒时间戳
    return new Date(val).toISOString();
  }
  if (typeof val === 'string') return new Date(val).toISOString();
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractContentTypes(val: any): string[] {
  if (!val) return [];
  const items = Array.isArray(val) ? val : [val];
  // 飞书多选字段返回中文值，需映射为英文
  const map: Record<string, string> = { '视频': 'video', '文档': 'doc' };
  return items.filter(Boolean).map((v: string) => map[v] || v);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRecord(record: any) {
  const f = record.fields ?? {};
  return {
    title: extractText(f['主题']),
    instructor: extractUserName(f['主讲人']),
    created_at: extractDate(f['发布日期']),
    video_url: extractUrl(f['录屏']),
    courseware_url: extractUrl(f['课件文档']),
    content_type: extractContentTypes(f['资源类型']),
  };
}

// POST: 从飞书多维表格同步课程数据到 Supabase
export async function POST(request: NextRequest) {
  // 校验管理员
  const userId = request.cookies.get('feishu_user_id')?.value;
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const supabase = getSupabaseAdmin();
  const { data: user } = await supabase.from('users').select('roles').eq('id', userId).single();
  if (!user || !user.roles?.some((r: string) => ['admin', 'moderator'].includes(r))) {
    return NextResponse.json({ error: '无权限' }, { status: 403 });
  }

  try {
    const token = await getTenantAccessToken();

    // 分页拉取多维表格记录
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

      if (json.code !== 0) {
        throw new Error(json.msg || '获取多维表格记录失败');
      }

      for (const item of json.data?.items ?? []) {
        allRecords.push(mapRecord(item));
      }

      pageToken = json.data?.has_more ? json.data.page_token : undefined;
    } while (pageToken);

    // 全量替换：先清空旧数据，再批量插入
    const { error: deleteError } = await supabase.from('courses').delete().neq('id', 'never-match-placeholder');
    // 用 neq 占位实现全删（Supabase delete 必须带 filter）
    // 改用 RPC 或直接删
    const { error: deleteError2 } = await supabase.from('courses').delete().gte('created_at', '1970-01-01');
    if (deleteError2) console.error('清空旧数据失败:', deleteError2);

    const rows = allRecords
      .filter((r) => r.title)
      .map((r) => ({
        title: r.title,
        description: '',
        instructor: r.instructor || '待定',
        duration: '',
        difficulty: '初阶',
        created_at: r.created_at,
        video_url: r.video_url,
        courseware_url: r.courseware_url,
        content_type: r.content_type.length > 0 ? r.content_type : ['doc'],
      }));

    let inserted = 0;
    // 分批插入（每批最多200条）
    for (let i = 0; i < rows.length; i += 200) {
      const batch = rows.slice(i, i + 200);
      const { error } = await supabase.from('courses').insert(batch);
      if (error) console.error('批量插入失败:', error);
      else inserted += batch.length;
    }

    return NextResponse.json({ total: allRecords.length, inserted });
  } catch (err) {
    console.error('课程同步失败:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '同步失败' },
      { status: 500 }
    );
  }
}
