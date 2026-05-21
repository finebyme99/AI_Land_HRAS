'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Tag, Input, Select, Radio, Empty, Spin } from 'antd';
import {
  EyeOutlined,
  LikeOutlined,
  BookOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { getSupabase } from '@/lib/supabase';
import { CATEGORY_COLORS, CASE_CATEGORIES, CASE_CATEGORY_OPTIONS } from '@/lib/constants';
import type { Case, CaseCategory } from '@/types';

export default function CasesPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState<CaseCategory | ''>('');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      let query = getSupabase()
        .from('cases')
        .select('*, author:users!author_id(id, name, avatar, department)')
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (category) query = query.eq('category', category);
      if (debouncedSearch) query = query.or(`title.ilike.%${debouncedSearch}%,summary.ilike.%${debouncedSearch}%`);

      const { data, error } = await query;
      if (error) throw error;
      setCases((data ?? []) as Case[]);
    } catch (err) {
      console.error('Failed to fetch cases:', err);
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, [category, debouncedSearch]);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg flex items-center justify-center text-base" style={{ background: 'rgba(26, 58, 138, 0.1)', color: 'var(--primary)' }}>
              <BookOutlined />
            </span>
            案例库
          </h1>
          <p className="text-sm mt-1 ml-12" style={{ color: 'var(--text-muted)' }}>来自 HR 实践者的 AI 应用案例</p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass rounded-xl p-4 mb-6" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <div className="flex flex-wrap gap-3 items-center">
          <Input.Search
            placeholder="搜索案例..."
            className="w-full sm:w-64"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
          />
          <Select
            placeholder="HR 模块"
            className="w-full sm:w-48"
            value={category || undefined}
            onChange={(v) => setCategory(v || '')}
            allowClear
            options={CASE_CATEGORY_OPTIONS}
          />
          <Radio.Group value={viewMode} onChange={(e) => setViewMode(e.target.value)} size="small">
            <Radio.Button value="card"><AppstoreOutlined /></Radio.Button>
            <Radio.Button value="list"><UnorderedListOutlined /></Radio.Button>
          </Radio.Group>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20"><Spin size="large" /></div>
      ) : cases.length === 0 ? (
        <div className="text-center py-16 glass rounded-[20px]" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
          <BookOutlined className="text-3xl mb-3" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)' }}>暂无案例</p>
        </div>
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cases.map((c) => (
            <Link key={c.id} href={`/cases/${c.id}`} className="block group">
              <div className="glass relative overflow-hidden rounded-[20px] p-5 h-full transition-all duration-300 hover:-translate-y-1"
                style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
                <div className="absolute top-0 left-0 w-full h-[3px] opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'var(--gradient-primary)' }} />
                <div className="flex items-start gap-2 mb-3">
                  <Tag color={CATEGORY_COLORS[c.category]}>{c.category}</Tag>
                  {c.event_id && <Tag color="red">大赛作品</Tag>}
                </div>
                <h3 className="text-base font-semibold mb-2 line-clamp-2 group-hover:opacity-80 transition-opacity">
                  {c.title}
                </h3>
                <p className="text-sm mb-3 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{c.summary}</p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {c.ai_tools.map((tool) => (
                    <Tag key={tool} className="text-xs">{tool}</Tag>
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span>{c.author.name} · {c.author.department}</span>
                  <span className="flex items-center gap-3">
                    <span><EyeOutlined /> {c.view_count}</span>
                    <span><LikeOutlined /> {c.like_count}</span>
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {cases.map((c) => (
            <Link key={c.id} href={`/cases/${c.id}`} className="block group">
              <div className="glass relative overflow-hidden rounded-[20px] px-5 py-4 transition-all duration-300 hover:-translate-y-0.5"
                style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Tag color={CATEGORY_COLORS[c.category]}>{c.category}</Tag>
                    </div>
                    <h3 className="text-sm font-semibold truncate group-hover:opacity-80 transition-opacity">{c.title}</h3>
                    <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>{c.summary}</p>
                  </div>
                  <div className="text-xs flex-shrink-0 text-right" style={{ color: 'var(--text-muted)' }}>
                    <div>{c.author.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span><EyeOutlined /> {c.view_count}</span>
                      <span><LikeOutlined /> {c.like_count}</span>
                    </div>
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
