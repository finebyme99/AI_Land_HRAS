-- ============================================
-- 迁移 004：角色权限 + 精选字段 + 清除种子数据
-- ============================================

-- 1. 清除所有种子数据（保留表结构）
DELETE FROM learning_records;
DELETE FROM course_chapters;
DELETE FROM courses;
DELETE FROM event_submissions;
DELETE FROM event_registrations;
DELETE FROM events;
DELETE FROM comments;
DELETE FROM likes;
DELETE FROM dislikes;
DELETE FROM bookmarks;
DELETE FROM notifications;
DELETE FROM answers;
DELETE FROM topics;
DELETE FROM cases;
DELETE FROM apps;
DELETE FROM users;

-- 2. 修复 cases 表的 category CHECK 约束
ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_category_check;
ALTER TABLE cases ADD CONSTRAINT cases_category_check CHECK (category IN (
  'HRAS_人力数据看板',
  'HSSC_招聘',
  'HCOE/HSSC_薪酬绩效',
  'HCOE_培训',
  'HCOE/HSSC_组织与人才发展',
  'HCOE_文化氛围',
  'HSSC_核算与报账',
  'HSSC_基础人事支持',
  'ASSC_行政管理',
  '其他'
));

-- 3. 移除 cases 表的 difficulty 列（已不需要）
ALTER TABLE cases DROP COLUMN IF EXISTS difficulty;

-- 4. 给 cases 和 topics 添加 is_featured 字段
ALTER TABLE cases ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_cases_featured ON cases(is_featured) WHERE is_featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_topics_featured ON topics(is_featured) WHERE is_featured = TRUE;

-- 5. 给 courses 和 apps 也添加 is_featured
ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;
ALTER TABLE apps ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;

-- 6. 创建一个函数：通过 feishu_open_id 设置用户角色
CREATE OR REPLACE FUNCTION set_user_role(p_feishu_open_id TEXT, p_role TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE users SET role = p_role WHERE feishu_open_id = p_feishu_open_id;
END;
$$ LANGUAGE plpgsql;
