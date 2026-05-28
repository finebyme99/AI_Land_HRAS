import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const tmpUrl = request.nextUrl.searchParams.get('tmpUrl');
  const name = request.nextUrl.searchParams.get('name') ?? 'file';

  if (!tmpUrl) {
    return NextResponse.json({ error: '缺少 tmpUrl 参数' }, { status: 400 });
  }

  try {
    const res = await fetch(tmpUrl);

    if (!res.ok) {
      return NextResponse.json({ error: `下载失败: ${res.status}` }, { status: 502 });
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
    console.error('下载附件失败:', err);
    return NextResponse.json({ error: '下载失败' }, { status: 500 });
  }
}
