# Feishu External SSO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 支持 3 家企业（纵腾 + 2 家外部飞书企业）的飞书账号直接登录 AILand，淘汰用户名密码临时方案。

**Architecture:** AILand 不上架飞书应用市场。后台新增 `feishu_apps` 多企业配置表，3 家企业 IT 各自建飞书自建应用，AILand 管理员在 `/admin/feishu-apps` 录入 `(app_id, app_secret, tenant_key)`。OAuth callback 用 `tenant_key` 路由到对应配置，用户身份由 `(feishu_tenant_key, feishu_open_id)` 联合主键隔离。`app_secret` AES-256-GCM 加密存储。

**Tech Stack:** Next.js 16 (App Router)、React 19、Supabase、飞书 OAuth 2.0、Node `crypto` (AES-256-GCM)

**Spec:** `docs/superpowers/specs/2026-06-05-feishu-external-sso-design.md`

**Verification approach:** 项目无测试框架（package.json 无 vitest/jest），按 CONTRIBUTING.md 自检规范用 curl + Node REPL 验证。

---

## File Structure

### 新增
| 路径 | 职责 |
|------|------|
| `supabase/migrations/032_feishu_apps.sql` | feishu_apps、auth_logs、users 新字段迁移 |
| `src/lib/secret-crypto.ts` | AES-256-GCM 加/解密（Node `crypto`） |
| `src/lib/feishu-app-store.ts` | feishu_apps CRUD + auth_logs 写入 |
| `src/app/admin/feishu-apps/page.tsx` | admin 管理 UI（列表 / 录入 / 测试连通性） |
| `src/app/api/feishu-apps/route.ts` | CRUD API（admin 鉴权） |
| `src/app/api/feishu-apps/public/route.ts` | 公开列表（仅返回 `app_id` + `enterprise_name`） |
| `src/app/api/cron/feishu-apps-health/route.ts` | Vercel cron 健康检查 |

### 改动
| 路径 | 改动 |
|------|------|
| `src/lib/feishu.ts` | `getFeishuAuthUrl` / `getFeishuUserToken` / `getFeishuUserInfo` 接收 `app_secret` 参数（不再从 env 读 secret） |
| `src/app/api/auth/feishu/route.ts` | 接收 `?app_id=` 参数；查表拿 secret；写 state + app_id cookie |
| `src/app/api/auth/feishu/callback/route.ts` | 大改：根据 app_id 查表 → 用对应 secret → 联合主键 upsert |
| `src/app/login/page.tsx` | 改：3 个企业按钮（数据来自 `/api/feishu-apps/public`） |
| `src/types/index.ts` | 加 `FeishuApp` / `AuthLog` 类型；`User` 加 `feishu_tenant_key` |
| `vercel.json` | 加 cron 调度 `feishu-apps-health` |

### 不动
- `src/lib/supabase*.ts`、`src/lib/auth-context.tsx`、所有业务模块

---

## Task 1: 数据库迁移

**Files:**
- Create: `supabase/migrations/032_feishu_apps.sql`

- [ ] **Step 1: 写迁移 SQL**

```sql
-- supabase/migrations/032_feishu_apps.sql

-- 1. feishu_apps 多企业配置
create table feishu_apps (
  id              uuid primary key default gen_random_uuid(),
  app_id          text not null unique,
  app_secret_enc  text not null,
  tenant_key      text not null unique,
  enterprise_name text not null,
  redirect_uri    text not null,
  status          text not null default 'active' check (status in ('active','disabled')),
  created_at      timestamptz default now(),
  created_by      uuid references users(id)
);
create index feishu_apps_status_idx on feishu_apps(status);

-- 2. users 表加 tenant_key
alter table users add column feishu_tenant_key text;
create unique index users_tenant_openid_uniq
  on users (feishu_tenant_key, feishu_open_id)
  where feishu_open_id is not null;

-- 3. auth_logs 登录审计
create table auth_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users(id),
  app_id      text,
  tenant_key  text,
  open_id     text,
  ip          text,
  ua          text,
  success     boolean,
  error       text,
  created_at  timestamptz default now()
);
create index auth_logs_user_id_idx on auth_logs(user_id);
create index auth_logs_created_at_idx on auth_logs(created_at desc);
```

- [ ] **Step 2: 在 Supabase Dashboard SQL Editor 执行**

