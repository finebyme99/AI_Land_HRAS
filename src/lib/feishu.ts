// 飞书 API 客户端（服务端使用）

function getEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env: ${name}`);
  return val;
}

const FEISHU_API_BASE = 'https://open.feishu.cn/open-apis';
const TENANT_TOKEN_EXPIRY_SKEW_MS = 5 * 60 * 1000;
const FALLBACK_TENANT_TOKEN_TTL_MS = 55 * 60 * 1000;

const tenantTokenCache = new Map<string, { token: string; expiresAt: number }>();
const tenantTokenInflight = new Map<string, Promise<string>>();

function tenantTokenCacheKey(appId: string, appSecret: string): string {
  return `${appId}:${appSecret}`;
}

/** @deprecated Use getTenantAccessTokenFor(appId, appSecret) for multi-tenant. Kept for backward compat with 8 existing call sites. */
export async function getTenantAccessToken(): Promise<string> {
  return getTenantAccessTokenFor(
    getEnv('FEISHU_APP_ID'),
    getEnv('FEISHU_APP_SECRET'),
  );
}

/** 多租户：用传入的 (appId, appSecret) 换 tenant_access_token */
export async function getTenantAccessTokenFor(appId: string, appSecret: string): Promise<string> {
  const key = tenantTokenCacheKey(appId, appSecret);
  const cached = tenantTokenCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  const inflight = tenantTokenInflight.get(key);
  if (inflight) return inflight;

  const request = (async () => {
    const res = await fetch(`${FEISHU_API_BASE}/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    });
    const data = await res.json();
    if (data.code !== 0) throw new Error(`获取 tenant_access_token 失败: ${data.msg}`);

    const expireSeconds = Number(data.expire);
    const ttlMs = Number.isFinite(expireSeconds) && expireSeconds > 0
      ? Math.max(0, expireSeconds * 1000 - TENANT_TOKEN_EXPIRY_SKEW_MS)
      : FALLBACK_TENANT_TOKEN_TTL_MS;
    tenantTokenCache.set(key, {
      token: data.tenant_access_token,
      expiresAt: Date.now() + ttlMs,
    });

    return data.tenant_access_token;
  })();

  tenantTokenInflight.set(key, request);
  try {
    return await request;
  } finally {
    tenantTokenInflight.delete(key);
  }
}

// 用 code 换取 user_access_token
export async function getFeishuUserToken(
  code: string,
  appId: string,
  appSecret: string,
): Promise<{
  access_token: string;
  refresh_token: string;
  open_id: string;
  union_id: string;
  user_id: string;
}> {
  // 用调用方传入的 appId/appSecret 换取 tenant_access_token（不走环境变量，支持多租户）
  const tenantRes = await fetch(`${FEISHU_API_BASE}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: appId,
      app_secret: appSecret,
    }),
  });
  const tenantData = await tenantRes.json();
  if (tenantData.code !== 0) throw new Error(`获取 tenant_access_token 失败: ${tenantData.msg}`);
  const token = tenantData.tenant_access_token;

  const res = await fetch(`${FEISHU_API_BASE}/authen/v1/oidc/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
    }),
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(`获取 user_access_token 失败: ${data.msg}`);
  return data.data;
}

// 获取用户信息
export async function getFeishuUserInfo(userAccessToken: string): Promise<{
  open_id: string;
  union_id: string;
  user_id: string;
  name: string;
  en_name: string;
  avatar_url: string;
  avatar_thumb: string;
  email: string;
  mobile: string;
  tenant_key: string;
}> {
  const res = await fetch(`${FEISHU_API_BASE}/authen/v1/user_info`, {
    headers: { 'Authorization': `Bearer ${userAccessToken}` },
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(`获取用户信息失败: ${data.msg}`);
  return data.data;
}

/** 用 user_access_token 调 contact/v3/users/{user_id} 拿部门 + 工号
 * 飞书 API 实际返 employee_no（不是 employee_id）+ 偶尔有 department
 */
export async function getFeishuUserContactInfo(
  userAccessToken: string,
  userId: string,
): Promise<{
  department?: string | string[];
  employee_no?: string;
}> {
  const res = await fetch(
    `${FEISHU_API_BASE}/contact/v3/users/${userId}`,
    { headers: { Authorization: `Bearer ${userAccessToken}` } },
  );
  const data = await res.json();
  if (data.code !== 0) {
    return {};
  }
  return {
    department: data.data?.user?.department,
    employee_no: data.data?.user?.employee_no,
  };
}

// 生成飞书 OAuth 授权 URL
export function getFeishuAuthUrl(appId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    app_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
  });
  return `https://open.feishu.cn/open-apis/authen/v1/authorize?${params.toString()}`;
}
