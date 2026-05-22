# Course Module: Admin Creation + Interaction + Chapter Content

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three missing features to the course module: admin course creation form, like/bookmark/comment interactions on detail page, and chapter content display.

**Architecture:** Follow the existing case module patterns exactly — same Supabase table patterns (`likes`/`bookmarks`/`comments` with `target_type`), same Glassmorphism UI style, same admin-only gates. A new migration adds count columns to `courses` and a `content` column to `course_chapters`.

**Tech Stack:** Next.js 16, React 19, Ant Design 6, Supabase

---

## Files Overview

| Action | File | Purpose |
|--------|------|---------|
| Create | `supabase/migrations/005_course_interactions.sql` | Add count columns to courses + content to chapters |
| Modify | `src/types/index.ts` | Add counts to Course, add content to CourseChapter |
| Modify | `src/app/courses/[id]/page.tsx` | Add like/bookmark/comment + chapter content viewer |
| Create | `src/app/courses/create/page.tsx` | Admin course creation form with chapter editor |

---

### Task 1: Database Migration — Add Count Columns + Chapter Content

**Files:**
- Create: `supabase/migrations/005_course_interactions.sql`

The `courses` table needs `like_count`, `bookmark_count`, `comment_count` columns (matching the `cases` table pattern). The `course_chapters` table needs a `content` TEXT column for storing chapter text/HTML content directly.

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/005_course_interactions.sql
-- Add interaction count columns to courses + content to chapters

-- 1. Add count columns to courses (matching cases table pattern)
ALTER TABLE courses ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS bookmark_count INTEGER DEFAULT 0;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0;

-- 2. Add content column to course_chapters for text/HTML content
ALTER TABLE course_chapters ADD COLUMN IF NOT EXISTS content TEXT DEFAULT '';

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_courses_like_count ON courses(like_count DESC);
```

- [ ] **Step 2: Update the combined full_migration.sql**

Read `supabase/migrations/full_migration.sql` and append the same ALTER statements at the end to keep it in sync.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/005_course_interactions.sql
git commit -m "feat: add interaction count columns to courses + content to chapters"
```

---

### Task 2: Update TypeScript Types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add count fields to Course interface**

Add `like_count`, `bookmark_count`, `comment_count` to the `Course` interface (after `rating`):

```typescript
export interface Course {
  id: string;
  title: string;
  description: string;
  cover_image: string;
  instructor: string;
  category: CourseCategory;
  difficulty: CourseDifficulty;
  duration: string;
  content_type: ContentType;
  chapters: CourseChapter[];
  student_count: number;
  rating: number;
  like_count: number;        // NEW
  bookmark_count: number;    // NEW
  comment_count: number;     // NEW
  is_featured?: boolean;
  created_at: string;
}
```

- [ ] **Step 2: Add content field to CourseChapter interface**

```typescript
export interface CourseChapter {
  id: string;
  title: string;
  content_url: string;
  content: string;       // NEW — text/HTML content for doc courses
  duration: string;
  sort_order: number;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add interaction counts to Course type + content to CourseChapter"
```

---

### Task 3: Admin Course Creation Page

**Files:**
- Create: `src/app/courses/create/page.tsx`

Follow the case create page pattern: admin-only gate, form with main fields + dynamic chapter list editor. Chapters can be added/removed, each with title, duration, content_url (for video), and content (for doc).

- [ ] **Step 1: Create the page file**

