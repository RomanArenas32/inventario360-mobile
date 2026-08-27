import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { decodeCurrentToken, isAuthenticated, removeToken, setToken, decodeToken } from './auth';
import { api, registerUnauthorizedHandler, withSuppressUnauthorized } from './api';
import type { TenantRole, Module, TenantSummary } from './types';

type MeResponse = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  tenantRole: TenantRole | null;
  tenant: { id: string; name: string; staffModules: Module[] | null } | null;
  tenants: TenantSummary[];
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  tenantName: string | null;
  staffModules: Module[] | null; // null = owner (acceso total), array = modulos habilitados para staff
  tenants: TenantSummary[];     // todas las memberships del usuario
};

type AuthContextType = {
  isReady: boolean;
  isAuthed: boolean;
  tenantRole: TenantRole | null;
  activeTenantId: string | null;
  user: AuthUser | null;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  reloadUser: () => Promise<void>;
  switchTenant: (tenantId: string) => Promise<void>;
  onUnauthorized: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [tenantRole, setTenantRole] = useState<TenantRole | null>(null);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  const loadMe = useCallback(async () => {
    try {
      // withSuppressUnauthorized evita que un 401 en /auth/me borre el token
      // (útil durante el signIn inicial, donde ya sabemos que el token es válido)
      const me = await withSuppressUnauthorized(() => api.get<MeResponse>('/auth/me'));
      setUser({
        id: me.id,
        name: me.name,
        email: me.email,
        avatarUrl: me.avatarUrl,
        tenantName: me.tenant?.name ?? null,
        staffModules: me.tenant?.staffModules ?? null,
        tenants: me.tenants ?? [],
      });
    } catch {
      // Falla silenciosa: el token sigue válido, el usuario continuará en onboarding
    }
  }, []);

  async function clearAuth() {
    try { await removeToken(); } catch { /* ignorar error de keychain */ }
    setIsAuthed(false);
    setTenantRole(null);
    setActiveTenantId(null);
    setUser(null);
  }

  async function load() {
    const authed = await isAuthenticated();
    if (authed) {
      const payload = await decodeCurrentToken();
      setTenantRole((payload?.tenantRole as TenantRole) ?? null);
      setActiveTenantId(payload?.activeTenantId ?? null);
      setIsAuthed(true);
      await loadMe();
    } else {
      await clearAuth();
    }
    setIsReady(true);
  }

  useEffect(() => {
    registerUnauthorizedHandler(() => void clearAuth());
    void load();
  }, []);

  async function signIn(token: string) {
    await setToken(token);
    const payload = decodeToken(token);
    setTenantRole((payload?.tenantRole as TenantRole) ?? null);
    setActiveTenantId(payload?.activeTenantId ?? null);
    setIsAuthed(true);
    await loadMe();
  }

  async function switchTenant(tenantId: string) {
    const res = await api.post<{ ok: boolean; access_token: string }>(
      '/auth/switch-tenant',
      { tenantId },
    );
    await setToken(res.access_token);
    const payload = decodeToken(res.access_token);
    setTenantRole((payload?.tenantRole as TenantRole) ?? null);
    setActiveTenantId(payload?.activeTenantId ?? null);
    await loadMe();
  }

  async function signOut() {
    await clearAuth();
  }

  async function onUnauthorized() {
    await clearAuth();
  }

  return (
    <AuthContext.Provider
      value={{ isReady, isAuthed, tenantRole, activeTenantId, user, signIn, signOut, reloadUser: loadMe, switchTenant, onUnauthorized }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used inside AuthProvider');
  return ctx;
}
