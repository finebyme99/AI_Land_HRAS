'use client';

import Link from 'next/link';
import { BellOutlined, ArrowLeftOutlined } from '@ant-design/icons';

export default function NotificationsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <Link href="/profile" className="inline-flex items-center gap-1.5 text-sm mb-6 transition-opacity hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
        <ArrowLeftOutlined /> 返回个人中心
      </Link>

      <h1 className="text-2xl font-semibold flex items-center gap-3 mb-6">
        <span className="w-9 h-9 rounded-lg flex items-center justify-center text-base" style={{ background: 'rgba(74, 111, 165, 0.08)', color: '#4a6fa5' }}>
          <BellOutlined />
        </span>
        消息通知
      </h1>

      <div className="text-center py-16 glass rounded-2xl" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
        <BellOutlined className="text-3xl mb-3" style={{ color: 'var(--text-muted)' }} />
        <p style={{ color: 'var(--text-muted)' }}>暂无通知</p>
      </div>
    </div>
  );
}