跑完后验证：
```bash
# 任意一个 supabase 客户端能查到新表
psql $SUPABASE_DB_URL -c "\d feishu_apps"   # 或在 Supabase Table Editor 看
```
预期：表结构与 SQL 一致；`feishu_apps` 有 3 个 unique 约束（id、app_id、tenant_key）；`users.feishu_tenant_key` 字段已加；`auth_logs` 表已建。

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/032_feishu_apps.sql
git commit -m "feat(auth): add feishu_apps / auth_logs / users.tenant_key migration"
```

---

## Task 2: AES-256-GCM 加/解密工具

**Files:**
- Create: `src/lib/secret-crypto.ts`

- [ ] **Step 1: 写实现**

```ts
// src/lib/secret-crypto.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALG = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  const k = process.env.FEISHU_SECRET_ENCRYPTION_KEY;
  if (!k) throw new Error('Missing env: FEISHU_SECRET_ENCRYPTION_KEY');
  const buf = Buffer.from(k, 'base64');
  if (buf.length !== 32) throw new Error('FEISHU_SECRET_ENCRYPTION_KEY must be 32 bytes (base64)');
  return buf;
}

/** 加密：返回 base64(iv|cipher|tag) */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, enc, tag]).toString('base64');
}

/** 解密 */
export function decrypt(ciphertextB64: string): string {
  const key = getKey();
  const buf = Buffer.from(ciphertextB64, 'base64');
  if (buf.length < IV_LEN + TAG_LEN) throw new Error('ciphertext too short');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(buf.length - TAG_LEN);
  const enc = buf.subarray(IV_LEN, buf.length - TAG_LEN);
  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}
```

- [ ] **Step 2: 用 Node REPL 验证 round-trip**

```bash
# 临时设置 env（用 openssl 生成 key）
export FEISHU_SECRET_ENCRYPTION_KEY=$(openssl rand -base64 32)
node -e "
  const { encrypt, decrypt } = require('./src/lib/secret-crypto');
  const plain = 'test-app-secret-12345';
  const enc = encrypt(plain);
  const dec = decrypt(enc);
  console.log('enc:', enc.slice(0, 30) + '...');
  console.log('dec:', dec);
  console.log('match:', dec === plain);
"
```
预期：输出 `match: true`，且 `enc` 不是明文。

- [ ] **Step 3: 验证错误 key 抛错**

```bash
node -e "
  const { encrypt } = require('./src/lib/secret-crypto');
  encrypt('test');
" 
# 然后 export FEISHU_SECRET_ENCRYPTION_KEY=$(echo "short")
```
预期：抛 `FEISHU_SECRET_ENCRYPTION_KEY must be 32 bytes (base64)`。

- [ ] **Step 4: Commit**

```bash
git add src/lib/secret-crypto.ts
git commit -m "feat(auth): add AES-256-GCM secret-crypto for feishu app_secret"
```

---

## Task 3: feishu_apps / auth_logs 存储层

**Files:**
- Create: `src/lib/feishu-app-store.ts`

- [ ] **Step 1: 写实现**

```ts
// src/lib/feishu-app-store.ts
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
```

- [ ] **Step 2: 用 dev server 跑类型检查**

```bash
npx tsc --noEmit
```
预期：0 错误（前提是 Task 4 的 `FeishuApp` / `AuthLog` 类型先加；本步骤可临时把类型标 any 跑通，Task 4 修正后删 any）。

实际做法：先在 `src/types/index.ts` 临时加：
```ts
export interface FeishuApp {
  id: string; app_id: string; app_secret_enc: string; tenant_key: string;
  enterprise_name: string; redirect_uri: string; status: 'active' | 'disabled';
  created_at: string; created_by: string | null;
}
export interface AuthLog {
  id: string; user_id: string | null; app_id: string | null; tenant_key: string | null;
  open_id: string | null; ip: string | null; ua: string | null;
  success: boolean; error: string | null; created_at: string;
}
```
Task 4 会正式化这两段。

- [ ] **Step 3: Commit**

```bash
git add src/lib/feishu-app-store.ts src/types/index.ts
git commit -m "feat(auth): add feishu-apps store + types"
```

---

## Task 4: 完善 types/index.ts

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: 在文件顶部加新类型，`User` 接口加字段**

```ts
// 紧跟现有 export 之后、// ============ 用户 ============ 之前插入
export interface FeishuApp {
  id: string;
  app_id: string;
  app_secret_enc: string;
  tenant_key: string;
  enterprise_name: string;
  redirect_uri: string;
  status: 'active' | 'disabled';
  created_at: string;
  created_by: string | null;
}

