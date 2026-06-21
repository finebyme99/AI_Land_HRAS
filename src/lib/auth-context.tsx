'use client';

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import type { User } from '@/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isReviewer: boolean;
  permissions: Set<string>;
  hasPermission: (key: string) => boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAdmin: false,
  isReviewer: false,
  permissions: new Set(),
  hasPermission: () => false,
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
    let cancelled = false;
    queueMicrotask(() => {
      fetchUser().finally(() => {
        if (!cancelled) setLoading(false);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [fetchUser]);

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  };

  const refreshUser = async () => {
    await fetchUser();
  };

  const permissions = useMemo(() => new Set(user?.permissions ?? []), [user?.permissions]);
  const hasPermission = useCallback((key: string) => permissions.has(key), [permissions]);

  const isAdmin = !!user?.roles?.includes('admin');
  // reviewer 判定：admin 继承，或 users.reviewer_roles 有分配角色
  const isReviewer = isAdmin || (user?.reviewer_roles?.length ?? 0) > 0;

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, isReviewer, permissions, hasPermission, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
