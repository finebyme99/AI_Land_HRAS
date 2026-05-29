-- 同步多维表格新增字段 + 用户评委名单
ALTER TABLE competition_submissions ADD COLUMN IF NOT EXISTS implementation TEXT;
ALTER TABLE competition_submissions ADD COLUMN IF NOT EXISTS new_operation_count NUMERIC;
ALTER TABLE competition_submissions ADD COLUMN IF NOT EXISTS old_operation_count NUMERIC;
ALTER TABLE competition_submissions ADD COLUMN IF NOT EXISTS team_type TEXT;
ALTER TABLE competition_submissions ADD COLUMN IF NOT EXISTS old_hours_per_task NUMERIC;
ALTER TABLE competition_submissions ADD COLUMN IF NOT EXISTS new_duration NUMERIC;
ALTER TABLE competition_submissions ADD COLUMN IF NOT EXISTS new_people_count INTEGER;
ALTER TABLE competition_submissions ADD COLUMN IF NOT EXISTS old_people_count INTEGER;
ALTER TABLE competition_submissions ADD COLUMN IF NOT EXISTS old_frequency TEXT;
ALTER TABLE competition_submissions ADD COLUMN IF NOT EXISTS new_frequency TEXT;
ALTER TABLE competition_submissions ADD COLUMN IF NOT EXISTS reviewers TEXT[];
