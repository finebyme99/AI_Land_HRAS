-- 011_review_add_proposal_fields.sql
-- 评审记录新增方案编号和方案名称字段

ALTER TABLE competition_reviews ADD COLUMN proposal_no INTEGER;
ALTER TABLE competition_reviews ADD COLUMN title TEXT DEFAULT '';
