'use client';

import { useState, useEffect } from 'react';

export default function WelcomeModal() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('welcome_dismissed')) setShow(true);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center px-4"
      style={{ background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(6px)' }}>
      <div className="relative w-full max-w-[420px] rounded-2xl p-8 text-center animate-fade-up"
        style={{
          background: 'rgba(255,255,255,0.75)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.7)',
          boxShadow: '0 20px 60px rgba(26,58,138,0.15), 0 8px 20px rgba(0,0,0,0.06)',
        }}>
        <div className="w-14 h-14 mx-auto mb-5 rounded-2xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #1a3a8a, #F27F22)' }}>
          <span className="text-2xl">💬</span>
        </div>
        <h3 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
          欢迎来到 HRAS AI Land
        </h3>
        <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--text-secondary)' }}>
          点击下方链接，加入<strong>HRAS AI岛</strong>飞书话题群，与大家畅聊 AI 标杆案例、赛事活动、课程工具资源、日常使用。
        </p>
        <a href="https://applink.feishu.cn/client/chat/chatter/add_by_link?link_token=b02nd8af-35c6-4b90-83c3-6e19cf850fca"
          target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-7 py-2.5 rounded-full text-[15px] font-bold transition-all mb-4"
          style={{
            color: '#ffffff',
            background: 'linear-gradient(135deg, #1a3a8a, #F27F22)',
            boxShadow: '0 4px 14px rgba(26,58,138,0.3)',
            textShadow: '0 1px 2px rgba(0,0,0,0.2)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}>
          🚀 立即加入飞书群
        </a>
        <div>
          <button
            className="text-xs transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onClick={() => { localStorage.setItem('welcome_dismissed', '1'); setShow(false); }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}>
            我已加入，不再提示
          </button>
        </div>
      </div>
    </div>
  );
}
