import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { backendApi, BackendError } from '@/integration/backendapi';
import { TokenStorage } from '@/integration/tokenStorage';
import { AdminIdentity } from '@/model/admin';

type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out'; error?: string }
  | { status: 'signed-in'; identity: AdminIdentity };

interface AuthContextValue {
  state: AuthState;
  login: (username: string, password: string) => Promise<void>;
  logout: (reason?: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const NOT_ADMIN = 'This account is not a platform administrator (SYSTEM_ADMIN entitlement required).';

export class NotAdminError extends Error {
  constructor() {
    super(NOT_ADMIN);
    this.name = 'NotAdminError';
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  const logout = useCallback((reason?: string) => {
    backendApi.logout();
    setState({ status: 'signed-out', error: reason });
  }, []);

  const verifyAdmin = useCallback(async () => {
    const identity = await backendApi.me();
    if (!identity.systemAdmin) {
      throw new NotAdminError();
    }
    setState({ status: 'signed-in', identity });
  }, []);

  useEffect(() => {
    backendApi.setUnauthorizedHandler(() => logout('Your session expired. Please sign in again.'));
    if (!TokenStorage.getUserToken()) {
      setState({ status: 'signed-out' });
      return;
    }
    verifyAdmin().catch((e: unknown) => {
      const notAdmin = e instanceof NotAdminError || (e instanceof BackendError && e.api.status === 403);
      logout(notAdmin ? NOT_ADMIN : undefined);
    });
  }, [logout, verifyAdmin]);

  const login = useCallback(async (username: string, password: string) => {
    await backendApi.login(username, password);
    try {
      await verifyAdmin();
    } catch (e) {
      backendApi.logout();
      if (e instanceof BackendError && e.api.status === 403) throw new NotAdminError();
      throw e;
    }
  }, [verifyAdmin]);

  const value = useMemo(() => ({ state, login, logout }), [state, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
