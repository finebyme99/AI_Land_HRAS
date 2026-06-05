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
create index idx_feishu_apps_status on feishu_apps(status);

-- 2. users 表加 tenant_key
alter table users add column feishu_tenant_key text;
-- Drop the global UNIQUE on feishu_open_id so the composite (tenant_key, open_id) is the only unique constraint.
-- Constraint was created in migration 001 as 'feishu_open_id TEXT UNIQUE NOT NULL' (auto-named users_feishu_open_id_key).
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_feishu_open_id_key;
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
create index idx_auth_logs_user_id on auth_logs(user_id);
create index idx_auth_logs_created_at on auth_logs(created_at desc);
