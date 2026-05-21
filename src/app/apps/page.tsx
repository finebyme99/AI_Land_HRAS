'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Tag, Select, Input, Spin } from 'antd';
import {
  AppstoreOutlined,
  LikeOutlined,
  DislikeOutlined,
  StarFilled,
  UserOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { getSupabase } from '@/lib/supabase';
import { APP_CATEGORY_COLORS, APP_CATEGORIES } from '@/lib/constants';
import type { AppRecommendation, AppCategory } from '@/types';

export default function AppsPage() {
  const [apps, setApps] = useState<AppRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState<AppCategory | ''>('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchApps = useCallback(async () => {
    setLoading(true);
    try {
      let query = getSupabase()
        .from('apps')
        .select('*')
        .eq('status', 'published')
        .order('rating', { ascending: false });

      if (debouncedSearch) query = query.or(`name.ilike.%${debouncedSearch}%,description.ilike.%${debouncedSearch}%`);
      if (category) query = query.eq('category', category);

      const { data, error } = await query;
      if (error) throw error;
      setApps((data ?? []) as AppRecommendation[]);
    } catch (err) {
      console.error('Failed to fetch apps:', err);
      setApps([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, category]);

  useEffect(() => { fetchApps(); }, [fetchApps]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg flex items-center justify-center text-base" style={{ background: 'rgba(120, 80, 160, 0.08)', color: '#7850a0' }}>
              <AppstoreOutlined />
            </span>
            AI 应用推荐
          </h1>
          <p className="text-sm mt-1 ml-12" style={{ color: 'var(--text-muted)' }}>发现好用的 AI 工具</p>
        </div>
        <Link href="/apps/create">
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all hover:-translate-y-0.5"
            style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)', background: 'var(--surface)' }}>
            <PlusOutlined /> 分享应用
          </button>
        </Link>
      </div>

      {/* Filters */}
      <div className="glass rounded-xl p-4 mb-6" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <div className="flex flex-wrap gap-3 items-center">
          <Input.Search
            placeholder="搜索应用..."
            className="w-full sm:w-64"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
          />
          <Select
            placeholder="分类"
            className="w-full sm:w-32"
            value={category || undefined}
            onChange={(v) => setCategory(v || '')}
            allowClear
            options={APP_CATEGORIES.map((c) => ({ label: c, value: c }))}
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20"><Spin size="large" /></div>
      ) : apps.length === 0 ? (
        <div className="text-center py-16 glass rounded-[20px]" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
          <AppstoreOutlined className="text-3xl mb-3" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)' }}>暂无应用</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {apps.map((app) => (
            <Link key={app.id} href={`/apps/${app.id}`} className="block group">
              <div className="glass relative overflow-hidden rounded-[20px] p-5 h-full transition-all duration-300 hover:-translate-y-1"
                style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
                <div className="absolute top-0 left-0 w-full h-[3px] opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'var(--gradient-primary)' }} />
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold"
                    style={{ background: 'rgba(26, 58, 138, 0.06)', color: 'var(--primary)' }}>
                    {app.name[0]}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold group-hover:opacity-80 transition-opacity">{app.name}</h3>
                    <Tag color={APP_CATEGORY_COLORS[app.category]}>{app.category}</Tag>
                  </div>
                </div>
                <p className="text-sm mb-3 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{app.description}</p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {app.scenarios.map((s) => (
                    <Tag key={s} className="text-xs">{s}</Tag>
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span className="flex items-center gap-1" style={{ color: '#c4883a' }}>
                    <StarFilled /> {app.rating}
                  </span>
                  <span className="flex items-center gap-3">
                    <span><LikeOutlined /> {app.like_count}</span>
                    <span><DislikeOutlined /> {app.dislike_count}</span>
                    <span><UserOutlined /> {app.user_count}</span>
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
