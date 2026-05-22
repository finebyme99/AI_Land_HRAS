-- Add interaction count columns to courses + content to chapters

-- 1. Add count columns to courses (matching cases table pattern)
ALTER TABLE courses ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS bookmark_count INTEGER DEFAULT 0;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0;

-- 2. Add content column to course_chapters for text/HTML content
ALTER TABLE course_chapters ADD COLUMN IF NOT EXISTS content TEXT DEFAULT '';

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_courses_like_count ON courses(like_count DESC);
