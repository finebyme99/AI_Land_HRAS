-- ============================================
-- 迁移 007：案例新增提报团队和业务场景字段
-- ============================================

-- 1. 给 cases 表添加 team 和 business_scenario 字段
ALTER TABLE cases ADD COLUMN IF NOT EXISTS team TEXT DEFAULT '';
ALTER TABLE cases ADD COLUMN IF NOT EXISTS business_scenario TEXT DEFAULT '';

-- 2. 创建索引（用于筛选）
CREATE INDEX IF NOT EXISTS idx_cases_team ON cases(team) WHERE team != '';
CREATE INDEX IF NOT EXISTS idx_cases_business_scenario ON cases(business_scenario) WHERE business_scenario != '';
