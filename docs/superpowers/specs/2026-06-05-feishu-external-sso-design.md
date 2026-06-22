# 飞书外部企业用户单点登录设计

**日期**：2026-06-05
**状态**：已批准，待实现
**适用范围**：AILand 登录模块（涉及 3 家已确定企业：纵腾 + 2 家外部飞书企业）

## 背景

AILand 当前用「飞书自建应用（HSSC集成助手）」做 OAuth，绑死在纵腾租户内——外部企业飞书用户无法登录。临时方案是用户名 + 密码（2026-06-01 上线，详见 `project_external_user_auth` 记忆），但用户名密码体验差、外部用户常忘记密码。

业务方已确定 3 家企业接入 AILand，希望 3 家企业的飞书用户都能用飞书账号直接登录，淘汰用户名密码临时方案。

## 飞书原生结论

经查飞书开放平台官方文档：

- **union_id 不是跨企业唯一的**——只在「同一开发主体」名下唯一
- 同一飞书账号加入不同企业被视为不同用户（不同 open_id / 不同身份）
- **飞书原生不支持一个自建应用给任意外部企业用户授权**

可行的跨企业路径：
- **ISV/三方应用 + 飞书应用市场**：要公司资质、软著、审核（2-4 周），且每个外部企业需管理员主动"安装"
- **多租户 × 多个企业自建应用**：每家企业 IT 各自建一个飞书自建应用，AILand 后台存多套 (app_id, app_secret)；**不上架、不需软著、IT 配合度可控**

选 **多租户 × 多个企业自建应用**（中等方案），原因：
- 已确定 3 家企业，规模小
- 不需走飞书应用市场审核，省去软著/资质
- 外部企业 IT 配合度可控（3 家都是已合作方）
- 后续如要扩到 20+ 家，可平滑过渡到 ISV 方案

## 目标

1. 3 家企业飞书用户都能用飞书账号直接登录 AILand
2. 纵腾内部用户登录体验不变
3. 不再依赖用户名密码临时方案（可保留兜底）
4. 不上架飞书应用市场、不需软著

## 数据模型

### 1. 新增 `feishu_apps` 表

```sql
create table feishu_apps (
  id              uuid primary key default gen_random_uuid(),
  app_id          text not null unique,        -- 飞书 app_id
  app_secret_enc  text not null,               -- AES-256-GCM 加密存储
  tenant_key      text not null unique,        -- 飞书租户 key（飞书回调/换 token 后从 user_info 拿）
  enterprise_name text not null,               -- 「纵腾集团」/「XX 公司」
  redirect_uri    text not null,               -- 该企业自建应用配置的回调地址
  status          text not null default 'active',  -- active | disabled
  created_at      timestamptz default now(),
  created_by      uuid references users(id)
);
```

### 2. `users` 表改造

```sql
-- 加 tenant_key 字段
alter table users add column feishu_tenant_key text;

-- 联合唯一索引（部分索引，username/password 用户这俩字段为 null 不影响）
create unique index users_tenant_openid_uniq
  on users (feishu_tenant_key, feishu_open_id)
  where feishu_open_id is not null;
```

**回填策略**：纵腾存量用户的 `feishu_tenant_key` 在首次 OAuth 登录时自动从 `user_info.tenant_key` 写入。

### 3. 新增 `auth_logs` 登录审计表

```sql
create table auth_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users(id),
  app_id      text,                  -- 来自哪个飞书 app
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

## 登录流程

### `/api/auth/feishu?app_id=xxx`（发起）

```ts
// 入参：app_id（来自 login 页的 3 个按钮之一，或飞书工作台带过来）
const app = await getFeishuAppByAppId(app_id);
if (!app || app.status !== 'active') {
  return redirect('/login?error=app_disabled');
}

const state = generateState();  // 纯随机串，存 cookie 5 分钟用于防 CSRF
setCookie('feishu_oauth_state', state, { maxAge: 300 });
// app_id 单独存 cookie（不混入 state，避免破坏 state 随机性）
setCookie('feishu_oauth_app_id', app.app_id, { maxAge: 300 });

const authUrl = buildAuthUrl(app.app_id, app.redirect_uri, state);
return redirect(authUrl);
```

### `/api/auth/feishu/callback`（回调）

```ts
const code = searchParams.get('code');
const state = searchParams.get('state');

// 1. state 校验
const cookieState = getCookie('feishu_oauth_state');
if (!state || state !== cookieState) {
  await logAuth({ error: 'invalid_state', success: false });
  return redirect('/login?error=invalid_state');
}

// 2. 从独立 cookie 拿 app_id（不来自 query，防篡改）
const appId = getCookie('feishu_oauth_app_id');
clearCookie('feishu_oauth_state');
clearCookie('feishu_oauth_app_id');

const app = await getFeishuAppByAppId(appId);
if (!app) {
  await logAuth({ app_id: appId, error: 'unknown_app', success: false });
  return redirect('/login?error=unknown_app');
}

// 3. 用该 app 的 secret 换 user_access_token
const appSecret = decrypt(app.app_secret_enc);
const token = await getFeishuUserToken(code, appSecret);
const feishuUser = await getFeishuUserInfo(token.access_token);

