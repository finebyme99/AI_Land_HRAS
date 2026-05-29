-- 评审评分维度：多维评分替代二元通过/驳回
-- scores: {"scenario":1-5,"painPoint":1-5,"effectiveness":1-5,"replicability":1-5,"dataReliability":1-5,"breakthrough":1-5,"techUsability":1-5,"toolFit":1-5}
-- reviewer_role: user / business / tech（决定展示哪些维度）

ALTER TABLE competition_reviews ADD COLUMN IF NOT EXISTS scores JSONB DEFAULT '{}';
ALTER TABLE competition_reviews ADD COLUMN IF NOT EXISTS reviewer_role TEXT CHECK (reviewer_role IN ('user', 'business', 'tech'));
