-- 068: Production course sync schema hotfix
-- Some production projects may still have the initial courses schema after
-- manual recovery. The current Feishu sync writes link fields, season/period,
-- JSONB content types, and sync metadata. Keep this migration idempotent.

ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_category_check;
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_content_type_check;
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_difficulty_check;

ALTER TABLE courses ALTER COLUMN category DROP NOT NULL;

DO $$
DECLARE
  content_type_data_type text;
BEGIN
  SELECT data_type
  INTO content_type_data_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'courses'
    AND column_name = 'content_type';

  IF content_type_data_type IS NOT NULL AND content_type_data_type <> 'jsonb' THEN
    UPDATE courses
    SET content_type = CASE
      WHEN content_type IS NULL OR content_type = '' THEN '[]'
      WHEN content_type LIKE '[%' THEN content_type
      ELSE '["' || replace(content_type, '"', '\"') || '"]'
    END;

    ALTER TABLE courses
      ALTER COLUMN content_type DROP NOT NULL,
      ALTER COLUMN content_type SET DATA TYPE jsonb USING content_type::jsonb,
      ALTER COLUMN content_type SET DEFAULT '[]'::jsonb;
  ELSIF content_type_data_type = 'jsonb' THEN
    ALTER TABLE courses
      ALTER COLUMN content_type DROP NOT NULL,
      ALTER COLUMN content_type SET DEFAULT '[]'::jsonb;
  END IF;
END $$;

ALTER TABLE courses ADD CONSTRAINT courses_difficulty_check
  CHECK (difficulty IN ('初阶', '进阶', '高阶'));

ALTER TABLE courses ADD COLUMN IF NOT EXISTS like_count integer DEFAULT 0;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS bookmark_count integer DEFAULT 0;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS comment_count integer DEFAULT 0;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS courseware_url text DEFAULT '';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS video_url text DEFAULT '';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS period text;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS season text;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS cover_image_key text;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS synced_at timestamptz;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_courses_like_count ON courses(like_count DESC);
CREATE INDEX IF NOT EXISTS idx_courses_period ON courses(period);
CREATE INDEX IF NOT EXISTS idx_courses_season ON courses(season);
