import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { listFeishuApps, createFeishuApp, updateFeishuAppStatus, getAppSecret } from '@/lib/feishu-app-store';
import { getTenantAccessTokenFor } from '@/lib/feishu';

async function requireAdmin(): Promise<string | null> {
  const cookieStore = await cookies();
  const info = cookieStore.get('feishu_user_info')?.value;
  if (!info) return null;
  try {
    const parsed = JSON.parse(info);
    return parsed.roles?.includes('admin') || parsed.roles?.includes('moderator') ? parsed.id : null;
  } catch { return null; }
}

// GET /api/feishu-apps — 列表（admin）
export async function GET() {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const apps = await listFeishuApps();
  return NextResponse.json({ apps });
}

// POST /api/feishu-apps — 新增（admin）
export async function POST(req: NextRequest) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const body = await req.json();
  if (!body.app_id || !body.app_secret || !body.tenant_key || !body.enterprise_name || !body.redirect_uri) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 });
  }
  const app = await createFeishuApp({ ...body, created_by: adminId });
  return NextResponse.json({ app });
}

// PATCH /api/feishu-apps — 改 status（admin）
export async function PATCH(req: NextRequest) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { id, status } = await req.json();
  if (!id || !['active', 'disabled'].includes(status)) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }
  await updateFeishuAppStatus(id, status);
  return NextResponse.json({ ok: true });
}

// PUT /api/feishu-apps — 测试连通性（admin）
export async function PUT(req: NextRequest) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { id } = await req.json();
  const apps = await listFeishuApps();
  const app = apps.find(a => a.id === id);
  if (!app) return NextResponse.json({ error: 'not found' }, { status: 404 });
  try {
    const secret = await getAppSecret(app);
    await getTenantAccessTokenFor(app.app_id, secret);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 400 });
  }
}
