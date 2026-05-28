'use client';

import { ArrowLeftOutlined } from '@ant-design/icons';

export default function CompetitionsPage() {
  return (
    <div className="fixed inset-0 z-50">
      {/* 返回按钮 — 用 <a> 强制整页刷新，避免 iframe 干扰客户端导航 */}
      <a
        href="/"
        className="fixed bottom-6 left-4 z-[60] flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all hover:scale-105 hover:shadow-lg"
        style={{
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(12px)',
          color: 'var(--primary)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.6)',
        }}
      >
        <ArrowLeftOutlined /> 返回 AI 岛
      </a>

      {/* 全屏 iframe */}
      <iframe
        src="/hras-2026/index.html"
        className="w-full h-full border-0"
        title="AI 大赛"
      />
    </div>
  );
}
