-- ============================================
-- 迁移 031：案例新增字段 + developers 关联表
-- ============================================

-- 1. 给 cases 表添加新字段
ALTER TABLE cases ADD COLUMN IF NOT EXISTS team_members TEXT DEFAULT '';
ALTER TABLE cases ADD COLUMN IF NOT EXISTS original_business_scenario TEXT DEFAULT '';
ALTER TABLE cases ADD COLUMN IF NOT EXISTS pain_points TEXT[] DEFAULT '{}';
ALTER TABLE cases ADD COLUMN IF NOT EXISTS monthly_saved_hours NUMERIC;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS efficiency_ratio NUMERIC;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS demo_link TEXT DEFAULT '';
ALTER TABLE cases ADD COLUMN IF NOT EXISTS other_values TEXT[] DEFAULT '{}';

-- 2. 创建 case_developers junction table
CREATE TABLE IF NOT EXISTS case_developers (
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (case_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_case_developers_case_id ON case_developers(case_id);
CREATE INDEX IF NOT EXISTS idx_case_developers_user_id ON case_developers(user_id);

-- 3. 给已有案例填充 developers（默认 = author_id）
INSERT INTO case_developers (case_id, user_id)
SELECT id, author_id FROM cases
ON CONFLICT DO NOTHING;
