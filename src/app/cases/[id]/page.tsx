'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { Tag, Avatar, Input, Spin, message } from 'antd';
import {
  LikeOutlined,
  StarOutlined,
  ShareAltOutlined,
  EyeOutlined,
  ArrowLeftOutlined,
  UserOutlined,
  BookOutlined,
} from '@ant-design/icons';
import { getSupabase } from '@/lib/supabase';
import { CATEGORY_COLORS, DIFFICULTY_COLORS } from '@/lib/constants';
import type { Case } from '@/types';

export default function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [caseItem, setCaseItem] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');

  useEffect(() => {
    async function fetchCase() {
      setLoading(true);
      try {
        const { data, error } = await getSupabase()
          .from('cases')
          .select('*, author:users!author_id(id, name, avatar, department)')
          .eq('id', id)
          .single();
        if (error) throw error;
        setCaseItem(data as Case);
        getSupabase().rpc('increment_view_count', { table_name: 'cases', row_id: id });
      } catch (err) {
        console.error('Failed to fetch case:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchCase();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Spin size="large" />
      </div>
    );
  }

  if (!caseItem) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <p style={{ color: 'var(--text-muted)' }}>案例不存在</p>
        <Link href="/cases" style={{ color: 'var(--primary)' }}>返回案例列表</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <Link href="/cases" className="inline-flex items-center gap-1.5 text-sm mb-6 transition-opacity hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
        <ArrowLeftOutlined /> 返回案例列表
      </Link>

      {/* Main content */}
      <article className="rounded-2xl p-6 sm:p-8 mb-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Tag color={CATEGORY_COLORS[caseItem.category]}>{caseItem.category}</Tag>
          <Tag color={DIFFICULTY_COLORS[caseItem.difficulty]}>{caseItem.difficulty}</Tag>
          {caseItem.ai_tools.map((tool) => (
            <Tag key={tool}>{tool}</Tag>
          ))}
          {caseItem.event_id && <Tag color="red">大赛作品</Tag>}
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold mb-5 leading-tight" style={{ fontFamily: 'var(--font-serif)' }}>
          {caseItem.title}
        </h1>

        <div className="flex items-center gap-4 mb-6 text-sm flex-wrap" style={{ color: 'var(--text-muted)' }}>
          <div className="flex items-center gap-2">
            <Avatar size="small" src={caseItem.author.avatar} icon={<UserOutlined />} />
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{caseItem.author.name}</span>
            <span style={{ color: 'var(--border)' }}>·</span>
            <span>{caseItem.author.department}</span>
          </div>
          <span className="flex items-center gap-1"><EyeOutlined /> {caseItem.view_count}</span>
          <span>{new Date(caseItem.created_at).toLocaleDateString('zh-CN')}</span>
        </div>

        <div className="mb-8" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1.5rem' }}>
          <div className="leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}
            dangerouslySetInnerHTML={{ __html: caseItem.content }}
          />
        </div>

        <div className="flex items-center gap-3 pt-4" style={{ borderTop: '1px solid var(--border-light)' }}>
          <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all hover:-translate-y-0.5"
            style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)', background: 'var(--surface)' }}>
            <LikeOutlined /> 点赞 ({caseItem.like_count})
          </button>
          <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all hover:-translate-y-0.5"
            style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)', background: 'var(--surface)' }}>
            <StarOutlined /> 收藏 ({caseItem.bookmark_count})
          </button>
          <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all hover:-translate-y-0.5"
            style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)', background: 'var(--surface)' }}>
            <ShareAltOutlined /> 分享到飞书
          </button>
        </div>
      </article>

      {/* Comments */}
      <div className="rounded-2xl p-6 sm:p-8" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
        <h2 className="text-lg font-semibold mb-5 flex items-center gap-2" style={{ fontFamily: 'var(--font-serif)' }}>
          <BookOutlined style={{ color: 'var(--primary)' }} />
          评论 ({caseItem.comment_count})
        </h2>

        <Input.TextArea
          rows={3}
          placeholder="写下你的评论..."
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          className="mb-3"
        />
        <button className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90"
          style={{ background: 'var(--primary)' }}
          onClick={() => { setCommentText(''); message.success('评论已提交'); }}>
          发表评论
        </button>

        <div className="mt-5 pt-5 text-center" style={{ borderTop: '1px solid var(--border-light)', color: 'var(--text-muted)' }}>
          <p className="text-sm">暂无评论，快来抢沙发吧！</p>
        </div>
      </div>
    </div>
  );
}
