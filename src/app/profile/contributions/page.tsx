'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Tag, Spin } from 'antd';
import { BookOutlined, ArrowLeftOutlined, EyeOutlined, LikeOutlined } from '@ant-design/icons';
import { useAuth } from '@/lib/auth-context';
import { getSupabase } from '@/lib/supabase';
import type { Case } from '@/types';

export default function ContributionsPage() {
  const { user } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    async function fetchMyCases() {
      setLoading(true);
      try {
        const { data } = await getSupabase()
          .from('cases')
          .select('*, author:users!author_id(id, name, avatar, department)')
          .eq('author_id', user!.id)
          .order('created_at', { ascending: false });
        setCases((data ?? []) as Case[]);
      } catch (err) {
        console.error('Failed to fetch contributions:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchMyCases();
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="text-center py-16 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--text-muted)' }}>请先登录</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <Link href="/profile" className="inline-flex items-center gap-1.5 text-sm mb-6 transition-opacity hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
        <ArrowLeftOutlined /> 返回个人中心
      </Link>

      <h1 className="text-2xl font-semibold flex items-center gap-3 mb-6" style={{ fontFamily: 'var(--font-serif)' }}>
        <span className="w-9 h-9 rounded-lg flex items-center justify-center text-base" style={{ background: 'rgba(184, 92, 56, 0.08)', color: 'var(--primary)' }}>
          <BookOutlined />
        </span>
        我的贡献
      </h1>

      {loading ? (
        <div className="flex justify-center py-20"><Spin size="large" /></div>
      ) : cases.length === 0 ? (
        <div className="text-center py-16 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <BookOutlined className="text-3xl mb-3" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)' }}>还没有发布过案例</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {cases.map((item) => (
            <Link key={item.id} href={`/cases/${item.id}`} className="block group">
              <div className="rounded-xl px-5 py-4 transition-all duration-300 hover:-translate-y-0.5"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <Tag color={item.status === 'published' ? 'green' : 'orange'}>
                      {item.status === 'published' ? '已发布' : '审核中'}
                    </Tag>
                    <h3 className="text-base font-semibold mt-2 group-hover:opacity-80 transition-opacity" style={{ fontFamily: 'var(--font-serif)' }}>
                      {item.title}
                    </h3>
                    <p className="text-sm mt-1 truncate" style={{ color: 'var(--text-secondary)' }}>{item.summary}</p>
                  </div>
                  <div className="text-xs flex items-center gap-3 ml-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                    <span><EyeOutlined /> {item.view_count}</span>
                    <span><LikeOutlined /> {item.like_count}</span>
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
