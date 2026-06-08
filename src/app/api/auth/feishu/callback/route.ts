import { NextRequest, NextResponse } from 'next/server';
import { getFeishuUserToken, getFeishuUserInfo, getFeishuUserContactInfo } from '@/lib/feishu';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getFeishuAppByAppId, getAppSecret, logAuth } from '@/lib/feishu-app-store';
import { cookies } from 'next/headers';

// GET /api/auth/feishu/callback — 飞书 OAuth 回调（多租户）
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const cookieStore = await cookies();

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=no_code', request.url));
  }

  // 1. state 校验
  const cookieState = cookieStore.get('feishu_oauth_state')?.value;
  if (!state || !cookieState || state !== cookieState) {
    await logAuth({ error: 'invalid_state', success: false });
    return NextResponse.redirect(new URL('/login?error=invalid_state', request.url));
  }

  // 2. 从独立 cookie 拿 app_id
  const appId = cookieStore.get('feishu_oauth_app_id')?.value;
  if (!appId) {
    return NextResponse.redirect(new URL('/login?error=missing_app_id', request.url));
  }

  // 3. 查 app
  const app = await getFeishuAppByAppId(appId);
  if (!app) {
    await logAuth({ app_id: appId, error: 'unknown_app', success: false });
    return NextResponse.redirect(new URL('/login?error=unknown_app', request.url));
  }

  try {
    // 4. 用该 app 的 secret 换 user_access_token
    const appSecret = await getAppSecret(app);
    const tokenData = await getFeishuUserToken(code, app.app_id, appSecret);

    // 5. 拿飞书用户信息（含 tenant_key）
    const feishuUser = await getFeishuUserInfo(tokenData.access_token);

    // 5b. 拿飞书用户 contact 信息（部门 + 工号）— 失败时静默返回空
    const contactInfo = await getFeishuUserContactInfo(tokenData.access_token, feishuUser.user_id);

    // 6. tenant_key 一致性检查
    if (feishuUser.tenant_key !== app.tenant_key) {
      await logAuth({
        app_id: appId,
        tenant_key: feishuUser.tenant_key,
        open_id: feishuUser.open_id,
        error: `tenant_mismatch (expected ${app.tenant_key}, got ${feishuUser.tenant_key})`,
        success: false,
      });
      return NextResponse.redirect(new URL('/login?error=tenant_mismatch', request.url));
    }

    // 7. 联合主键 upsert user
    const admin = getSupabaseAdmin();
    const { data: existingUser } = await admin
      .from('users')
      .select('id, roles, department, employee_id')
      .eq('feishu_tenant_key', feishuUser.tenant_key)
      .eq('feishu_open_id', feishuUser.open_id)
      .maybeSingle();

    let userId: string;
    let userRoles: string[] = ['user'];
    let userDept = '';
    let userEmpId = '';

    if (existingUser) {
      userId = existingUser.id;
      userRoles = existingUser.roles || ['user'];
      userDept = contactInfo.department || existingUser.department || '';
      userEmpId = contactInfo.employee_id || existingUser.employee_id || '';
      await admin.from('users').update({
        name: feishuUser.name,
        avatar: feishuUser.avatar_url || feishuUser.avatar_thumb,
        department: userDept,
        employee_id: userEmpId,
        last_active_at: new Date().toISOString(),
      }).eq('id', userId);
    } else {
      // 兜底：第一个 admin 提升
      const { count } = await admin.from('users').select('id', { count: 'exact', head: true }).contains('roles', ['admin']);
      const isFirstAdmin = (count || 0) === 0;
      const { data: newUser, error } = await admin.from('users').insert({
        feishu_open_id: feishuUser.open_id,
        feishu_tenant_key: feishuUser.tenant_key,
        name: feishuUser.name,
        avatar: feishuUser.avatar_url || feishuUser.avatar_thumb,
        department: contactInfo.department || '',
        employee_id: contactInfo.employee_id || '',
        roles: isFirstAdmin ? ['admin'] : ['user'],
        last_active_at: new Date().toISOString(),
      }).select('id').single();
      if (error) throw error;
      userId = newUser.id;
      userRoles = isFirstAdmin ? ['admin'] : ['user'];
      userDept = contactInfo.department || '';
      userEmpId = contactInfo.employee_id || '';
    }

    // 8. 写 cookie
    const response = NextResponse.redirect(new URL('/', request.url));
    response.cookies.set('feishu_user_id', userId, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 60 * 60 * 24 * 7 });
    response.cookies.set('feishu_user_info', JSON.stringify({
      id: userId,
      name: feishuUser.name,
      avatar: feishuUser.avatar_url || feishuUser.avatar_thumb,
      roles: userRoles,
      department: userDept,
    }), { secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 60 * 60 * 24 * 7 });

    // 清掉 oauth 临时 cookie
    response.cookies.delete('feishu_oauth_state');
    response.cookies.delete('feishu_oauth_app_id');

    await logAuth({
      user_id: userId, app_id: appId, tenant_key: feishuUser.tenant_key,
      open_id: feishuUser.open_id, success: true,
    });
    return response;
  } catch (e: any) {
    console.error('飞书登录失败:', e);
    await logAuth({ app_id: appId, error: String(e?.message || e), success: false });
    return NextResponse.redirect(new URL('/login?error=auth_failed', request.url));
  }
}
