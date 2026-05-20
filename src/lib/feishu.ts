// 飞书 API 客户端（服务端使用）

function getEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env: ${name}`);
  return val;
}

const FEISHU_API_BASE = 'https://open.feishu.cn/open-apis';

// 获取 tenant_access_token（应用凭证）
async function getTenantAccessToken(): Promise<string> {
  const res = await fetch(`${FEISHU_API_BASE}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: getEnv('FEISHU_APP_ID'),
      app_secret: getEnv('FEISHU_APP_SECRET'),
    }),
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(`获取 tenant_access_token 失败: ${data.msg}`);
  return data.tenant_access_token;
}

// 用 code 换取 user_access_token
export async function getFeishuUserToken(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  open_id: string;
  union_id: string;
  user_id: string;
}> {
  const token = await getTenantAccessToken();
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

// 生成飞书 OAuth 授权 URL
export function getFeishuAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    app_id: getEnv('FEISHU_APP_ID'),
    redirect_uri: redirectUri,
    response_type: 'code',
    state: Math.random().toString(36).substring(2),
  });
  return `https://open.feishu.cn/open-apis/authen/v1/authorize?${params.toString()}`;
}
