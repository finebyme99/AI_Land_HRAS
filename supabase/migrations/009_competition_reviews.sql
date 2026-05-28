-- 009_competition_reviews.sql
-- 新增 reviewer 角色 + 评审记录表

-- 1. 修改 users.role CHECK 约束，新增 'reviewer'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('user', 'contributor', 'moderator', 'reviewer', 'admin'));

-- 2. 创建 competition_reviews 表
CREATE TABLE competition_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id TEXT NOT NULL,           -- 飞书多维表格 record_id
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  reason TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(submission_id, reviewer_id)
);

CREATE INDEX idx_competition_reviews_submission ON competition_reviews(submission_id);
CREATE INDEX idx_competition_reviews_reviewer ON competition_reviews(reviewer_id);

-- 3. RLS
ALTER TABLE competition_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reviews readable by reviewers and admins" ON competition_reviews
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('reviewer', 'admin', 'moderator'))
  );

CREATE POLICY "Reviewers can insert own reviews" ON competition_reviews
  FOR INSERT WITH CHECK (
    reviewer_id = auth.uid() AND
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('reviewer', 'admin', 'moderator'))
  );

CREATE POLICY "Reviewers can update own reviews" ON competition_reviews
  FOR UPDATE USING (
    reviewer_id = auth.uid() AND
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('reviewer', 'admin', 'moderator'))
  );

-- 4. updated_at 触发器
CREATE TRIGGER update_competition_reviews_updated_at
  BEFORE UPDATE ON competition_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
