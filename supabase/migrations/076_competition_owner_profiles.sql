-- 076: Store structured Feishu person metadata for competition landing owners.
-- Keeps the existing text[] owner columns for filters and display fallback.

ALTER TABLE competition_submissions
  ADD COLUMN IF NOT EXISTS biz_owner_profiles JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_owner_profiles JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN competition_submissions.biz_owner_profiles IS
  'Structured Feishu person metadata for business owners: name, openId, userId, avatar, email, employeeId, department.';

COMMENT ON COLUMN competition_submissions.ai_owner_profiles IS
  'Structured Feishu person metadata for AI owners: name, openId, userId, avatar, email, employeeId, department.';
