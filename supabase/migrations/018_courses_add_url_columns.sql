-- courses 表补充 courseware_url 和 video_url 列
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS courseware_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS video_url TEXT DEFAULT '';
