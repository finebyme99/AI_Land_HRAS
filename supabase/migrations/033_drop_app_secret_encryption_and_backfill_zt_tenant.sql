-- supabase/migrations/033_drop_app_secret_encryption_and_backfill_zt_tenant.sql
--
-- 1. 移除 app_secret 加密层
-- 2. 回填纵腾老用户的 feishu_tenant_key（避免 OAuth callback 把老用户当成新用户创建）
--
-- 零用户影响：老用户的 id / roles / department / bio / points / level / 所有 FK 引用保持原样

-- ===== Part 1: 加密层移除 =====

-- 1.1 加 app_secret 列（nullable，先不强制 NOT NULL 以便后续灵活）
alter table feishu_apps add column app_secret text;

-- 1.2 删除现有的加密 GF 记录（密文不再有意义，下一步会重新以明文插入）
delete from feishu_apps where enterprise_name = 'GF';

-- 1.3 删 app_secret_enc 列
alter table feishu_apps drop column app_secret_enc;

-- ===== Part 2: 回填纵腾老用户的 tenant_key =====

-- 把所有"飞书用户但 tenant_key 为空"的存量用户标记为纵腾（1252bd3caa4fd75d）
-- 这样新的 OAuth callback 在 lookup (tenant_key, open_id) 时能命中老用户，避免：
--   - 创建重复 user 记录（新 UUID）
--   - 丢失老用户的 roles / department / bio / points / level
--   - 孤立所有外键引用（cases.author_id, comments.user_id, etc.）

update users
set feishu_tenant_key = '1252bd3caa4fd75d'
where feishu_tenant_key is null
  and feishu_open_id is not null;

-- 验证（部署后可在 Supabase Dashboard 跑一次）：
--   select count(*) as backfilled from users
--   where feishu_tenant_key = '1252bd3caa4fd75d'
--   and feishu_open_id is not null;
-- 应该 = 纵腾存量飞书登录用户数
