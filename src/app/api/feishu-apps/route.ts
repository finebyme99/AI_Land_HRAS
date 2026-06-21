import { NextRequest, NextResponse } from 'next/server';
import { hasPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { listFeishuApps, createFeishuApp, updateFeishuAppStatus, getAppSecret } from '@/lib/feishu-app-store';
import { getTenantAccessTokenFor } from '@/lib/feishu';

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return String(error);
}

async function requirePermission(req: NextRequest, key: string): Promise<string | null> {
  const userId = req.cookies.get('feishu_user_id')?.value;
  if (!userId) return null;
  if (!(await hasPermission(userId, key))) return null;
  return userId;
}

// GET /api/feishu-apps — 列表（admin）
export async function GET(req: NextRequest) {
  const adminId = await requirePermission(req, 'admin.feishu-apps');
  if (!adminId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const apps = await listFeishuApps();
  return NextResponse.json({ apps });
}

// POST /api/feishu-apps — 新增（admin）
export async function POST(req: NextRequest) {
  const adminId = await requirePermission(req, 'feishu-app.manage');
  if (!adminId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const body = await req.json();
  if (!body.app_id || !body.app_secret || !body.tenant_key || !body.enterprise_name || !body.redirect_uri) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 });
  }
  const app = await createFeishuApp({ ...body, created_by: adminId });
  return NextResponse.json({ app });
}

// PATCH /api/feishu-apps — 改 status 或 extra_redirect_uris（admin）
export async function PATCH(req: NextRequest) {
  const adminId = await requirePermission(req, 'feishu-app.manage');
  if (!adminId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const body = await req.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (body.status && ['active', 'disabled'].includes(body.status)) {
    updates.status = body.status;
  }
  if (Array.isArray(body.extra_redirect_uris)) {
    // 过滤空字符串 + 校验是合法 URL
    updates.extra_redirect_uris = body.extra_redirect_uris
      .map((s: string) => String(s).trim())
      .filter((s: string) => s.length > 0);
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no fields to update' }, { status: 400 });
  }

  const { error } = await getSupabaseAdmin()
    .from('feishu_apps')
    .update(updates)
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// PUT /api/feishu-apps — 测试连通性（admin）
export async function PUT(req: NextRequest) {
  const adminId = await requirePermission(req, 'feishu-app.manage');
  if (!adminId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { id } = await req.json();
  const apps = await listFeishuApps();
  const app = apps.find(a => a.id === id);
  if (!app) return NextResponse.json({ error: 'not found' }, { status: 404 });
  try {
    const secret = await getAppSecret(app);
    await getTenantAccessTokenFor(app.app_id, secret);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: errorMessage(e) }, { status: 400 });
  }
}