```tsx
// src/app/courses/create/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Form, Input, Select, App } from 'antd';
import { ArrowLeftOutlined, ReadOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { COURSE_CATEGORY_OPTIONS, DIFFICULTY_OPTIONS, CONTENT_TYPE_OPTIONS } from '@/lib/constants';

interface ChapterForm {
  title: string;
  duration: string;
  content_url: string;
  content: string;
}

export default function CreateCoursePage() {
  const { user, isAdmin } = useAuth();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [chapters, setChapters] = useState<ChapterForm[]>([]);
  const [contentType, setContentType] = useState<'video' | 'doc'>('doc');

  if (!isAdmin) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="glass rounded-2xl p-8 text-center" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
          <ReadOutlined className="text-3xl mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="mb-4" style={{ color: 'var(--text-secondary)' }}>课程由管理员统一发布</p>
          <Link href="/courses" className="text-sm font-medium" style={{ color: 'var(--primary)' }}>
            返回课程列表
          </Link>
        </div>
      </div>
    );
  }

  const addChapter = () => {
    setChapters([...chapters, { title: '', duration: '', content_url: '', content: '' }]);
  };

  const removeChapter = (index: number) => {
    setChapters(chapters.filter((_, i) => i !== index));
  };

  const updateChapter = (index: number, field: keyof ChapterForm, value: string) => {
    const updated = [...chapters];
    updated[index] = { ...updated[index], [field]: value };
    setChapters(updated);
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (!user) return;
    setSubmitting(true);
    try {
      // Insert course
      const { data: courseData, error: courseError } = await getSupabase()
        .from('courses')
        .insert({
          title: values.title as string,
          description: values.description as string,
          instructor: values.instructor as string,
          category: values.category as string,
          difficulty: values.difficulty as string,
          duration: values.duration as string,
          content_type: contentType,
          cover_image: (values.cover_image as string) || '',
        })
        .select('id')
        .single();
      if (courseError) throw courseError;

      // Insert chapters if any
      if (chapters.length > 0 && courseData) {
        const chapterRows = chapters
          .filter((ch) => ch.title.trim())
          .map((ch, i) => ({
            course_id: courseData.id,
            title: ch.title,
            duration: ch.duration || '',
            content_url: ch.content_url || '',
            content: ch.content || '',
            sort_order: i + 1,
          }));
        if (chapterRows.length > 0) {
          const { error: chapterError } = await getSupabase()
            .from('course_chapters')
            .insert(chapterRows);
          if (chapterError) throw chapterError;
        }
      }

      message.success('课程发布成功！');
      window.location.href = '/courses';
    } catch (err) {
      console.error('Failed to create course:', err);
      message.error('发布失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <Link href="/courses" className="inline-flex items-center gap-1.5 text-sm mb-6 transition-opacity hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
        <ArrowLeftOutlined /> 返回课程列表
      </Link>

      <h1 className="text-2xl font-semibold flex items-center gap-3 mb-6">
        <span className="w-9 h-9 rounded-lg flex items-center justify-center text-base" style={{ background: 'rgba(74, 111, 165, 0.08)', color: '#4a6fa5' }}>
          <ReadOutlined />
        </span>
        发布课程
      </h1>

      <div className="glass rounded-2xl p-6 sm:p-8" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ difficulty: '基础', content_type: 'doc' }}>
          <Form.Item name="title" label="课程标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="课程标题" maxLength={100} showCount />
          </Form.Item>

          <Form.Item name="description" label="课程简介" rules={[{ required: true, message: '请输入简介' }]}>
            <Input.TextArea rows={3} placeholder="简要描述课程内容和学习目标" maxLength={500} showCount />
          </Form.Item>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Form.Item name="instructor" label="讲师" rules={[{ required: true, message: '请输入讲师姓名' }]}>
              <Input placeholder="讲师姓名" />
            </Form.Item>
            <Form.Item name="duration" label="课程时长" rules={[{ required: true, message: '请输入时长' }]}>
              <Input placeholder="如：2小时、30分钟" />
            </Form.Item>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Form.Item name="category" label="分类" rules={[{ required: true, message: '请选择分类' }]}>
              <Select options={COURSE_CATEGORY_OPTIONS} />
            </Form.Item>
            <Form.Item name="difficulty" label="难度" rules={[{ required: true }]}>
              <Select options={DIFFICULTY_OPTIONS} />
            </Form.Item>
            <Form.Item label="内容形式" required>
              <Select
                value={contentType}
                onChange={(v) => setContentType(v)}
                options={CONTENT_TYPE_OPTIONS}
              />
            </Form.Item>
          </div>

          <Form.Item name="cover_image" label="封面图 URL">
            <Input placeholder="可选，输入封面图片链接" />
          </Form.Item>

          {/* Chapter Editor */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">课程章节</span>
              <button
                type="button"
                onClick={addChapter}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                style={{ color: 'var(--primary)', background: 'rgba(26, 58, 138, 0.06)' }}>
                <PlusOutlined /> 添加章节
              </button>
            </div>

            {chapters.length === 0 ? (
              <p className="text-sm py-4 text-center rounded-lg" style={{ color: 'var(--text-muted)', background: 'rgba(255,255,255,0.3)' }}>
                暂无章节，点击上方按钮添加
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {chapters.map((chapter, index) => (
                  <div key={index} className="p-4 rounded-lg" style={{ border: '1px solid var(--border-light)', background: 'rgba(255,255,255,0.3)' }}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>第 {index + 1} 章</span>
                      <button
                        type="button"
                        onClick={() => removeChapter(index)}
                        className="text-xs flex items-center gap-1 transition-opacity hover:opacity-70"
                        style={{ color: '#ef4444' }}>
                        <DeleteOutlined /> 删除
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                      <Input
                        placeholder="章节标题"
                        value={chapter.title}
                        onChange={(e) => updateChapter(index, 'title', e.target.value)}
                      />
                      <Input
                        placeholder="时长（如 15分钟）"
                        value={chapter.duration}
                        onChange={(e) => updateChapter(index, 'duration', e.target.value)}
                      />
                    </div>
                    {contentType === 'video' ? (
                      <Input
                        placeholder="视频链接（B站/YouTube/飞书视频等）"
                        value={chapter.content_url}
                        onChange={(e) => updateChapter(index, 'content_url', e.target.value)}
                      />
                    ) : (
                      <Input.TextArea
                        rows={4}
                        placeholder="章节内容（支持 HTML）"
                        value={chapter.content}
                        onChange={(e) => updateChapter(index, 'content', e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <Form.Item>
            <button
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              style={{ background: 'var(--primary)' }}
              type="submit"
              disabled={submitting}>
              <PlusOutlined /> {submitting ? '发布中...' : '发布课程'}
            </button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the page loads**

Run `npm run build` to check for TypeScript/import errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/courses/create/page.tsx
git commit -m "feat: admin course creation form with chapter editor"
```

