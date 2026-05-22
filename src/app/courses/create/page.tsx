'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Form, Input, Select, App } from 'antd';
import { ArrowLeftOutlined, ReadOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { COURSE_CATEGORY_OPTIONS, DIFFICULTY_OPTIONS, CONTENT_TYPE_OPTIONS } from '@/lib/constants';
import type { ContentType } from '@/types';

interface ChapterForm {
  title: string;
  duration: string;
  content_url: string;
  content: string;
}

export default function CreateCoursePage() {
  const { isAdmin } = useAuth();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [chapters, setChapters] = useState<ChapterForm[]>([]);
  const [contentType, setContentType] = useState<ContentType>('video');
  const [submitting, setSubmitting] = useState(false);

  if (!isAdmin) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="glass rounded-2xl p-8 text-center" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
          <ReadOutlined className="text-3xl mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-base mb-4" style={{ color: 'var(--text-secondary)' }}>
            课程由管理员统一发布
          </p>
          <Link href="/courses" className="text-sm transition-opacity hover:opacity-70" style={{ color: 'var(--primary)' }}>
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
    setSubmitting(true);
    try {
      const { data: course, error: courseError } = await getSupabase()
        .from('courses')
        .insert({
          title: values.title as string,
          description: values.description as string,
          instructor: values.instructor as string,
          duration: values.duration as string,
          category: values.category as string,
          difficulty: values.difficulty as string,
          content_type: contentType,
          cover_image: (values.cover_image as string) || '',
        })
        .select()
        .single();

      if (courseError) throw courseError;

      if (chapters.length > 0 && course) {
        const chaptersData = chapters.map((ch, idx) => ({
          course_id: course.id,
          title: ch.title,
          duration: ch.duration,
          content_url: contentType === 'video' ? ch.content_url : '',
          content: contentType === 'doc' ? ch.content : '',
          sort_order: idx + 1,
        }));

        const { error: chaptersError } = await getSupabase()
          .from('course_chapters')
          .insert(chaptersData);

        if (chaptersError) throw chaptersError;
      }

      message.success('课程发布成功！');
      window.location.href = '/courses';
    } catch {
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
        发布新课程
      </h1>

      <div className="glass rounded-2xl p-6 sm:p-8" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="title" label="课程标题" rules={[{ required: true, message: '请输入课程标题' }]}>
            <Input placeholder="输入课程标题" maxLength={100} showCount />
          </Form.Item>

          <Form.Item name="description" label="课程描述" rules={[{ required: true, message: '请输入课程描述' }]}>
            <Input.TextArea rows={3} placeholder="简要描述课程内容和目标" maxLength={500} showCount />
          </Form.Item>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Form.Item name="instructor" label="讲师" rules={[{ required: true, message: '请输入讲师名称' }]}>
              <Input placeholder="讲师名称" />
            </Form.Item>
            <Form.Item name="duration" label="课程时长" rules={[{ required: true, message: '请输入课程时长' }]}>
              <Input placeholder="如：2小时30分" />
            </Form.Item>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Form.Item name="category" label="分类" rules={[{ required: true, message: '请选择分类' }]}>
              <Select placeholder="选择分类" options={COURSE_CATEGORY_OPTIONS} />
            </Form.Item>
            <Form.Item name="difficulty" label="难度" rules={[{ required: true, message: '请选择难度' }]}>
              <Select placeholder="选择难度" options={DIFFICULTY_OPTIONS} />
            </Form.Item>
            <Form.Item name="content_type" label="内容形式">
              <Select
                placeholder="选择形式"
                options={CONTENT_TYPE_OPTIONS}
                defaultValue="video"
                onChange={(v: ContentType) => setContentType(v)}
              />
            </Form.Item>
          </div>

          <Form.Item name="cover_image" label="封面图 URL">
            <Input placeholder="输入封面图片地址（可选）" />
          </Form.Item>

          {/* Chapter Editor */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                章节内容
              </span>
              <button
                type="button"
                onClick={addChapter}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                style={{ background: 'rgba(74, 111, 165, 0.08)', color: '#4a6fa5' }}
              >
                <PlusOutlined /> 添加章节
              </button>
            </div>

            {chapters.length === 0 && (
              <div className="text-center py-8 rounded-xl" style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}>
                <p className="text-sm">暂无章节，点击上方按钮添加</p>
              </div>
            )}

            {chapters.map((chapter, index) => (
              <div
                key={index}
                className="mb-3 p-4 rounded-xl"
                style={{ background: 'var(--surface)', border: '1px solid var(--border-light)' }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    章节 {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeChapter(index)}
                    className="text-xs transition-opacity hover:opacity-70"
                    style={{ color: '#ef4444' }}
                  >
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
                    placeholder="时长，如：30分钟"
                    value={chapter.duration}
                    onChange={(e) => updateChapter(index, 'duration', e.target.value)}
                  />
                </div>

                {contentType === 'video' ? (
                  <Input
                    placeholder="视频链接"
                    value={chapter.content_url}
                    onChange={(e) => updateChapter(index, 'content_url', e.target.value)}
                  />
                ) : (
                  <Input.TextArea
                    rows={3}
                    placeholder="文档内容"
                    value={chapter.content}
                    onChange={(e) => updateChapter(index, 'content', e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>

          <Form.Item>
            <button
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90"
              style={{ background: 'var(--primary)' }}
              type="submit"
              disabled={submitting}
            >
              {submitting ? '发布中...' : '发布课程'}
            </button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
}
