'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User } from '@/types';

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
  // reviewer 判定：admin/moderator 继承，或 users.reviewer_roles 有分配角色
  const isReviewer = isAdmin || (user?.reviewer_roles?.length ?? 0) > 0;
  // AI 课程管理员：单独角色，用于课程模块的同步/发布/编辑
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
