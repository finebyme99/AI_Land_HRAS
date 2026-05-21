'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { Tag, Avatar, Input, Spin, App } from 'antd';
import {
  CheckCircleOutlined,
  CommentOutlined,
  ArrowLeftOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { getSupabase } from '@/lib/supabase';
import type { Topic, Answer } from '@/types';

export default function TopicDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { message } = App.useApp();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);
  const [answerContent, setAnswerContent] = useState('');

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [topicRes, answersRes] = await Promise.all([
          getSupabase()
            .from('topics')
            .select('*, author:users!author_id(id, name, avatar, department)')
            .eq('id', id)
            .single(),
          getSupabase()
            .from('answers')
            .select('*, author:users!author_id(id, name, avatar, department)')
            .eq('topic_id', id)
            .order('is_accepted', { ascending: false })
            .order('vote_count', { ascending: false }),
        ]);
        if (topicRes.data) setTopic(topicRes.data as Topic);
        if (answersRes.data) setAnswers(answersRes.data as Answer[]);
        getSupabase().rpc('increment_view_count', { table_name: 'topics', row_id: id }).then(() => {}, () => {});
      } catch (err) {
        console.error('Failed to fetch topic:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  const handleSubmitAnswer = async () => {
    if (!answerContent.trim()) return;
    try {
      const { error } = await getSupabase().from('answers').insert({
        topic_id: id,
        content: answerContent.trim(),
      });
      if (error) throw error;
      setAnswerContent('');
      message.success('回答已提交');
      // Refresh answers
      const { data } = await getSupabase()
        .from('answers')
        .select('*, author:users!author_id(id, name, avatar, department)')
        .eq('topic_id', id)
        .order('is_accepted', { ascending: false })
        .order('vote_count', { ascending: false });
      setAnswers((data ?? []) as Answer[]);
      // Update answer count
      if (topic) {
        const newCount = topic.answer_count + 1;
        setTopic({ ...topic, answer_count: newCount });
        await getSupabase().from('topics').update({ answer_count: newCount }).eq('id', id);
      }
    } catch {
      message.error('提交失败，请重试');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Spin size="large" />
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <p style={{ color: 'var(--text-muted)' }}>话题不存在</p>
        <Link href="/topics" style={{ color: 'var(--primary)' }}>返回话题列表</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <Link href="/topics" className="inline-flex items-center gap-1.5 text-sm mb-6 transition-opacity hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
        <ArrowLeftOutlined /> 返回话题列表
      </Link>

      {/* Topic */}
      <article className="glass rounded-2xl p-6 sm:p-8 mb-6" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {topic.tags.map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
          {topic.has_accepted_answer && (
            <Tag color="green" icon={<CheckCircleOutlined />}>已采纳</Tag>
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold mb-5 leading-tight">
          {topic.title}
        </h1>

        <div className="flex items-center gap-4 mb-6 text-sm flex-wrap" style={{ color: 'var(--text-muted)' }}>
          <div className="flex items-center gap-2">
            <Avatar size="small" src={topic.author.avatar} icon={<UserOutlined />} />
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{topic.author.name}</span>
            <span style={{ color: 'var(--border)' }}>·</span>
            <span>{topic.author.department}</span>
          </div>
          <span>{new Date(topic.created_at).toLocaleDateString('zh-CN')}</span>
        </div>

        <div className="leading-relaxed" style={{ color: 'var(--text-primary)' }}>{topic.content}</div>
      </article>

      {/* Answers */}
      <div className="glass rounded-2xl p-6 sm:p-8 mb-6" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <h2 className="text-lg font-semibold mb-5 flex items-center gap-2">
          <CommentOutlined style={{ color: 'var(--accent)' }} />
          {answers.length} 个回答
        </h2>

        {answers.length === 0 ? (
          <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
            <p className="text-sm">暂无回答，快来第一个回答吧！</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {answers.map((answer) => (
              <div key={answer.id} className="pb-5" style={{ borderBottom: '1px solid var(--border-light)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Avatar size="small" src={answer.author.avatar} icon={<UserOutlined />} />
                  <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{answer.author.name}</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{answer.author.department}</span>
                  {answer.is_accepted && <Tag color="green" className="text-xs">已采纳</Tag>}
                </div>
                <div className="mb-2 leading-relaxed" style={{ color: 'var(--text-primary)' }}>{answer.content}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {new Date(answer.created_at).toLocaleDateString('zh-CN')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Write answer */}
      <div className="glass rounded-2xl p-6 sm:p-8" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <h2 className="text-lg font-semibold mb-4">写回答</h2>
        <Input.TextArea
          rows={5}
          placeholder="分享你的经验和见解..."
          value={answerContent}
          onChange={(e) => setAnswerContent(e.target.value)}
        />
        <div className="flex justify-end mt-3">
          <button
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90"
            style={{ background: 'var(--primary)' }}
            onClick={handleSubmitAnswer}
          >
            <CommentOutlined /> 提交回答
          </button>
        </div>
      </div>
    </div>
  );
}
