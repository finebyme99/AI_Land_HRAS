import { NextRequest, NextResponse } from 'next/server';
import { getTenantAccessToken } from '@/lib/feishu';

const FEISHU_API = 'https://open.feishu.cn/open-apis';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const name = request.nextUrl.searchParams.get('name') ?? 'file';

  if (!token) {
    return NextResponse.json({ error: '缺少 token 参数' }, { status: 400 });
  }

  try {
    const accessToken = await getTenantAccessToken();
    const res = await fetch(`${FEISHU_API}/drive/v1/medias/${token}/download`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `飞书下载失败: ${res.status}` }, { status: 502 });
    }

    const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
    const body = await res.arrayBuffer();

    return new NextResponse(body, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err) {
    console.error('下载飞书附件失败:', err);
    return NextResponse.json({ error: '下载失败' }, { status: 500 });
  }
}