---

### Task 4: Add Like/Bookmark/Comment to Course Detail Page

**Files:**
- Modify: `src/app/courses/[id]/page.tsx`

Port the like/bookmark/comment pattern from `src/app/cases/[id]/page.tsx` to the course detail page. Same Supabase tables (`likes`, `bookmarks`, `comments`) with `target_type='course'`.

- [ ] **Step 1: Add state variables and user import**

In `src/app/courses/[id]/page.tsx`, change the auth import and add state:

```tsx
// Change this line:
const { isAdmin } = useAuth();
// To:
const { user, isAdmin } = useAuth();

// Add these state variables after the existing ones:
const [commentText, setCommentText] = useState('');
const [submittingComment, setSubmittingComment] = useState(false);
const [comments, setComments] = useState<{ id: string; content: string; author: { name: string; avatar: string }; created_at: string }[]>([]);
const [liked, setLiked] = useState(false);
const [bookmarked, setBookmarked] = useState(false);
```

- [ ] **Step 2: Add imports**

Add to the existing import block:

```tsx
import {
  LikeOutlined,
  StarOutlined,
  ShareAltOutlined,
  // ... keep existing icon imports
} from '@ant-design/icons';
```

Also import `Avatar` and `Input` from antd:

```tsx
import { Tag, Spin, App, Avatar, Input } from 'antd';
```

- [ ] **Step 3: Add fetch logic for likes/bookmarks/comments**

Inside the `useEffect`, after the course fetch succeeds (after `setCourse(data as Course)`), add:

```tsx
// Increment view count
getSupabase().rpc('increment_view_count', { table_name: 'courses', row_id: id });

// Fetch comments
const { data: commentData } = await getSupabase()
  .from('comments')
  .select('*, author:users!author_id(id, name, avatar)')
  .eq('target_type', 'course')
  .eq('target_id', id)
  .order('created_at', { ascending: false });
setComments((commentData ?? []) as typeof comments);

// Check if current user liked/bookmarked
if (user) {
  const { data: likeData } = await getSupabase()
    .from('likes')
    .select('id')
    .eq('user_id', user.id)
    .eq('target_type', 'course')
    .eq('target_id', id)
    .maybeSingle();
  setLiked(!!likeData);

  const { data: bookmarkData } = await getSupabase()
    .from('bookmarks')
    .select('id')
    .eq('user_id', user.id)
    .eq('target_type', 'course')
    .eq('target_id', id)
    .maybeSingle();
  setBookmarked(!!bookmarkData);
}
```

Also update the useEffect dependency array: `[id, user]`

