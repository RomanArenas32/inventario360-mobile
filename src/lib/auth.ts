import { jwtDecode } from 'jwt-decode';
import { getToken, setToken, removeToken } from './api';

export interface JwtPayload {
  sub: string;
  email: string;
  globalRole: string;
  isAdmin: boolean;
  activeTenantId: string | null;
  tenantRole: 'owner' | 'staff' | null;
  exp: number;
}

export function decodeToken(token: string): JwtPayload | null {
  try {
    return jwtDecode<JwtPayload>(token);
  } catch {
    return null;
  }
}

export async function decodeCurrentToken(): Promise<JwtPayload | null> {
  const token = await getToken();
  if (!token) return null;
  return decodeToken(token);
}

export async function isAuthenticated(): Promise<boolean> {
  const payload = await decodeCurrentToken();
  if (!payload) return false;
  return payload.exp * 1000 > Date.now();
}

export { getToken, setToken, removeToken };
