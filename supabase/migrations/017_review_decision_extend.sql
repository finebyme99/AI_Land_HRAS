-- 扩展 decision CHECK 约束，支持新的多维评分机制
ALTER TABLE competition_reviews DROP CONSTRAINT IF EXISTS competition_reviews_decision_check;
ALTER TABLE competition_reviews ADD CONSTRAINT competition_reviews_decision_check
  CHECK (decision IN ('approved', 'rejected', 'reviewed'));