- [ ] **Step 4: Add handler functions**

Add these functions after `handleToggleFeatured`:

```tsx
const handleLike = async () => {
  if (!course) return;
  if (!user) { message.warning('请先登录'); return; }

  if (liked) {
    setLiked(false);
    setCourse({ ...course, like_count: course.like_count - 1 });
    await getSupabase().from('likes').delete().eq('user_id', user.id).eq('target_type', 'course').eq('target_id', id);
    await getSupabase().from('courses').update({ like_count: course.like_count - 1 }).eq('id', id);
    message.success('已取消点赞');
  } else {
    setLiked(true);
    setCourse({ ...course, like_count: course.like_count + 1 });
    await getSupabase().from('likes').insert({ user_id: user.id, target_type: 'course', target_id: id });
    await getSupabase().from('courses').update({ like_count: course.like_count + 1 }).eq('id', id);
    message.success('点赞成功');
  }
};

const handleBookmark = async () => {
  if (!course) return;
  if (!user) { message.warning('请先登录'); return; }

  if (bookmarked) {
    setBookmarked(false);
    setCourse({ ...course, bookmark_count: course.bookmark_count - 1 });
    await getSupabase().from('bookmarks').delete().eq('user_id', user.id).eq('target_type', 'course').eq('target_id', id);
    await getSupabase().from('courses').update({ bookmark_count: course.bookmark_count - 1 }).eq('id', id);
    message.success('已取消收藏');
  } else {
    setBookmarked(true);
    setCourse({ ...course, bookmark_count: course.bookmark_count + 1 });
    await getSupabase().from('bookmarks').insert({ user_id: user.id, target_type: 'course', target_id: id });
    await getSupabase().from('courses').update({ bookmark_count: course.bookmark_count + 1 }).eq('id', id);
    message.success('收藏成功');
  }
};

const handleShare = () => {
  navigator.clipboard.writeText(window.location.href);
  message.success('链接已复制');
};

const handleComment = async () => {
  if (!commentText.trim()) return;
  if (!user) { message.warning('请先登录'); return; }
  setSubmittingComment(true);
  try {
    const { error } = await getSupabase().from('comments').insert({
      target_type: 'course',
      target_id: id,
      content: commentText.trim(),
      author_id: user.id,
    });
    if (error) throw error;
    setCommentText('');
    message.success('评论已提交');
    const { data: commentData } = await getSupabase()
      .from('comments')
      .select('*, author:users!author_id(id, name, avatar)')
      .eq('target_type', 'course')
      .eq('target_id', id)
      .order('created_at', { ascending: false });
    setComments((commentData ?? []) as typeof comments);
    if (course) {
      const newCount = course.comment_count + 1;
      setCourse({ ...course, comment_count: newCount });
      await getSupabase().from('courses').update({ comment_count: newCount }).eq('id', id);
    }
  } catch {
    message.error('评论提交失败，请重试');
  } finally {
    setSubmittingComment(false);
  }
};
```

- [ ] **Step 5: Add action buttons and comments UI**

After the "开始学习" button section, add the action bar and comments section (matching the case detail page pattern). Insert this before the closing `</div>` of the main container:

