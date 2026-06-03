import { NextRequest, NextResponse } from 'next/server';
import { getTenantAccessToken } from '@/lib/feishu';

const BASE_APP = 'Hc6DbL3Wia2ejMsQn7TcE9g2njc';
const TABLE_ID = 'tbl12tkH7lOR9rrq';

export async function GET(request: NextRequest) {
  try {
    const token = await getTenantAccessToken();
    const search = request.nextUrl.searchParams.get('q') || '';
    
    const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${BASE_APP}/tables/${TABLE_ID}/records?page_size=100`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    
    if (!res.ok || json.code !== 0) {
      return NextResponse.json({ error: json.msg }, { status: 500 });
    }
    
    // 找到匹配的记录
    const records = json.data?.items || [];
    const matched = records.find((r: Record<string, unknown>) => {
      const fields = r.fields as Record<string, unknown>;
      const title = fields?.['方案标题_AI'];
      return typeof title === 'string' && title.includes(search);
    });
    
    if (!matched) {
      return NextResponse.json({ error: '未找到', search }, { status: 404 });
    }
    
    const fields = matched.fields as Record<string, unknown>;
    
    return NextResponse.json({
      title: fields['方案标题_AI'],
      sourceUrl: fields['SOP文档链接、GitHub仓库地址等'],
      attachments: fields['补充附件'],
      sourceUrlRaw: JSON.stringify(fields['SOP文档链接、GitHub仓库地址等']),
      attachmentsRaw: JSON.stringify(fields['补充附件']),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
