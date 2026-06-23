-- ============================================
-- HRAS AI岛 数据库 Schema（完整版）
-- 基于 PRD v1.1
-- ============================================
-- WARNING: DO NOT RUN THIS FILE IN PRODUCTION.
-- This file rebuilds the full schema and drops business tables such as users,
-- courses, apps, and cases. Use only for empty database bootstrap or controlled
-- rebuilds. Production changes must use numbered incremental migrations.

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 清理旧表（如果存在）
-- 按依赖关系倒序删除
-- ============================================
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS user_point_events CASCADE;
DROP TABLE IF EXISTS bookmarks CASCADE;
DROP TABLE IF EXISTS dislikes CASCADE;
DROP TABLE IF EXISTS likes CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS answers CASCADE;
DROP TABLE IF EXISTS topics CASCADE;
DROP TABLE IF EXISTS learning_records CASCADE;
DROP TABLE IF EXISTS course_chapters CASCADE;
DROP TABLE IF EXISTS courses CASCADE;
DROP TABLE IF EXISTS apps CASCADE;
DROP TABLE IF EXISTS cases CASCADE;
DROP TABLE IF EXISTS event_submissions CASCADE;
DROP TABLE IF EXISTS event_registrations CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS increment_view_count(TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS increment_count(TEXT, UUID, TEXT, INTEGER) CASCADE;

-- ============================================
-- 1. 用户表
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feishu_open_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar TEXT DEFAULT '',
  department TEXT DEFAULT '',
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'contributor', 'moderator', 'admin')),
  bio TEXT DEFAULT '',
  points INTEGER DEFAULT 0,
  level TEXT DEFAULT '灵识初启' CHECK (level IN ('灵识初启', '问道学徒', '算法筑基', '智核结丹', '万象化神', '天机掌门')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_feishu_open_id ON users(feishu_open_id);
CREATE INDEX idx_users_role ON users(role);

-- ============================================
-- 2. 活动表（AI 大赛）— 必须在 cases 之前
-- ============================================
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  cover_image TEXT DEFAULT '',
  rules TEXT DEFAULT '',
  prizes TEXT DEFAULT '',
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  registration_deadline TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'ongoing', 'ended')),
  registration_count INTEGER DEFAULT 0,
  max_participants INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_status ON events(status);

-- ============================================
-- 3. 活动报名表
-- ============================================
CREATE TABLE event_registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

CREATE INDEX idx_event_registrations_event_id ON event_registrations(event_id);
CREATE INDEX idx_event_registrations_user_id ON event_registrations(user_id);

-- ============================================
-- 4. 活动作品表
-- ============================================
CREATE TABLE event_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  file_url TEXT DEFAULT '',
  score NUMERIC(5,2),
  rank INTEGER,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_event_submissions_event_id ON event_submissions(event_id);
CREATE INDEX idx_event_submissions_user_id ON event_submissions(user_id);

-- ============================================
-- 5. 案例表
-- ============================================
CREATE TABLE cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  cover_image TEXT DEFAULT '',
  category TEXT NOT NULL CHECK (category IN ('招聘', '培训', '绩效', '薪酬', '员工关系', '组织发展')),
  ai_tools TEXT[] DEFAULT '{}',
  difficulty TEXT NOT NULL CHECK (difficulty IN ('入门', '基础', '进阶')),
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'published', 'rejected')),
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  bookmark_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cases_author_id ON cases(author_id);
CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_cases_category ON cases(category);
CREATE INDEX idx_cases_created_at ON cases(created_at DESC);
CREATE INDEX idx_cases_event_id ON cases(event_id);

-- ============================================
-- 6. 应用推荐表
-- ============================================
CREATE TABLE apps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  logo TEXT DEFAULT '',
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('对话类', '写作类', '设计类', '数据分析', '自动化', 'HR专属')),
  scenarios TEXT[] DEFAULT '{}',
  official_url TEXT DEFAULT '',
  rating NUMERIC(3,1) DEFAULT 0,
  user_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  dislike_count INTEGER DEFAULT 0,
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_apps_category ON apps(category);
CREATE INDEX idx_apps_status ON apps(status);