// 4. tenant_key 一致性检查（飞书返回的 tenant_key 应和表里一致）
if (feishuUser.tenant_key !== app.tenant_key) {
  await logAuth({ app_id: appId, tenant_key: feishuUser.tenant_key, error: 'tenant_mismatch', success: false });
  return redirect('/login?error=tenant_mismatch');
}

// 5. upsert user（联合主键：feishu_tenant_key + feishu_open_id）
const user = await upsertFeishuUser({
  tenant_key: feishuUser.tenant_key,
  open_id: feishuUser.open_id,
  name: feishuUser.name,
  avatar: feishuUser.avatar_url || feishuUser.avatar_thumb,
});

// 6. 写 cookie session（统一走 src/lib/auth-session.ts，当前 30 天）
setCookie('feishu_user_id', user.id, getAuthSessionCookieOptions({ httpOnly: true }));
setCookie('feishu_user_info', JSON.stringify({...}), getAuthSessionCookieOptions({ httpOnly: false }));

await logAuth({ user_id: user.id, app_id: appId, tenant_key: feishuUser.tenant_key, open_id: feishuUser.open_id, success: true });
return redirect('/');
```

## Login 页布局

```
┌──────────────────────────────┐
│ 欢迎回来                       │
│ HR 的 AI 社区                  │
│                               │
│ ┌─────────────────────────┐  │
│ │ [icon] 纵腾飞书账号登录    │  │  ← 主色渐变
│ └─────────────────────────┘  │
│ ┌─────────────────────────┐  │
│ │ [icon] XX 公司飞书账号登录 │  │  ← 次要样式（细边、白底）
│ └─────────────────────────┘  │
│ ┌─────────────────────────┐  │
│ │ [icon] YY 公司飞书账号登录 │  │
│ └─────────────────────────┘  │
│                               │
│ ─── 无飞书账号 ────────────  │
│ [用户名密码 登录 | 注册]       │  ← 保留兜底
│                               │
│ 提示：飞书用户建议从           │
│ 飞书工作台「AILand」图标进入  │
└──────────────────────────────┘
```

3 个企业按钮的数据来源：编译时硬编码 3 个企业名（前端静态）+ `app_id` 来自 `feishu_apps` 表查询（`/api/feishu-apps/public` 返回 active 企业的 `app_id` 和 `enterprise_name`）。

## 安全设计

| 风险 | 对策 |
|------|------|
| `app_secret` 泄露 | AES-256-GCM 加密存储，密钥走 Vercel env `FEISHU_SECRET_ENCRYPTION_KEY`，DB 不可见明文 |
| CSRF / 重放 | state 随机串 + 5 分钟 TTL cookie；callback 校验 |
| 越权（外部企业用户登 AILand 后访问管理员功能） | 现有 roles 字段不变，外部企业用户默认 `['user']`，无 admin 权限 |
| 同一飞书账号多企业身份混淆 | 联合主键 `(feishu_tenant_key, feishu_open_id)` 隔离 |
| 未知租户登录 | callback 检查 `tenant_key` 是否在 `feishu_apps`；不在则 `unknown_tenant` 错误 + 写 auth_logs + 提示联系 AILand 管理员 |
| `app_id` 被改包/被注入 | state 携带 `app_id`，且 callback 用 state 取 `app_id` 而非 query（防篡改） |
| 加密密钥泄露 | `FEISHU_SECRET_ENCRYPTION_KEY` 走 Vercel env（不进入 git），密钥轮换需重加密所有 `app_secret_enc`（不实现，文档化） |

## 后台管理

### `/admin/feishu-apps` 页面

| 功能 | 说明 |
|------|------|
| 列表 | 所有 feishu_apps（app_id、enterprise_name、status、创建时间、最近一次登录） |
| 新增 | 录入：app_id、enterprise_name、app_secret（页面写明「提交后立即 AES 加密，DB 不可见明文」） |
| 编辑 | enterprise_name、status |
| 删除 | 软删：先确认无活跃用户 |
| 测试连通性 | 用 app_id/app_secret 实时换 `tenant_access_token`，成功/失败提示 |

权限：仅 `admin` / `moderator` 可访问（沿用现有 admin 门控）。

### Vercel cron 自检（每天一次）

```ts
// /api/cron/feishu-apps-health
// 遍历所有 active feishu_apps
for (const app of activeApps) {
  try {
    await getTenantAccessToken(decrypt(app.app_secret_enc));
  } catch (e) {
    await update(app.id, { status: 'disabled' });
    await notifyAdmin(`飞书应用连通失败：${app.enterprise_name}`);
  }
}
```

## 文件改动清单

### 新增
| 路径 | 说明 |
|------|------|
| `supabase/migrations/00X_feishu_apps.sql` | feishu_apps、auth_logs、users 新字段迁移 |
| `src/lib/secret-crypto.ts` | AES-256-GCM 加/解密工具（依赖 `FEISHU_SECRET_ENCRYPTION_KEY`） |
| `src/lib/feishu-app-store.ts` | feishu_apps 增删改查封装 |
| `src/app/admin/feishu-apps/page.tsx` | 管理后台 UI |
| `src/app/api/feishu-apps/route.ts` | CRUD（admin 鉴权） |
| `src/app/api/feishu-apps/public/route.ts` | 公开（返回 active 企业的 `app_id` + `enterprise_name`，不返回 secret） |
| `src/app/api/cron/feishu-apps-health/route.ts` | Vercel cron 自检 |

### 改动
| 路径 | 改动 |
|------|------|
| `src/lib/feishu.ts` | `getFeishuAuthUrl` / `getFeishuUserToken` / `getFeishuUserInfo` 接收 `app_secret` 参数（不再从 env 读 secret） |
| `src/app/api/auth/feishu/route.ts` | 接收 `?app_id=` 参数；查表拿 secret；写 state cookie |
| `src/app/api/auth/feishu/callback/route.ts` | 大改：根据 state 取 app_id → 查表 → 用对应 secret → 联合主键 upsert |
| `src/app/login/page.tsx` | 改：3 个企业按钮（数据来自 `/api/feishu-apps/public`） |
| `src/types/index.ts` | 加 `FeishuApp`、`AuthLog` 类型 |

### 不动
- `src/lib/supabase.ts`、`supabase-admin.ts`、`supabase-server.ts`、`supabase-browser.ts`
- `src/lib/auth-context.tsx`（业务层接口不变）
- 所有业务模块（cases / courses / apps / competitions / admin/*）

## 环境变量

```env
# 新增
FEISHU_SECRET_ENCRYPTION_KEY=<32-byte base64>  # Vercel env，openssl rand -base64 32 生成