export interface AuthLog {
  id: string;
  user_id: string | null;
  app_id: string | null;
  tenant_key: string | null;
  open_id: string | null;
  ip: string | null;
  ua: string | null;
  success: boolean;
  error: string | null;
  created_at: string;
}
```

把 `User` 接口加一行：
```ts
export interface User {
  id: string;
  feishu_open_id: string;
  feishu_tenant_key?: string | null;  // 新增
  name: string;
  // ... 其余字段不变
}
```

- [ ] **Step 2: 类型检查**

```bash
npx tsc --noEmit
```
预期：0 错误。

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(auth): add FeishuApp/AuthLog types and User.tenant_key"
```

---

## Task 5: 重构 feishu.ts 接收 app_secret

**Files:**
- Modify: `src/lib/feishu.ts`

- [ ] **Step 1: 改 `getFeishuAuthUrl` 接收 `appId`**

把 `getEnv('FEISHU_APP_ID')` 改为参数：
```ts
// 旧：getFeishuAuthUrl(redirectUri: string): string
// 新：
export function getFeishuAuthUrl(appId: string, redirectUri: string): string {
  const params = new URLSearchParams({
    app_id: appId,  // ← 不再 getEnv
    redirect_uri: redirectUri,
    response_type: 'code',
    state: Math.random().toString(36).substring(2),
  });
  return `https://open.feishu.cn/open-apis/authen/v1/authorize?${params.toString()}`;
}
```

- [ ] **Step 2: 改 `getFeishuUserToken` 接收 `appSecret`**

```ts
// 旧：getFeishuUserToken(code: string)
// 新：
export async function getFeishuUserToken(code: string, appSecret: string): Promise<{
  access_token: string;
  refresh_token: string;
  open_id: string;
  union_id: string;
  user_id: string;
}> {
  // 用传入的 appSecret 调飞书 /auth/v3/tenant_access_token/internal
  // 拿 tenant_access_token，再换 user_access_token
  const appId = getEnv('FEISHU_APP_ID');  // 仍用 env 拿 appId（要查 feishu_apps 表，但旧调用方没传 appId；保留 env 作为临时兜底，Task 6 改造后这行可删）
  // ↓ 这段先按旧逻辑：用 env 拿 appId（也支持 ISV/三方应用场景下 appId 来自调用方）
  // 实际建议：调用方传入 (appId, appSecret)，callback route 统一从 feishu_apps 查
  const tenantRes = await fetch(`${FEISHU_API_BASE}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  const tenantData = await tenantRes.json();
  if (tenantData.code !== 0) throw new Error(`获取 tenant_access_token 失败: ${tenantData.msg}`);
  const tenantToken = tenantData.tenant_access_token;

  const res = await fetch(`${FEISHU_API_BASE}/authen/v1/oidc/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tenantToken}`,
    },
    body: JSON.stringify({ grant_type: 'authorization_code', code }),
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(`获取 user_access_token 失败: ${data.msg}`);
  return data.data;
}
```

- [ ] **Step 3: 改 `getFeishuUserInfo` 不变**

保持现状（接收 userAccessToken，从飞书拿用户信息含 `tenant_key`）。

- [ ] **Step 4: 把 `getFeishuUserToken` 的入参从 `appSecret` 改成 `(code, appId, appSecret)`，内部用传入 appId**

> **修订**：上面 Step 2 的 `appId = getEnv(...)` 不彻底——多租户时 appId 必须从 `feishu_apps` 表来。统一改成 3 参数：

```ts
export async function getFeishuUserToken(
  code: string,
  appId: string,
  appSecret: string,
): Promise<{...}> {
  const tenantRes = await fetch(`${FEISHU_API_BASE}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  // ... 同上
}
```

- [ ] **Step 5: 类型检查**

```bash
npx tsc --noEmit
```
预期：会有 2 处调用方报错（`callback/route.ts` 和 `auth/feishu/route.ts`）—— 后续 Task 7/8 修复，符合预期。

- [ ] **Step 6: Commit**

```bash
git add src/lib/feishu.ts
git commit -m "refactor(auth): feishu.ts functions accept appId/appSecret params"
```

---

## Task 6: 公开列表 API

**Files:**
- Create: `src/app/api/feishu-apps/public/route.ts`

- [ ] **Step 1: 写 API**

```ts
// src/app/api/feishu-apps/public/route.ts
import { NextResponse } from 'next/server';
import { listActiveFeishuAppsPublic } from '@/lib/feishu-app-store';

