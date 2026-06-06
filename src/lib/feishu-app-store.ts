import { getSupabaseAdmin } from '@/lib/supabase-admin';
import type { FeishuApp, AuthLog } from '@/types';

export async function listFeishuApps(): Promise<FeishuApp[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('feishu_apps')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function listActiveFeishuAppsPublic(): Promise<Array<{ app_id: string; enterprise_name: string }>> {
  const { data, error } = await getSupabaseAdmin()
    .from('feishu_apps')
    .select('app_id, enterprise_name')
    .eq('status', 'active')
    .order('enterprise_name');
  if (error) throw error;
  return data || [];
}

export async function getFeishuAppByAppId(appId: string): Promise<FeishuApp | null> {
  const { data } = await getSupabaseAdmin()
    .from('feishu_apps')
    .select('*')
    .eq('app_id', appId)
    .maybeSingle();
  return data || null;
}

export async function getFeishuAppByTenantKey(tenantKey: string): Promise<FeishuApp | null> {
  const { data } = await getSupabaseAdmin()
    .from('feishu_apps')
    .select('*')
    .eq('tenant_key', tenantKey)
    .maybeSingle();
  return data || null;
}

export async function createFeishuApp(input: {
  app_id: string;
  app_secret: string;
  tenant_key: string;
  enterprise_name: string;
  redirect_uri: string;
  extra_redirect_uris?: string[];
  created_by?: string;
}): Promise<FeishuApp> {
  const { data, error } = await getSupabaseAdmin()
    .from('feishu_apps')
    .insert({
      app_id: input.app_id,
      app_secret: input.app_secret,
      tenant_key: input.tenant_key,
      enterprise_name: input.enterprise_name,
      redirect_uri: input.redirect_uri,
      extra_redirect_uris: input.extra_redirect_uris ?? [],
      created_by: input.created_by,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateFeishuAppStatus(id: string, status: 'active' | 'disabled'): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from('feishu_apps')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
}

/**
 * 按请求 origin 选出合适的 redirect_uri。
 * 优先 origin 匹配 extra_redirect_uris（同一 app 多环境共享），否则回退主 redirect_uri。
 */
export function getRedirectUriForOrigin(app: FeishuApp, origin: string): string {
  const normalized = origin.replace(/\/$/, '');
  if (Array.isArray(app.extra_redirect_uris)) {
    const hit = app.extra_redirect_uris.find((u) => u.startsWith(normalized));
    if (hit) return hit;
  }
  return app.redirect_uri;
}

export async function getAppSecret(app: FeishuApp): Promise<string> {
  return app.app_secret;
}

export async function logAuth(input: Partial<AuthLog> & { success: boolean }): Promise<void> {
  await getSupabaseAdmin().from('auth_logs').insert(input);
}