# 删除（迁到 feishu_apps 表）
# FEISHU_APP_ID=<纵腾 app_id>           ← 删除
# FEISHU_APP_SECRET=<纵腾 app_secret>   ← 删除

# 保留
NEXT_PUBLIC_APP_URL=https://hras-ai-land.vercel.app
```

**纵腾的 (app_id, app_secret) 也录入 `feishu_apps` 表**——保证所有企业走统一路径，避免 callback 拿到 tenant_key 时"纵腾不在表里"的兜底逻辑。

## 部署步骤

1. Supabase 执行迁移 SQL
2. Vercel 配置 `FEISHU_SECRET_ENCRYPTION_KEY` 环境变量；**删除 FEISHU_APP_ID / FEISHU_APP_SECRET**（迁到 feishu_apps 表）
3. AILand 管理员在 `/admin/feishu-apps` 录入 3 家企业的 `(app_id, enterprise_name, app_secret)`（含纵腾）
4. 外部企业 IT 各自在自家飞书开放平台：
   - 创建自建应用
   - 配置 OAuth 回调 = `https://hras-ai-land.vercel.app/api/auth/feishu/callback`
   - 申请权限：获取用户基本信息、邮箱、手机号
   - 把 `app_id` / `app_secret` 加密发给 AILand 管理员
   - 在飞书工作台"添加应用"给企业用户用
5. 验证 Vercel cron 自检生效
6. 灰度：先留 1 周用户名密码兜底，验证稳定后下线

## 验证矩阵

| 场景 | 预期 |
|------|------|
| 纵腾用户走「纵腾飞书」按钮 | ✅ 走 feishu_apps 表纵腾配置，登录成功 |
| 纵腾用户从飞书工作台点 AILand 图标 | ✅ 飞书自动带纵腾 app_id（也是 feishu_apps 表中），登录成功 |
| 外部企业用户走对应按钮 | ✅ 走 feishu_apps 表对应配置，登录成功 |
| 外部企业用户从飞书工作台点 AILand 图标 | ✅ 飞书带外部 app_id，登录成功 |
| 未知租户 callback | ❌ `unknown_tenant` 错误 + 写 auth_logs + 引导联系管理员 |
| 外部企业用户的 feishu_open_id 撞纵腾用户 | ❌ 联合唯一索引阻止（理论上不会，open_id 跨租户不冲突） |
| DB 看 app_secret 字段 | ❌ 看到的是密文（`AES-GCM(iv|cipher|tag)`） |
| state 校验失败 | ❌ 拒绝 + 写 auth_logs |
| feishu_apps 删一条 | ✅ 软删（status=disabled），该企业用户无法再登录 |
| Vercel cron 跑连通性 | ✅ 失败的 app 自动 disabled，管理员告警 |

## 取舍

- **不上架飞书应用市场**：省软著/审核，3 家企业规模不需要；后续可平滑过渡
- **保留用户名密码兜底**：兼容老用户、应急用
- **不实现密钥轮换**：当前规模不需要，文档化后续
- **不做自服务门户**：3 家企业手动录入够用
- **不引入新依赖**：AES 用 Node 内置 `crypto`，不引 `crypto-js` 等

## 不在范围

- ISV 上架飞书应用市场
- 飞书小程序入口
- 个人飞书账号（无企业归属）登录
- 邮箱魔法链接登录（独立备选方案，与本设计不冲突）
