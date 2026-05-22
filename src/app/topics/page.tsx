'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Tag, Input, Select, Badge, Spin } from 'antd';
import {
  CommentOutlined,
  EyeOutlined,
  PlusOutlined,
  CheckCircleFilled,
} from '@ant-design/icons';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { Topic } from '@/types';

type SortType = 'latest' | 'hot' | 'unanswered' | 'accepted';

export default function TopicsPage() {
  const { isAdmin } = useAuth();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState<SortType>('latest');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [allTags, setAllTags] = useState<string[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchTopics = useCallback(async () => {
    setLoading(true);
    try {
      let query = getSupabase()
        .from('topics')
        .select('*, author:users!author_id(id, name, avatar, department)');

      if (debouncedSearch) query = query.or(`title.ilike.%${debouncedSearch}%`);
      if (selectedTag) query = query.contains('tags', [selectedTag]);
      if (sort === 'unanswered') query = query.eq('answer_count', 0);
      if (sort === 'accepted') query = query.eq('has_accepted_answer', true);

      switch (sort) {
        case 'hot': query = query.order('view_count', { ascending: false }); break;
        default: query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query;
      if (error) throw error;
      const result = (data ?? []) as Topic[];
      setTopics(result);

      if (!selectedTag) {
        const tags = Array.from(new Set(result.flatMap((t) => t.tags)));
        setAllTags(tags);
      }
    } catch (err) {
      console.error('Failed to fetch topics:', err);
      setTopics([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, sort, selectedTag]);

  useEffect(() => { fetchTopics(); }, [fetchTopics]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg flex items-center justify-center text-base" style={{ background: 'rgba(45, 90, 61, 0.08)', color: 'var(--accent)' }}>
              <CommentOutlined />
            </span>
            AI 话题社区
          </h1>
          <p className="text-sm mt-1 ml-12" style={{ color: 'var(--text-secondary)' }}>提出问题，分享见解</p>
        </div>
        <Link href="/topics/create">
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90"
            style={{ background: 'var(--primary)' }}>
            <PlusOutlined /> 发起话题
          </button>
        </Link>
      </div>

      {/* Filters */}
      <div className="glass rounded-xl p-4 mb-6" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <div className="flex flex-wrap gap-3 items-center">
          <Input.Search
            placeholder="搜索话题..."
            className="w-full sm:w-64"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
          />
          <Select
            placeholder="排序方式"
            className="w-full sm:w-36"
            value={sort}
            onChange={setSort}
            options={[
              { label: '最新', value: 'latest' },
              { label: '最热', value: 'hot' },
              { label: '未回答', value: 'unanswered' },
              { label: '已采纳', value: 'accepted' },
            ]}
          />
          <Select
            placeholder="标签筛选"
            className="w-full sm:w-32"
            value={selectedTag || undefined}
            onChange={(v) => setSelectedTag(v || '')}
            allowClear
            options={allTags.map((t) => ({ label: t, value: t }))}
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20"><Spin size="large" /></div>
      ) : topics.length === 0 ? (
        <div className="text-center py-16 glass rounded-[20px]" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
          <CommentOutlined className="text-3xl mb-3" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)' }}>暂无话题</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {topics.map((topic) => (
            <Link key={topic.id} href={`/topics/${topic.id}`} className="block group">
              <div className="glass relative overflow-hidden rounded-[20px] px-5 py-4 transition-all duration-300 hover:-translate-y-0.5"
                style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
                <div className="absolute top-0 left-0 w-full h-[3px] opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'var(--gradient-primary)' }} />
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {topic.has_accepted_answer && (
                        <Badge
                          count={<CheckCircleFilled className="text-lg" style={{ color: 'var(--accent)' }} />}
                          offset={[0, 0]}
                        />
                      )}
                      <h3 className="text-base font-semibold group-hover:opacity-80 transition-opacity">
                        {topic.title}
                        {topic.is_featured && <Tag color="orange" className="ml-1.5 text-xs">精选</Tag>}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                      {topic.tags.map((tag) => (
                        <Tag key={tag}>{tag}</Tag>
                      ))}
                    </div>
                    <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <span>{topic.author.name} · {topic.author.department}</span>
                      <span><EyeOutlined /> {topic.view_count}</span>
                      <span>{new Date(topic.created_at).toLocaleDateString('zh-CN')}</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 ml-6 text-center">
                    <div className="text-2xl font-bold" style={{ color: topic.answer_count > 0 ? 'var(--primary)' : 'var(--border)' }}>
                      {topic.answer_count}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>回答</div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
