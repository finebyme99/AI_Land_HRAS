'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Alert } from 'antd';

function LoginForm() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const error = searchParams.get('error');

  const handleLogin = () => {
    setLoading(true);
    window.location.href = '/api/auth/feishu';
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-6">
            <span className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-serif)', color: 'var(--primary)' }}>HRAS</span>
            <span className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-serif)', color: 'var(--foreground)' }}>AI岛</span>
          </div>
          <h1 className="text-xl font-semibold mb-2" style={{ fontFamily: 'var(--font-serif)' }}>欢迎回来</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>HR 的 AI 社区 — 登录后开始探索</p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl p-8"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)' }}>

          {error && (
            <div className="mb-5 p-3 rounded-lg text-sm" style={{ background: 'rgba(184, 58, 58, 0.06)', border: '1px solid rgba(184, 58, 58, 0.15)', color: '#b83a3a' }}>
              {error === 'no_code' ? '未获取到授权码，请重试' : '登录过程中出现错误，请重试'}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full h-12 rounded-xl text-base font-medium text-white transition-all hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background: 'var(--primary)' }}
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                正在跳转...
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" fill="currentColor"/>
                </svg>
                飞书账号登录
              </>
            )}
          </button>

          <div className="mt-6 pt-5 text-center" style={{ borderTop: '1px solid var(--border-light)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              使用飞书账号免登，无需注册
            </p>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs mt-6" style={{ color: 'var(--text-muted)' }}>
          登录即表示同意社区使用规范
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[80vh] flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>加载中...</div>}>
      <LoginForm />
    </Suspense>
  );
}