-- ============================================
-- 7. 课程表
-- ============================================
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  cover_image TEXT DEFAULT '',
  instructor TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('AI工具基础', 'HR场景实操', 'AI工具进阶')),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('入门', '基础', '进阶')),
  duration TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('video', 'doc')),
  student_count INTEGER DEFAULT 0,
  rating NUMERIC(3,1) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_courses_category ON courses(category);
CREATE INDEX idx_courses_difficulty ON courses(difficulty);

-- ============================================
-- 8. 课程章节表
-- ============================================
CREATE TABLE course_chapters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_url TEXT DEFAULT '',
  duration TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_course_chapters_course_id ON course_chapters(course_id);

-- ============================================
-- 9. 学习记录表
-- ============================================
CREATE TABLE learning_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES course_chapters(id) ON DELETE CASCADE,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, chapter_id)
);

CREATE INDEX idx_learning_records_user_id ON learning_records(user_id);
CREATE INDEX idx_learning_records_course_id ON learning_records(course_id);

-- ============================================
-- 10. 话题表
-- ============================================
CREATE TABLE topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  view_count INTEGER DEFAULT 0,
  answer_count INTEGER DEFAULT 0,
  has_accepted_answer BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_topics_author_id ON topics(author_id);
CREATE INDEX idx_topics_created_at ON topics(created_at DESC);
CREATE INDEX idx_topics_tags ON topics USING GIN(tags);

-- ============================================
-- 11. 回答表
-- ============================================
CREATE TABLE answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote_count INTEGER DEFAULT 0,
  is_accepted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_answers_topic_id ON answers(topic_id);
CREATE INDEX idx_answers_author_id ON answers(author_id);

-- ============================================
-- 12. 评论表（通用）
-- ============================================
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_type TEXT NOT NULL CHECK (target_type IN ('case', 'course', 'answer', 'app')),
  target_id UUID NOT NULL,
  content TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comments_target ON comments(target_type, target_id);
CREATE INDEX idx_comments_author_id ON comments(author_id);
CREATE INDEX idx_comments_parent_id ON comments(parent_id);

-- ============================================
-- 13. 点赞表（通用）
-- ============================================
CREATE TABLE likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('case', 'course', 'answer', 'app', 'comment')),
  target_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, target_type, target_id)
);

CREATE INDEX idx_likes_target ON likes(target_type, target_id);
CREATE INDEX idx_likes_user_id ON likes(user_id);

-- ============================================
-- 14. 点踩表（应用专用）
-- ============================================
CREATE TABLE dislikes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('app')),
  target_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, target_type, target_id)
);

CREATE INDEX idx_dislikes_target ON dislikes(target_type, target_id);

-- ============================================
-- 15. 收藏表（通用）
-- ============================================
CREATE TABLE bookmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('case', 'course', 'topic', 'app')),
  target_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, target_type, target_id)
);

CREATE INDEX idx_bookmarks_target ON bookmarks(target_type, target_id);
CREATE INDEX idx_bookmarks_user_id ON bookmarks(user_id);

-- ============================================
-- 16. 通知表
-- ============================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('comment', 'like', 'answer', 'event', 'system')),
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  target_type TEXT,
  target_id UUID,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(user_id, is_read);

-- ============================================
-- 17. 用户积分事件表
-- ============================================
CREATE TABLE user_point_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  points INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, source_type, source_id, reason)
);

CREATE INDEX idx_user_point_events_user_id ON user_point_events(user_id);
CREATE INDEX idx_user_point_events_source ON user_point_events(source_type, source_id);

-- ============================================
-- RLS 策略（Row Level Security）
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE dislikes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_point_events ENABLE ROW LEVEL SECURITY;

-- 用户：所有人可读，本人可改
CREATE POLICY "Users are viewable by everyone" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- 案例：所有人可读已发布，作者可增改
CREATE POLICY "Published cases are viewable by everyone" ON cases FOR SELECT USING (status = 'published' OR author_id = auth.uid());
CREATE POLICY "Users can create cases" ON cases FOR INSERT WITH CHECK (author_id = auth.uid());
CREATE POLICY "Authors can update own cases" ON cases FOR UPDATE USING (author_id = auth.uid());

