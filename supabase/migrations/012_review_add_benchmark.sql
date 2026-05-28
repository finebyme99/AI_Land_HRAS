-- 012_review_add_benchmark.sql
-- 评审记录新增「推荐为标杆案例」字段

ALTER TABLE competition_reviews ADD COLUMN is_benchmark BOOLEAN DEFAULT false;
