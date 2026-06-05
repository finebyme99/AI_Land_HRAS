import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { encrypt, decrypt } from '@/lib/secret-crypto';
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
  created_by?: string;
}): Promise<FeishuApp> {
  const { data, error } = await getSupabaseAdmin()
    .from('feishu_apps')
    .insert({
      app_id: input.app_id,
      app_secret_enc: encrypt(input.app_secret),
      tenant_key: input.tenant_key,
      enterprise_name: input.enterprise_name,
      redirect_uri: input.redirect_uri,
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

export async function decryptAppSecret(app: FeishuApp): Promise<string> {
  return decrypt(app.app_secret_enc);
}

export async function logAuth(input: Partial<AuthLog> & { success: boolean }): Promise<void> {
  await getSupabaseAdmin().from('auth_logs').insert(input);
}
