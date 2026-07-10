// Frontend-authenticatie: context + hooks + route-guards (brief §12).
// Haalt de identiteit op via /api/me en biedt login/logout.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ApiError, api } from './api';

export type Role = 'admin' | 'contributor';

export interface Me {
  username: string;
  email: string;
  role: Role;
  classes: string[];
}

interface AuthState {
  user: Me | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<Me>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await api.get<Me>('/api/me');
      setUser(me);
    } catch (e) {
      // 401 = niet aangemeld; alles anders ook als "geen sessie" behandelen.
      if (!(e instanceof ApiError)) console.error(e);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (username: string, password: string): Promise<Me> => {
    const res = await api.post<{ user: Me }>('/api/auth/login', { username, password });
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    await api.post('/api/auth/logout');
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, loading, login, logout, refresh }),
    [user, loading, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth moet binnen <AuthProvider> gebruikt worden');
  return ctx;
}

// Guard: vereist een aangemelde gebruiker (elke rol). Stuurt anders naar /.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <AuthLoading />;
  if (!user) return <Navigate to="/" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

// Guard: vereist admin-rol.
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <AuthLoading />;
  if (!user) return <Navigate to="/" replace />;
  if (user.role !== 'admin') return <Navigate to="/uploaden" replace />;
  return <>{children}</>;
}

function AuthLoading() {
  return (
    <div className="flex min-h-full items-center justify-center p-8 text-ink/50">Laden…</div>
  );
}