-- 应用：所有人可读已发布，作者可增改
CREATE POLICY "Published apps are viewable by everyone" ON apps FOR SELECT USING (status = 'published' OR author_id = auth.uid());
CREATE POLICY "Users can create apps" ON apps FOR INSERT WITH CHECK (author_id = auth.uid());
CREATE POLICY "Authors can update own apps" ON apps FOR UPDATE USING (author_id = auth.uid());

-- 课程：所有人可读
CREATE POLICY "Courses are viewable by everyone" ON courses FOR SELECT USING (true);
CREATE POLICY "Course chapters are viewable by everyone" ON course_chapters FOR SELECT USING (true);

-- 话题：所有人可读，作者可增改
CREATE POLICY "Topics are viewable by everyone" ON topics FOR SELECT USING (true);
CREATE POLICY "Users can create topics" ON topics FOR INSERT WITH CHECK (author_id = auth.uid());
CREATE POLICY "Authors can update own topics" ON topics FOR UPDATE USING (author_id = auth.uid());

-- 回答：所有人可读，作者可增改
CREATE POLICY "Answers are viewable by everyone" ON answers FOR SELECT USING (true);
CREATE POLICY "Users can create answers" ON answers FOR INSERT WITH CHECK (author_id = auth.uid());
CREATE POLICY "Authors can update own answers" ON answers FOR UPDATE USING (author_id = auth.uid());

-- 评论：所有人可读，作者可增改
CREATE POLICY "Comments are viewable by everyone" ON comments FOR SELECT USING (true);
CREATE POLICY "Users can create comments" ON comments FOR INSERT WITH CHECK (author_id = auth.uid());
CREATE POLICY "Authors can update own comments" ON comments FOR UPDATE USING (author_id = auth.uid());

-- 点赞/点踩/收藏：所有人可读，本人可增删
CREATE POLICY "Likes are viewable by everyone" ON likes FOR SELECT USING (true);
CREATE POLICY "Users can manage own likes" ON likes FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Dislikes are viewable by everyone" ON dislikes FOR SELECT USING (true);
CREATE POLICY "Users can manage own dislikes" ON dislikes FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Bookmarks are viewable by everyone" ON bookmarks FOR SELECT USING (true);
CREATE POLICY "Users can manage own bookmarks" ON bookmarks FOR ALL USING (user_id = auth.uid());

-- 通知：本人可读
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (user_id = auth.uid());

-- 积分事件：本人可读，service role 写入
CREATE POLICY "Users can read own point events" ON user_point_events FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Service role can manage point events" ON user_point_events FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- 自动更新 updated_at 触发器
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cases_updated_at BEFORE UPDATE ON cases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_apps_updated_at BEFORE UPDATE ON apps FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON courses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_topics_updated_at BEFORE UPDATE ON topics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_answers_updated_at BEFORE UPDATE ON answers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_point_events_updated_at BEFORE UPDATE ON user_point_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- ============================================
-- 数据库函数
-- ============================================

-- 增加浏览量
CREATE OR REPLACE FUNCTION increment_view_count(table_name TEXT, row_id UUID)
RETURNS VOID AS $$
BEGIN
  EXECUTE format('UPDATE %I SET view_count = view_count + 1 WHERE id = %L', table_name, row_id);
END;
$$ LANGUAGE plpgsql;

-- 增加计数字段
CREATE OR REPLACE FUNCTION increment_count(table_name TEXT, row_id UUID, column_name TEXT, increment_by INTEGER DEFAULT 1)
RETURNS VOID AS $$
BEGIN
  EXECUTE format('UPDATE %I SET %I = %I + %L WHERE id = %L', table_name, column_name, column_name, increment_by, row_id);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 005: 课程交互字段迁移
-- ============================================

-- Add interaction count columns to courses + content to chapters

-- 1. Add count columns to courses (matching cases table pattern)
ALTER TABLE courses ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS bookmark_count INTEGER DEFAULT 0;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0;

-- 2. Add content column to course_chapters for text/HTML content
ALTER TABLE course_chapters ADD COLUMN IF NOT EXISTS content TEXT DEFAULT '';

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_courses_like_count ON courses(like_count DESC);
