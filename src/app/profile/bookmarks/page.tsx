'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { StarOutlined, ArrowLeftOutlined, LikeOutlined, ReadOutlined, FileTextOutlined, DeleteOutlined, LinkOutlined } from '@ant-design/icons';
import { Spin, Tag, Button, Popconfirm, App } from 'antd';
import { useAuth } from '@/lib/auth-context';

interface BookmarkItem {
  id: string;
  target_type: string;
  target_id: string;
  created_at: string;
  target?: {
    id: string;
    title: string;
    description?: string;
    category?: string;
    like_count?: number;
  } | null;
}

export default function BookmarksPage() {
  const { user } = useAuth();
  const { message } = App.useApp();
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchBookmarks = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/bookmarks');
        if (res.ok) {
          const data = await res.json();
          setBookmarks(data);
        }
      } catch (err) {
        console.error('Failed to fetch bookmarks:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchBookmarks();
  }, [user]);

  const handleRemove = async (item: BookmarkItem) => {
    setRemoving(item.id);
    try {
      const res = await fetch('/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bookmark', target_type: item.target_type, target_id: item.target_id }),
      });
      if (res.ok) {
        setBookmarks((prev) => prev.filter((b) => b.id !== item.id));
        message.success('已取消收藏');
      }
    } catch {
      message.error('操作失败');
    } finally {
      setRemoving(null);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'course': return <ReadOutlined style={{ color: '#4a6fa5' }} />;
      case 'case': return <FileTextOutlined style={{ color: '#10b981' }} />;
      default: return <StarOutlined style={{ color: '#c4883a' }} />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'course': return '公开课';
      case 'case': return '案例库';
      default: return type;
    }
  };

  const getLink = (item: BookmarkItem) => {
    switch (item.target_type) {
      case 'course': return '/courses';
      case 'case': return `/cases/${item.target_id}`;
      default: return '#';
    }
  };

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="text-center py-16 glass rounded-2xl" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
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

      <h1 className="text-2xl font-semibold flex items-center gap-3 mb-6">
        <span className="w-9 h-9 rounded-lg flex items-center justify-center text-base" style={{ background: 'rgba(196, 136, 58, 0.08)', color: '#c4883a' }}>
          <StarOutlined />
        </span>
        我的收藏
      </h1>

      {loading ? (
        <div className="flex justify-center py-20"><Spin size="large" /></div>
      ) : bookmarks.length === 0 ? (
        <div className="text-center py-16 glass rounded-2xl" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
          <StarOutlined className="text-3xl mb-3" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)' }}>还没有收藏内容</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {bookmarks.map((item) => (
            <div key={item.id} className="glass relative overflow-hidden rounded-[20px] px-5 py-4 transition-all duration-300"
              style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    {getTypeIcon(item.target_type)}
                    <Tag color="orange">{getTypeLabel(item.target_type)}</Tag>
                  </div>
                  <h3 className="text-base font-semibold mb-1 line-clamp-1">
                    {item.target?.title || '内容已删除'}
                  </h3>
                  {item.target?.description && (
                    <p className="text-sm line-clamp-1" style={{ color: 'var(--text-secondary)' }}>{item.target.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {item.target?.id && (
                    <Link href={getLink(item)}>
                      <Button type="primary" size="small" icon={<LinkOutlined />}>
                        查看
                      </Button>
                    </Link>
                  )}
                  <Popconfirm
                    title="确定取消收藏？"
                    onConfirm={() => handleRemove(item)}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      loading={removing === item.id}
                    >
                      取消
                    </Button>
                  </Popconfirm>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
