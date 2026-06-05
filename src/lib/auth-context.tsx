'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User } from '@/types';
import { HARDCODED_REVIEWER_NAMES } from '@/lib/constants';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isReviewer: boolean;
  isCourseAdmin: boolean;
  canManageCourses: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAdmin: false,
  isReviewer: false,
  isCourseAdmin: false,
  canManageCourses: false,
  signOut: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      setUser(data.user || null);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    fetchUser().finally(() => setLoading(false));
  }, [fetchUser]);

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  };

  const refreshUser = async () => {
    await fetchUser();
  };

  const isAdmin = !!user?.roles?.some((r) => ['admin', 'moderator'].includes(r));
  // 硬编码白名单：飞书多维表格里的"方案确认用户"临时赋予 reviewer 权限
  // 匹配规则：name 完全等于任一白名单项，或包含任一中文片段
  const isHardcodedReviewer = !!user && (
    HARDCODED_REVIEWER_NAMES.includes(user.name) ||
    HARDCODED_REVIEWER_NAMES.some((n) => /[一-龥]/.test(n) && user.name.includes(n))
  );
  const isReviewer = isAdmin || isHardcodedReviewer || !!user?.roles?.includes('reviewer');
  // 公开管理员：单独角色，用于课程模块的同步/发布/编辑
  const isCourseAdmin = !!user?.roles?.includes('course_admin');
  const canManageCourses = isAdmin || isCourseAdmin;

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, isReviewer, isCourseAdmin, canManageCourses, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