// GET /api/feishu-apps/public — 公开：active 企业的 app_id + enterprise_name
export async function GET() {
  try {
    const apps = await listActiveFeishuAppsPublic();
    return NextResponse.json({ apps });
  } catch (e) {
    return NextResponse.json({ apps: [] }, { status: 500 });
  }
}
```

- [ ] **Step 2: 验证**

先用 Task 11 录入一条 feishu_apps 数据（先做 Task 11 录入纵腾），再：
```bash
curl -s https://hras-ai-land.vercel.app/api/feishu-apps/public | jq
```
预期：返回 `{ "apps": [{"app_id":"...","enterprise_name":"纵腾集团"}] }`，**不返回 `app_secret_enc` 字段**。

- [ ] **Step 3: Commit**

```bash
git add src/app/api/feishu-apps/public/route.ts
git commit -m "feat(auth): public API to list active feishu_apps for login UI"
```

---

## Task 7: 飞书 OAuth 发起路由（多租户）

**Files:**
- Modify: `src/app/api/auth/feishu/route.ts`

- [ ] **Step 1: 改写 route**

```ts
// src/app/api/auth/feishu/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getFeishuAuthUrl } from '@/lib/feishu';
import { getFeishuAppByAppId } from '@/lib/feishu-app-store';

// GET /api/auth/feishu?app_id=xxx — 发起飞书 OAuth 登录
export async function GET(request: NextRequest) {
  const appId = request.nextUrl.searchParams.get('app_id');
  if (!appId) {
    return NextResponse.redirect(new URL('/login?error=missing_app_id', request.url));
  }

  const app = await getFeishuAppByAppId(appId);
  if (!app) {
    return NextResponse.redirect(new URL('/login?error=unknown_app', request.url));
  }
  if (app.status !== 'active') {
    return NextResponse.redirect(new URL('/login?error=app_disabled', request.url));
  }

  // state 纯随机；app_id 单独存 cookie
  const state = Math.random().toString(36).substring(2) + Date.now().toString(36);
  const authUrl = getFeishuAuthUrl(app.app_id, app.redirect_uri, state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set('feishu_oauth_state', state, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 300 });
  response.cookies.set('feishu_oauth_app_id', app.app_id, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 300 });
  return response;
}
```

- [ ] **Step 2: 验证**

```bash
# 触发飞书 OAuth
curl -i 'https://hras-ai-land.vercel.app/api/auth/feishu?app_id=<纵腾 app_id>' | head -20
```
预期：302 重定向到 `https://open.feishu.cn/open-apis/authen/v1/authorize?...`，query 里 `app_id=<纵腾 app_id>`、`redirect_uri=https://hras-ai-land.vercel.app/api/auth/feishu/callback`。

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/feishu/route.ts
git commit -m "feat(auth): /api/auth/feishu supports ?app_id= for multi-tenant"
```

---

## Task 8: 飞书 OAuth 回调路由（多租户 + 联合主键 upsert）

**Files:**
- Modify: `src/app/api/auth/feishu/callback/route.ts`

- [ ] **Step 1: 完整重写 route**

```ts
// src/app/api/auth/feishu/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getFeishuUserToken, getFeishuUserInfo } from '@/lib/feishu';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getFeishuAppByAppId, decryptAppSecret, logAuth } from '@/lib/feishu-app-store';
import { getAuthSessionCookieOptions } from '@/lib/auth-session';
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
    const appSecret = await decryptAppSecret(app);
    const tokenData = await getFeishuUserToken(code, app.app_id, appSecret);

    // 5. 拿飞书用户信息（含 tenant_key）
    const feishuUser = await getFeishuUserInfo(tokenData.access_token);

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
      .select('id, roles, department')
      .eq('feishu_tenant_key', feishuUser.tenant_key)
      .eq('feishu_open_id', feishuUser.open_id)
      .single();

    let userId: string;
    let userRoles: string[] = ['user'];
    let userDept = '';

    if (existingUser) {
      userId = existingUser.id;
      userRoles = existingUser.roles || ['user'];
      userDept = existingUser.department || '';
      await admin.from('users').update({
        name: feishuUser.name,
        avatar: feishuUser.avatar_url || feishuUser.avatar_thumb,
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
        department: '',
        roles: isFirstAdmin ? ['admin'] : ['user'],
      }).select('id').single();
      if (error) throw error;
      userId = newUser.id;
      userRoles = isFirstAdmin ? ['admin'] : ['user'];
    }

    // 8. 写 cookie
    const response = NextResponse.redirect(new URL('/', request.url));
    response.cookies.set('feishu_user_id', userId, getAuthSessionCookieOptions({ httpOnly: true }));
    response.cookies.set('feishu_user_info', JSON.stringify({
      id: userId,
      name: feishuUser.name,
      avatar: feishuUser.avatar_url || feishuUser.avatar_thumb,
      roles: userRoles,
      department: userDept,
    }), getAuthSessionCookieOptions({ httpOnly: false }));

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
```

- [ ] **Step 2: 验证 cookie 清除和 state 校验**

```bash
# 1. 故意触发 state 不匹配（不带 code 直接访问）
curl -i 'https://hras-ai-land.vercel.app/api/auth/feishu/callback' | head -5
```
预期：302 到 `/login?error=no_code`（因为没 code）。

```bash
# 2. 真实登录流（手动浏览器）走一遍，登录成功后：
#    - home 页能进
#    - supabase auth_logs 多一条 success 记录
#    - feishu_oauth_state / feishu_oauth_app_id cookie 不存在
```

- [ ] **Step 3: 验证未知租户**

临时把 `feishu_apps` 某条 `status` 改 `disabled`，再触发该 app 的 OAuth：
```sql
update feishu_apps set status='disabled' where enterprise_name='XX 公司';
```
预期：302 到 `/login?error=app_disabled`（来自发起路由）；已发起但 callback 时该 app 被禁用 → 报 `unknown_app`。

- [ ] **Step 4: Commit**

```bash
git add src/app/api/auth/feishu/callback/route.ts
git commit -m "feat(auth): callback route multi-tenant + joint-unique upsert + auth_logs"
```

---

## Task 9: admin 管理 API（CRUD）

**Files:**
- Create: `src/app/api/feishu-apps/route.ts`

- [ ] **Step 1: 写实现**

```ts
// src/app/api/feishu-apps/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { listFeishuApps, createFeishuApp, updateFeishuAppStatus, getFeishuAppByAppId, decryptAppSecret } from '@/lib/feishu-app-store';
import { getTenantAccessToken } from '@/lib/feishu';
import { logAuth } from '@/lib/feishu-app-store';

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

