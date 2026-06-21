'use client';

import Link from 'next/link';
import {
  ArrowLeftOutlined,
  BookOutlined,
  PlusOutlined,
  ReadOutlined,
  ToolOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Button, Spin } from 'antd';
import { useAuth } from '@/lib/auth-context';

export default function ContributionsPage() {
  const { user, loading, hasPermission } = useAuth();
  const canSubmitResource = hasPermission('resource.submit');
  const canPublishCourse = hasPermission('course.publish');

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="text-center py-16 glass rounded-2xl" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
          <UserOutlined className="text-4xl mb-4" style={{ color: 'var(--text-muted)' }} />
          <p className="mb-4" style={{ color: 'var(--text-muted)' }}>请先登录</p>
          <Link href="/login" className="text-sm font-medium px-4 py-2 rounded-lg" style={{ color: 'var(--primary)', background: 'rgba(26, 58, 138, 0.06)' }}>
            去登录
          </Link>
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
        <span className="w-9 h-9 rounded-lg flex items-center justify-center text-base" style={{ background: 'rgba(26, 58, 138, 0.08)', color: 'var(--primary)' }}>
          <BookOutlined />
        </span>
        我的贡献
      </h1>

      <div className="glass rounded-2xl p-6 sm:p-8 mb-4" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <div className="text-center py-8">
          <BookOutlined className="text-3xl mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>暂无贡献记录</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {canSubmitResource && (
          <Link href="/resources/apps/create" className="block group">
            <div className="glass rounded-xl p-5 transition-all duration-300 hover:-translate-y-0.5 flex items-center gap-4" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
              <span className="w-10 h-10 rounded-lg flex items-center justify-center text-base" style={{ background: 'rgba(242, 127, 34, 0.08)', color: 'var(--accent)' }}>
                <ToolOutlined />
              </span>
              <div className="flex-1">
                <div className="font-medium text-sm">提交工具</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>推荐 AI 工具资源</div>
              </div>
              <PlusOutlined className="group-hover:opacity-70 transition-opacity" style={{ color: 'var(--text-muted)', fontSize: 12 }} />
            </div>
          </Link>
        )}

        {canPublishCourse && (
          <Link href="/resources/courses/create" className="block group">
            <div className="glass rounded-xl p-5 transition-all duration-300 hover:-translate-y-0.5 flex items-center gap-4" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
              <span className="w-10 h-10 rounded-lg flex items-center justify-center text-base" style={{ background: 'rgba(26, 58, 138, 0.08)', color: 'var(--primary)' }}>
                <ReadOutlined />
              </span>
              <div className="flex-1">
                <div className="font-medium text-sm">发布课程</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>维护课程资源</div>
              </div>
              <PlusOutlined className="group-hover:opacity-70 transition-opacity" style={{ color: 'var(--text-muted)', fontSize: 12 }} />
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
