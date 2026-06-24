-- 073: 场景大全列表同步落地进展计划字段
-- 仅补充 competition_submissions 快照字段，不触碰历史数据。

ALTER TABLE competition_submissions
  ADD COLUMN IF NOT EXISTS progress_record TEXT,
  ADD COLUMN IF NOT EXISTS planned_start_date TEXT,
  ADD COLUMN IF NOT EXISTS pilot_date TEXT,
  ADD COLUMN IF NOT EXISTS rollout_date TEXT,
  ADD COLUMN IF NOT EXISTS full_launch_date TEXT,
  ADD COLUMN IF NOT EXISTS biz_owner TEXT[],
  ADD COLUMN IF NOT EXISTS ai_owner TEXT[];
