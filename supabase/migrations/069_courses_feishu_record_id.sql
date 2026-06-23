-- 069: Use Feishu bitable record id as the stable sync key for courses.
-- Keep courses.id as the database UUID primary key because interactions and
-- other internal references use it as an application object id.

ALTER TABLE courses ADD COLUMN IF NOT EXISTS feishu_record_id text;

CREATE UNIQUE INDEX IF NOT EXISTS courses_feishu_record_id_key
  ON courses(feishu_record_id)
  WHERE feishu_record_id IS NOT NULL;
