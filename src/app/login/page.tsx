'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function LoginForm() {
  const searchParams = useSearchParams();

  const error = searchParams.get('error');
  const errorMessage = error === 'no_code' ? '未获取到授权码，请重试'
    : error === 'invalid_link' ? '登录链接无效，请重新获取'
    : error === 'link_expired' ? '登录链接已过期，请重新获取'
    : error ? '登录过程中出现错误，请重试' : null;

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 pt-8 pb-8">
      <div className="w-full max-w-md">
        {/* 欢迎语（顶部导航已有 HRAS AI 岛 logo，这里不再重复） */}
        <div className="text-center mb-8">
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

          {/* 飞书登录：多企业 */}
          <FeishuEnterpriseButtons />

          {/* 开发模式：跳过飞书 OAuth（仅 dev 显示，生产永远不会出现） */}
          {process.env.NODE_ENV !== 'production' && <DevSkipLogin />}

          {/* 用户名密码登录/注册 已下线（2026-06-05，commit f5e16bc） */}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--text-muted)' }}>
          登录即表示同意社区使用规范
        </p>
      </div>
    </div>
  );
}

/** 多企业飞书登录按钮：动态从 /api/feishu-apps/public 拉 active 企业的 app_id + enterprise_name */
const PREFERRED_ORDER = ['ZT', 'GF', 'WX'];

function FeishuEnterpriseButtons() {
  const [apps, setApps] = useState<Array<{ app_id: string; enterprise_name: string }>>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/feishu-apps/public').then(r => r.json()).then(j => {
      if (j.apps) {
        // 按 PREFERRED_ORDER 排序：未知企业排到末尾
        const sorted = [...j.apps].sort((a, b) => {
          const ai = PREFERRED_ORDER.indexOf(a.enterprise_name);
          const bi = PREFERRED_ORDER.indexOf(b.enterprise_name);
          if (ai === -1 && bi === -1) return 0;
          if (ai === -1) return 1;
          if (bi === -1) return -1;
          return ai - bi;
        });
        setApps(sorted);
      }
    }).finally(() => setLoaded(true));
  }, []);

  const go = (appId: string) => {
    setLoading(true);
    window.location.assign(`/api/auth/feishu?app_id=${encodeURIComponent(appId)}`);
  };

  // 加载中：什么都不显示，避免闪"未配置"
  if (!loaded) {
    return <div className="h-12" aria-hidden="true" />;
  }

  // 加载完但没配：才显示"未配置"
  if (apps.length === 0) {
    return (
      <div className="text-center text-sm py-3" style={{ color: 'var(--text-muted)' }}>
        飞书登录暂未配置，请联系 AILand 管理员
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-center mb-3" style={{ color: 'var(--text-muted)' }}>
        飞书用户请选择您所在的企业登录
      </p>
      {apps.map((a) => (
        <button
          key={a.app_id}
          onClick={() => go(a.app_id)}
          disabled={loading}
          className="w-full h-12 rounded-xl text-base font-medium text-white transition-all hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
          style={{ background: 'var(--gradient-primary)' }}
        >
          {a.enterprise_name}飞书授权登录
        </button>
      ))}
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

/** Dev-only: 跳过飞书 OAuth，直接用第一个 admin 账号登录 */
function DevSkipLogin() {
  const [userIdInput, setUserIdInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const skip = async (userId?: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/dev-skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userId ? { user_id: userId } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'dev-skip 失败');
      window.location.href = '/';
    } catch (e) {
      setError(e instanceof Error ? e.message : 'dev-skip 失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 p-3 rounded-lg" style={{ background: 'rgba(242,127,34,0.06)', border: '1px dashed rgba(242,127,34,0.4)' }}>
      <p className="text-[11px] font-semibold mb-2" style={{ color: '#b3540e' }}>
        🛠 Dev 模式（仅本地 dev 显示）— 跳过飞书 OAuth
      </p>
      <button
        onClick={() => skip()}
        disabled={loading}
        className="w-full h-9 rounded-lg text-xs font-medium text-white transition-all hover:opacity-90 disabled:opacity-60"
        style={{ background: '#F27F22' }}
      >
        {loading ? '登录中...' : '用第一个 admin 账号登录（推荐郭谦）'}
      </button>
      <details className="mt-2">
        <summary className="text-[10px] cursor-pointer" style={{ color: 'var(--text-muted)' }}>
          或用指定 user_id 登录
        </summary>
        <div className="flex gap-2 mt-2">
          <input
            type="text"
            value={userIdInput}
            onChange={(e) => setUserIdInput(e.target.value)}
            placeholder="user uuid"
            className="flex-1 h-8 px-2 rounded text-xs outline-none"
            style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(26,58,138,0.12)' }}
          />
          <button
            onClick={() => userIdInput && skip(userIdInput)}
            disabled={loading || !userIdInput}
            className="px-3 h-8 rounded text-xs font-medium"
            style={{ background: 'rgba(26,58,138,0.1)', color: 'var(--primary)' }}
          >
            登录
          </button>
        </div>
      </details>
      {error && <p className="text-[11px] mt-2" style={{ color: '#dc2626' }}>{error}</p>}
    </div>
  );
}
