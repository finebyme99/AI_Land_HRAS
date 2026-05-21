'use client';

import Link from 'next/link';
import { BellOutlined, ArrowLeftOutlined } from '@ant-design/icons';

const mockNotifications = [
  { id: '1', type: 'like', title: '张三 点赞了你的案例', content: '用 Claude 优化招聘 JD 撰写效率', time: '2 小时前', is_read: false },
  { id: '2', type: 'comment', title: '李四 评论了你的案例', content: '这个方法很实用！', time: '5 小时前', is_read: false },
];

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

      {mockNotifications.length === 0 ? (
        <div className="text-center py-16 glass rounded-2xl" style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
          <BellOutlined className="text-3xl mb-3" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)' }}>暂无通知</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {mockNotifications.map((item) => (
            <div key={item.id} className="glass rounded-xl px-5 py-4 transition-all duration-300 hover:-translate-y-0.5"
              style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {!item.is_read && (
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--primary)' }} />
                    )}
                    <span className="font-medium text-sm">{item.title}</span>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{item.content}</p>
                </div>
                <span className="text-xs flex-shrink-0 ml-4" style={{ color: 'var(--text-muted)' }}>{item.time}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
