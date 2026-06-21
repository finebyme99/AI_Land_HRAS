import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withDefaultUserRole } from './default-role';
import { PERMISSION_KEYS } from './registry';

const requestCache = new Map<string, Promise<Set<string>>>();

export async function getUserPermissions(userId: string): Promise<Set<string>> {
  const cached = requestCache.get(userId);
  if (cached) return cached;

  const promise = computeUserPermissions(userId);
  requestCache.set(userId, promise);

  try {
    return await promise;
  } finally {
    requestCache.delete(userId);
  }
}

async function computeUserPermissions(userId: string): Promise<Set<string>> {
  const supabase = getSupabaseAdmin();

  const { data: userRoles, error: userRolesError } = await supabase
    .from('user_roles')
    .select('role_key')
    .eq('user_id', userId);

  const userRoleKeys = (userRoles ?? []).map((role) => role.role_key);

  const { data: user } = await supabase
    .from('users')
    .select('roles')
    .eq('id', userId)
    .single();
  const legacyRoleKeys = withDefaultUserRole(user?.roles);
  const roleKeys = [...new Set(userRolesError ? legacyRoleKeys : [...userRoleKeys, ...legacyRoleKeys])];

  if (roleKeys.includes('admin')) {
    return new Set(PERMISSION_KEYS);
  }

  if (roleKeys.length === 0) {
    return new Set();
  }

  const { data: rolePerms } = await supabase
    .from('role_permissions')
    .select('permission_key')
    .in('role_key', roleKeys);

  const result = new Set<string>();
  for (const rolePermission of rolePerms ?? []) {
    if (PERMISSION_KEYS.has(rolePermission.permission_key)) {
      result.add(rolePermission.permission_key);
    }
  }

  return result;
}

export async function hasPermission(userId: string, key: string): Promise<boolean> {
  const permissions = await getUserPermissions(userId);
  return permissions.has(key);
}

export function clearPermissionsCache(userId?: string) {
  if (userId) {
    requestCache.delete(userId);
    return;
  }

  requestCache.clear();
}
