'use client';

import { useState, useEffect } from 'react';
import { CloseOutlined } from '@ant-design/icons';

export default function WelcomeModal() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('welcome_dismissed')) setShow(true);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[1000] w-[320px] rounded-2xl p-5 animate-fade-up"
      style={{
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.7)',
        boxShadow: '0 20px 60px rgba(26,58,138,0.15), 0 8px 20px rgba(0,0,0,0.06)',
      }}>
      <button
        className="absolute top-3 right-3 text-base"
        style={{ color: 'var(--text-muted)' }}
        onClick={() => setShow(false)}
        aria-label="关闭">
        <CloseOutlined />
      </button>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #1a3a8a, #F27F22)' }}>
          <span className="text-lg">💬</span>
        </div>
        <h3 className="text-sm font-bold pr-5" style={{ color: 'var(--text-primary)' }}>
          加入 HRAS AI 岛社群
        </h3>
      </div>
      <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
        与大家畅聊 AI 标杆案例、赛事活动、课程工具资源、日常使用。
      </p>
      <a href="https://applink.feishu.cn/client/chat/chatter/add_by_link?link_token=b02nd8af-35c6-4b90-83c3-6e19cf850fca"
        target="_blank" rel="noopener noreferrer"
        className="block w-full text-center px-4 py-2 rounded-full text-sm font-bold transition-all mb-3"
        style={{
          color: '#ffffff',
          background: 'linear-gradient(135deg, #1a3a8a, #F27F22)',
          boxShadow: '0 4px 14px rgba(26,58,138,0.3)',
        }}>
        🚀 立即加入飞书群
      </a>
      <button
        className="block w-full text-xs transition-colors"
        style={{ color: 'var(--text-muted)' }}
        onClick={() => { localStorage.setItem('welcome_dismissed', '1'); setShow(false); }}>
        我已加入，不再提示
      </button>
    </div>
  );
}
