import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const DEFAULT_USER_ROLE = 'user';

export function withDefaultUserRole(roles: unknown): string[] {
  const normalized = new Set<string>([DEFAULT_USER_ROLE]);

  if (Array.isArray(roles)) {
    for (const role of roles) {
      if (typeof role === 'string' && role.trim()) {
        normalized.add(role.trim());
      }
    }
  }

  return [...normalized];
}

export async function syncUserRoleLinks(userId: string, roles: string[], grantedBy?: string | null): Promise<string[]> {
  const normalizedRoles = withDefaultUserRole(roles);
  const supabase = getSupabaseAdmin();

  const { data: validRoles, error: rolesError } = await supabase
    .from('roles')
    .select('key')
    .in('key', normalizedRoles);

  if (rolesError) {
    console.error('读取角色定义失败:', rolesError);
    return normalizedRoles;
  }

  const validRoleKeys = (validRoles ?? []).map((role: { key: string }) => role.key);
  if (validRoleKeys.length === 0) return normalizedRoles;

  const { error } = await supabase
    .from('user_roles')
    .upsert(
      validRoleKeys.map((roleKey) => ({
        user_id: userId,
        role_key: roleKey,
        granted_by: grantedBy ?? null,
      })),
      { onConflict: 'user_id,role_key' },
    );

  if (error) {
    console.error('同步用户角色关联失败:', error);
  }

  return normalizedRoles;
}
