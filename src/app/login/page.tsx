'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { UserOutlined, LockOutlined } from '@ant-design/icons';

function LoginForm() {
  const searchParams = useSearchParams();
  const [feishuLoading, setFeishuLoading] = useState(false);

  // 飞书登录
  const handleFeishuLogin = () => {
    setFeishuLoading(true);
    window.location.href = '/api/auth/feishu';
  };

  const error = searchParams.get('error');
  const errorMessage = error === 'no_code' ? '未获取到授权码，请重试'
    : error === 'invalid_link' ? '登录链接无效，请重新获取'
    : error === 'link_expired' ? '登录链接已过期，请重新获取'
    : error ? '登录过程中出现错误，请重试' : null;

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 pt-8 pb-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-6">
            <span className="text-2xl font-bold tracking-tight gradient-text">HRAS</span>
            <span className="text-2xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>AI岛</span>
          </div>
          <h1 className="text-xl font-semibold mb-2">欢迎回来</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>HR 的 AI 社区 — 登录后开始探索</p>
        </div>

        {/* Login Card */}
        <div className="glass rounded-[20px] p-8"
          style={{ borderColor: 'rgba(255, 255, 255, 0.6)' }}>

          {errorMessage && (
            <div className="mb-5 p-3 rounded-lg text-sm" style={{ background: 'rgba(184, 58, 58, 0.06)', border: '1px solid rgba(184, 58, 58, 0.15)', color: '#b83a3a' }}>
              {errorMessage}
            </div>
          )}

          {/* 纵腾用户：飞书登录 */}
          <div className="mb-1">
            <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>纵腾用户</span>
          </div>
          <button
            onClick={handleFeishuLogin}
            disabled={feishuLoading}
            className="w-full h-12 rounded-xl text-base font-medium text-white transition-all hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background: 'var(--gradient-primary)' }}
          >
            {feishuLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                正在跳转...
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" fill="currentColor"/>
                </svg>
                纵腾飞书账号登录
              </>
            )}
          </button>

          {/* 分隔线 */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ background: 'rgba(0,0,0,0.08)' }} />
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>无纵腾飞书账号</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(0,0,0,0.08)' }} />
          </div>

          {/* 用户名密码登录/注册 */}
          <PasswordAuth />

          <div className="mt-6 pt-5 text-center" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.5)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              纵腾员工请使用飞书账号登录，无飞书账号请注册
            </p>
          </div>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--text-muted)' }}>
          登录即表示同意社区使用规范
        </p>
      </div>
    </div>
  );
}

/** 用户名密码登录/注册组件 */
function PasswordAuth() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');

    if (!username || !password) {
      setError('请输入用户名和密码');
      return;
    }
    if (mode === 'register' && password !== confirmPassword) {
      setError('两次密码不一致');
      return;
    }
    if (password.length < 6) {
      setError('密码至少 6 位');
      return;
    }

    setLoading(true);
    try {
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '操作失败');
      } else {
        window.location.href = '/';
      }
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* 切换 Tab */}
      <div className="flex rounded-lg overflow-hidden mb-4" style={{ background: 'rgba(0,0,0,0.03)' }}>
        <button
          onClick={() => { setMode('login'); setError(''); }}
          className="flex-1 py-2 text-xs font-medium transition-all"
          style={{
            background: mode === 'login' ? 'rgba(255,255,255,0.8)' : 'transparent',
            color: mode === 'login' ? 'var(--primary)' : 'var(--text-muted)',
            boxShadow: mode === 'login' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
          }}
        >
          登录
        </button>
        <button
          onClick={() => { setMode('register'); setError(''); }}
          className="flex-1 py-2 text-xs font-medium transition-all"
          style={{
            background: mode === 'register' ? 'rgba(255,255,255,0.8)' : 'transparent',
            color: mode === 'register' ? 'var(--primary)' : 'var(--text-muted)',
            boxShadow: mode === 'register' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
          }}
        >
          注册
        </button>
      </div>

      {/* 表单 */}
      <div className="space-y-3">
        <div>
          <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>用户名</label>
          <div className="relative">
            <UserOutlined className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="2-20 个字符"
              className="w-full h-10 pl-8 pr-3 rounded-lg text-sm outline-none transition-all"
              style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(26,58,138,0.12)', color: 'var(--foreground)' }}
              autoFocus
            />
          </div>
          {mode === 'register' && (
            <p className="text-[11px] mt-1" style={{ color: '#b3540e' }}>
              请使用本人真实姓名或飞书名注册，否则无法正常开通权限
            </p>
          )}
        </div>
        <div>
          <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>密码</label>
          <div className="relative">
            <LockOutlined className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--text-muted)' }} />
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="至少 6 位"
              className="w-full h-10 pl-8 pr-3 rounded-lg text-sm outline-none transition-all"
              style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(26,58,138,0.12)', color: 'var(--foreground)' }}
            />
          </div>
        </div>
        {mode === 'register' && (
          <div>
            <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>确认密码</label>
            <div className="relative">
              <LockOutlined className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--text-muted)' }} />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="再次输入密码"
                className="w-full h-10 pl-8 pr-3 rounded-lg text-sm outline-none transition-all"
                style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(26,58,138,0.12)', color: 'var(--foreground)' }}
              />
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="text-[11px] mt-2" style={{ color: '#dc2626' }}>{error}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full h-10 mt-4 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
        style={{ background: 'var(--primary)' }}
      >
        {loading ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            {mode === 'register' ? '注册中...' : '登录中...'}
          </>
        ) : (
          mode === 'register' ? '注册并登录' : '登录'
        )}
      </button>
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