```tsx
{/* Action buttons */}
<div className="glass rounded-2xl p-6 sm:p-8 mt-6" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
  <div className="flex items-center gap-3 mb-6">
    <button onClick={handleLike}
      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all hover:-translate-y-0.5"
      style={{ color: liked ? 'var(--primary)' : 'var(--text-secondary)', border: '1px solid rgba(255, 255, 255, 0.6)', background: liked ? 'rgba(26, 58, 138, 0.06)' : 'var(--surface)' }}>
      <LikeOutlined /> 点赞 ({course.like_count})
    </button>
    <button onClick={handleBookmark}
      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all hover:-translate-y-0.5"
      style={{ color: bookmarked ? 'var(--primary)' : 'var(--text-secondary)', border: '1px solid rgba(255, 255, 255, 0.6)', background: bookmarked ? 'rgba(26, 58, 138, 0.06)' : 'var(--surface)' }}>
      <StarOutlined /> 收藏 ({course.bookmark_count})
    </button>
    <button onClick={handleShare}
      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all hover:-translate-y-0.5"
      style={{ color: 'var(--text-secondary)', border: '1px solid rgba(255, 255, 255, 0.6)', background: 'var(--surface)' }}>
      <ShareAltOutlined /> 分享
    </button>
  </div>

  {/* Comments */}
  <h2 className="text-lg font-semibold mb-5">评论 ({comments.length})</h2>

  {user ? (
    <>
      <Input.TextArea
        rows={3}
        placeholder="写下你的评论..."
        value={commentText}
        onChange={(e) => setCommentText(e.target.value)}
        maxLength={1000}
        showCount
      />
      <div className="flex justify-end mt-3">
        <button className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
          style={{ background: 'var(--primary)' }}
          onClick={handleComment}
          disabled={submittingComment || !commentText.trim()}>
          {submittingComment ? '提交中...' : '发表评论'}
        </button>
      </div>
    </>
  ) : (
    <div className="text-center py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
      登录后即可评论
    </div>
  )}

  {comments.length === 0 ? (
    <div className="mt-5 pt-5 text-center" style={{ borderTop: '1px solid var(--border-light)', color: 'var(--text-muted)' }}>
      <p className="text-sm">暂无评论</p>
    </div>
  ) : (
    <div className="mt-5 pt-5 flex flex-col gap-4" style={{ borderTop: '1px solid var(--border-light)' }}>
      {comments.map((c) => (
        <div key={c.id} className="flex gap-3">
          <Avatar size="small" src={c.author.avatar} icon={<UserOutlined />} />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium">{c.author.name}</span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {new Date(c.created_at).toLocaleDateString('zh-CN')}
              </span>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{c.content}</p>
          </div>
        </div>
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 6: Verify build**

Run `npm run build` to check for TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/courses/[id]/page.tsx
git commit -m "feat: add like/bookmark/comment to course detail page"
```

---

### Task 5: Chapter Content Display

**Files:**
- Modify: `src/app/courses/[id]/page.tsx`

Currently chapters only show title + duration. Add a click-to-expand behavior:
- For `video` content_type: show the video URL as a clickable link (or embed if it's a supported platform)
- For `doc` content_type: render the chapter's `content` field as HTML in an expandable section

- [ ] **Step 1: Add selected chapter state**

Add state for tracking which chapter is expanded:

```tsx
const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
```

- [ ] **Step 2: Update chapter list items**

Replace the chapter map block (inside the chapters section) with clickable items that expand to show content:

```tsx
{chapters.map((chapter, index) => (
  <div key={chapter.id}>
    <div
      className="flex items-center gap-4 p-3 rounded-lg transition-all hover:-translate-y-0.5 cursor-pointer"
      style={{ border: '1px solid var(--border-light)', background: selectedChapter === chapter.id ? 'rgba(26, 58, 138, 0.04)' : 'var(--surface-warm)' }}
      onClick={() => setSelectedChapter(selectedChapter === chapter.id ? null : chapter.id)}
    >
      <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0"
        style={{ background: 'rgba(26, 58, 138, 0.1)', color: 'var(--primary)' }}>
        {index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{chapter.title}</div>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{chapter.duration}</div>
      </div>
      <span style={{ color: 'var(--text-muted)' }}>
        {course.content_type === 'video' ? <PlayCircleOutlined /> : <FileTextOutlined />}
      </span>
    </div>
    {selectedChapter === chapter.id && (
      <div className="mt-2 ml-11 mr-3 mb-2 p-4 rounded-lg text-sm leading-relaxed"
        style={{ background: 'rgba(255, 255, 255, 0.5)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}>
        {course.content_type === 'video' && chapter.content_url ? (
          <div>
            <p className="mb-2" style={{ color: 'var(--text-secondary)' }}>视频链接：</p>
            <a href={chapter.content_url} target="_blank" rel="noopener noreferrer"
              className="underline transition-opacity hover:opacity-70" style={{ color: 'var(--primary)' }}>
              {chapter.content_url}
            </a>
          </div>
        ) : chapter.content ? (
          <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: chapter.content }} />
        ) : (
          <p style={{ color: 'var(--text-muted)' }}>暂无内容</p>
        )}
      </div>
    )}
  </div>
))}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/courses/[id]/page.tsx
git commit -m "feat: chapter content display — expandable sections for video/doc"
```

---

### Task 6: Final Verification

- [ ] **Step 1: Run build**

```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 2: Push branch**

```bash
git push origin feat/course-module
```