// POST /api/feishu-apps/test — 测试连通性
export async function PUT(req: NextRequest) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { id } = await req.json();
  const apps = await listFeishuApps();
  const app = apps.find(a => a.id === id);
  if (!app) return NextResponse.json({ error: 'not found' }, { status: 404 });
  try {
    const secret = await decryptAppSecret(app);
    await getTenantAccessToken(app.app_id, secret);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 400 });
  }
}
```

- [ ] **Step 2: 给 `feishu.ts` 的 `getTenantAccessToken` 改签名**

把 `getTenantAccessToken` 改成接受 `(appId, appSecret)` 参数：
```ts
export async function getTenantAccessToken(appId: string, appSecret: string): Promise<string> {
  const res = await fetch(`${FEISHU_API_BASE}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(`获取 tenant_access_token 失败: ${data.msg}`);
  return data.tenant_access_token;
}
```

并把 `getEnv('FEISHU_APP_ID')` / `getEnv('FEISHU_APP_SECRET')` 都从该函数中删掉。

- [ ] **Step 3: 类型检查**

```bash
npx tsc --noEmit
```
预期：0 错误。

- [ ] **Step 4: 验证**

```bash
# 1. 未登录访问
curl -i 'https://hras-ai-land.vercel.app/api/feishu-apps' | head -3
```
预期：403。

```bash
# 2. admin 登录后访问
curl -s 'https://hras-ai-land.vercel.app/api/feishu-apps' \
  -H "Cookie: feishu_user_info=<admin cookie>" | jq
```
预期：返回 `{ apps: [...] }` 数组。

- [ ] **Step 5: Commit**

```bash
git add src/app/api/feishu-apps/route.ts src/lib/feishu.ts
git commit -m "feat(auth): admin CRUD API for feishu_apps + test connectivity"
```

---

## Task 10: admin 管理 UI

**Files:**
- Create: `src/app/admin/feishu-apps/page.tsx`

- [ ] **Step 1: 写最小可用 UI（列表 + 录入 + 状态切换 + 测试连通性）**

参考项目里 `/admin/users/page.tsx` 的 glassmorphism 风格（本项目规范要求），简化版结构：

```tsx
'use client';
import { useState, useEffect } from 'react';
import { App, Button, Card, Form, Input, message, Modal, Select, Space, Table } from 'antd';
import { PlusOutlined, ThunderboltOutlined } from '@ant-design/icons';

interface FeishuApp {
  id: string; app_id: string; tenant_key: string;
  enterprise_name: string; redirect_uri: string;
  status: 'active' | 'disabled';
  created_at: string;
}

export default function FeishuAppsPage() {
  const { message: msgApi } = App.useApp();
  const [apps, setApps] = useState<FeishuApp[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/feishu-apps');
      const j = await r.json();
      if (r.ok) setApps(j.apps);
      else msgApi.error(j.error);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const onCreate = async () => {
    const values = await form.validateFields();
    const r = await fetch('/api/feishu-apps', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    const j = await r.json();
    if (r.ok) { msgApi.success('已录入'); setModalOpen(false); form.resetFields(); load(); }
    else msgApi.error(j.error);
  };

  const onToggleStatus = async (a: FeishuApp) => {
    const next = a.status === 'active' ? 'disabled' : 'active';
    const r = await fetch('/api/feishu-apps', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: a.id, status: next }),
    });
    if (r.ok) { msgApi.success('已更新'); load(); }
  };

  const onTest = async (a: FeishuApp) => {
    const r = await fetch('/api/feishu-apps', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: a.id }),
    });
    const j = await r.json();
    if (j.ok) msgApi.success('连通成功');
    else msgApi.error(`连通失败：${j.error}`);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">飞书应用配置</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新增企业</Button>
      </div>
      <Card className="glass" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
        <Table
          dataSource={apps}
          rowKey="id"
          loading={loading}
          columns={[
            { title: '企业名称', dataIndex: 'enterprise_name' },
            { title: 'App ID', dataIndex: 'app_id' },
            { title: 'Tenant Key', dataIndex: 'tenant_key' },
            { title: '状态', dataIndex: 'status', render: (s) => s === 'active' ? '✅ active' : '⛔ disabled' },
            { title: '创建时间', dataIndex: 'created_at', render: (t) => new Date(t).toLocaleString() },
            {
              title: '操作', render: (_, a) => (
                <Space>
                  <Button size="small" icon={<ThunderboltOutlined />} onClick={() => onTest(a)}>测试</Button>
                  <Button size="small" onClick={() => onToggleStatus(a)}>{a.status === 'active' ? '禁用' : '启用'}</Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="新增飞书企业"
        open={modalOpen}
        onOk={onCreate}
        onCancel={() => setModalOpen(false)}
        okText="录入"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="企业代码"
            name="enterprise_name"
            rules={[{ required: true, message: '请输入企业代码' }]}
            extra="建议使用 2-3 个字母的短码（如 ZT、GF、WX），将显示在登录按钮上"
          >
            <Input placeholder="如：ZT" />
          </Form.Item>
          <Form.Item label="App ID" name="app_id" rules={[{ required: true }]}>
            <Input placeholder="飞书开放平台 app_id" />
          </Form.Item>
          <Form.Item label="App Secret" name="app_secret" rules={[{ required: true }]}>
            <Input.Password placeholder="提交后立即加密，DB 不可见明文" />
          </Form.Item>
          <Form.Item label="Tenant Key" name="tenant_key" rules={[{ required: true }]}>
            <Input placeholder="飞书租户 key（企业管理员在飞书后台可查）" />
          </Form.Item>
          <Form.Item label="回调 URL" name="redirect_uri" rules={[{ required: true }]}>
            <Input placeholder="https://hras-ai-land.vercel.app/api/auth/feishu/callback" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: 在 Navigation.tsx 加入口（如有 admin 入口分组）**

查看 `src/components/Navigation.tsx` 的现有 admin 入口模式（如 `/admin/users`），按同样模式加 `/admin/feishu-apps` 链接。

- [ ] **Step 3: 验证**

1. 访问 `/admin/feishu-apps` —— 显示空列表
2. 录入纵腾（先准备 app_id/secret/tenant_key，tenant_key 需登录纵腾飞书后从 `user_info` 拿一次）
3. 测试连通性 —— ✅
4. 列表显示纵腾，status=active

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/feishu-apps/page.tsx src/components/Navigation.tsx
git commit -m "feat(auth): admin UI for feishu_apps CRUD + test connectivity"
```

---

## Task 11: Login 页 3 个企业按钮

**Files:**
- Modify: `src/app/login/page.tsx`

- [ ] **Step 1: 替换「纵腾飞书账号登录」按钮为动态企业列表**

把现有 46-69 行（纵腾按钮）替换为：

```tsx
{/* 飞书登录：多企业 */}
<FeishuEnterpriseButtons />
```

在文件顶部 import 之外，新增组件（用 `useEffect` 拉 `/api/feishu-apps/public`）：

```tsx
function FeishuEnterpriseButtons() {
  const [apps, setApps] = useState<Array<{ app_id: string; enterprise_name: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/feishu-apps/public').then(r => r.json()).then(j => {
      if (j.apps) setApps(j.apps);
    });
  }, []);

  const go = (appId: string) => {
    setLoading(true);
    window.location.href = `/api/auth/feishu?app_id=${encodeURIComponent(appId)}`;
  };

  if (apps.length === 0) {
    // 无 active 飞书应用配置 → 显示提示（管理员尚未录入）
    return (
      <div className="text-center text-sm py-3" style={{ color: 'var(--text-muted)' }}>
        飞书登录暂未配置，请联系 AILand 管理员
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {apps.map((a, i) => (
        <button
          key={a.app_id}
          onClick={() => go(a.app_id)}
          disabled={loading}
          className="w-full h-12 rounded-xl text-base font-medium transition-all hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
          style={i === 0
            ? { background: 'var(--gradient-primary)', color: 'white' }
            : { background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(26,58,138,0.15)', color: 'var(--foreground)' }
          }
        >
          {a.enterprise_name}飞书授权登录
        </button>
      ))}
    </div>
  );
}
```

> **说明**：第一个企业用主色渐变，其余用次要样式（细边+白底），匹配设计稿的"并列按钮"。

- [ ] **Step 2: 把上方的"纵腾用户"小标签 + 说明文案调整**

把 47-49 行的"纵腾用户"标签删掉（或改为"飞书用户"），调整 83-85 行底部说明：
- 改成"飞书用户请选择您所在的企业登录；无飞书账号请注册"
- 加上"建议从飞书工作台「AILand」图标进入"提示

- [ ] **Step 3: 验证**

1. 浏览器访问 `/login`（未登录）
2. 看到 3 个企业按钮（纵腾主色 + 2 个次要）
3. 点纵腾 → 跳飞书 OAuth
4. 点外部企业 A → 跳飞书 OAuth（app_id 是 A 的）

- [ ] **Step 4: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat(auth): login page shows 3 enterprise feishu buttons"
```

---

## Task 12: Vercel cron 健康检查

**Files:**
- Create: `src/app/api/cron/feishu-apps-health/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: 写 cron API**

```ts
// src/app/api/cron/feishu-apps-health/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { listFeishuApps, decryptAppSecret, updateFeishuAppStatus, logAuth } from '@/lib/feishu-app-store';
import { getTenantAccessToken } from '@/lib/feishu';

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
      await getTenantAccessToken(app.app_id, secret);
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
```

- [ ] **Step 2: 在 vercel.json 加 cron 配置**

如果 `vercel.json` 已有 `crabs` 数组，加一条；否则：
```json
{
  "crons": [
    {
      "path": "/api/cron/feishu-apps-health",
      "schedule": "0 3 * * *"
    }
  ]
}
```

- [ ] **Step 3: 验证**

```bash
# 手动触发
curl -s 'https://hras-ai-land.vercel.app/api/cron/feishu-apps-health' \
  -H "Authorization: Bearer $CRON_SECRET" | jq
```
预期：返回 `{ checked: N, results: [...] }`，所有 ok=true。

故意把一个 app_secret 改成错误值，验证自动 disable 逻辑：
```bash
# 用 admin UI 重新录入一个错 secret 的 app → 等 cron → 看 status 是否变 disabled
# 或：手动 SQL update app_secret_enc 为一个错加密串
```
预期：cron 跑完后该 app `status='disabled'`，auth_logs 多一条 `health_check_failed` 记录。

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/feishu-apps-health/route.ts vercel.json
git commit -m "feat(auth): daily cron checks feishu app connectivity, auto-disables failures"
```

---

## Task 13: 灰度 + 收尾

- [ ] **Step 1: Vercel 配置环境变量**

在 Vercel Dashboard：
- **新增** `FEISHU_SECRET_ENCRYPTION_KEY`（`openssl rand -base64 32` 生成）
- **删除** `FEISHU_APP_ID` / `FEISHU_APP_SECRET`（已迁到 feishu_apps 表）

- [ ] **Step 2: 数据库执行迁移**

在 Supabase Dashboard SQL Editor 跑 `supabase/migrations/032_feishu_apps.sql`。

- [ ] **Step 3: 录入 3 家企业**

admin 登录 → `/admin/feishu-apps` → 录入 3 条：
- 纵腾集团（已有 HSSC集成助手）
- XX 公司（外部企业 IT 建的）
- YY 公司

录入前需先从各企业 IT 拿到：
- `app_id`
- `app_secret`（不写入 README/Notion，直接通过加密渠道给 AILand 管理员）
- `tenant_key`（让对方 IT 在飞书工作台打开一次 AILand，从 network 抓 user_info 接口拿）

- [ ] **Step 4: 端到端验证**

- [ ] 纵腾用户走按钮登录 → ✅
- [ ] 纵腾用户从飞书工作台进入 → ✅
- [ ] 外部企业 A 用户走按钮登录 → ✅
- [ ] 外部企业 A 用户从工作台进入 → ✅
- [ ] 故意制造未知租户（临时禁用某 app）→ 走该 app 的 callback → 报 `unknown_app` → auth_logs 有记录
- [ ] DB 看 `feishu_apps.app_secret_enc` → 是密文
- [ ] 飞书 cron 跑通
- [ ] 保留用户名密码兜底，确认仍可用

- [ ] **Step 5: 观察 1 周后下线用户名密码**

观察期若无问题，删除 `/login` 的"用户名密码"区块，删除 `/api/auth/login` 和 `/api/auth/register` route。

- [ ] **Step 6: 更新记忆**

更新 `~/.claude/projects/.../memory/project_external_user_auth.md`：
- 状态改为"已用飞书多租户 OAuth"
- 记录实现位置（`docs/superpowers/specs/...` 和 commit 列表）
- 删掉"待探索"清单

- [ ] **Step 7: Commit 收尾**

```bash
git add docs/ memory/
git commit -m "docs: update external user auth memory with multi-tenant approach"
```

---

## 验证矩阵（汇总）

| 场景 | 预期 | 验证 Task |
|------|------|----------|
| 纵腾用户走按钮登录 | ✅ 走 feishu_apps 表纵腾配置 | 8, 11, 13 |
| 纵腾用户从飞书工作台点 AILand | ✅ 飞书带纵腾 app_id | 8, 13 |
| 外部企业 A 走按钮登录 | ✅ 走 feishu_apps 表 A 配置 | 8, 11, 13 |
| 外部企业 A 从工作台进入 | ✅ 飞书带 A 的 app_id | 8, 13 |
| 未知租户 / app 被禁用 | ❌ `app_disabled` / `unknown_app` 错误 + 写 auth_logs | 7, 8, 13 |
| 外部企业用户 feishu_open_id 撞纵腾用户 | ❌ 联合唯一索引阻止 | 1, 8 |
| DB 看 app_secret 字段 | ❌ 密文 | 2, 3, 13 |
| state 校验失败 | ❌ 拒绝 + auth_logs | 8 |
| Vercel cron 跑连通性 | ✅ 失败 app 自动 disabled | 12, 13 |
| 旧用户名密码用户还能登 | ✅ 兼容（feishu_tenant_key 为 null） | 1, 13 |

## 取舍记录

- **不上架飞书应用市场**：省软著/审核；3 家规模不需要
- **保留用户名密码兜底 1 周**：灰度观察
- **不实现密钥轮换**：规模不需要
- **不写单测**：项目无测试框架，按 CONTRIBUTING.md 自检规范用 curl/REPL 验证
- **不引新依赖**：AES 用 Node 内置 `crypto`

## 不在范围

- ISV/三方应用 + 飞书应用市场上架
- 飞书小程序入口
- 个人飞书账号（无企业归属）登录
- 邮箱魔法链接登录（独立方案，与本设计不冲突）
