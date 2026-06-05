import { NextRequest, NextResponse } from 'next/server';
import { listFeishuApps, decryptAppSecret, updateFeishuAppStatus, logAuth } from '@/lib/feishu-app-store';
import { getTenantAccessTokenFor } from '@/lib/feishu';

// GET /api/cron/feishu-apps-health — 每天检查所有 active 飞书 app 连通性
export async function GET(request: NextRequest) {
  // 简单的 cron 鉴权（Vercel 默认 Bearer CRON_SECRET）
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const apps = await listFeishuApps();
  const activeApps = apps.filter(a => a.status === 'active');
  const results: Array<{ id: string; enterprise_name: string; ok: boolean; error?: string }> = [];

  for (const app of activeApps) {
    try {
      const secret = await decryptAppSecret(app);
      await getTenantAccessTokenFor(app.app_id, secret);
      results.push({ id: app.id, enterprise_name: app.enterprise_name, ok: true });
    } catch (e: any) {
      results.push({ id: app.id, enterprise_name: app.enterprise_name, ok: false, error: String(e?.message || e) });
      // 自动 disable
      await updateFeishuAppStatus(app.id, 'disabled');
      await logAuth({ app_id: app.app_id, tenant_key: app.tenant_key, error: `health_check_failed: ${e?.message || e}`, success: false });
    }
  }

  return NextResponse.json({ checked: activeApps.length, results });
}
