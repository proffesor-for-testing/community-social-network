import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuthStore } from '../../../stores/auth.store';
import type { CurrentUserDto } from '../../../api/types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export interface RefreshSuccess {
  accessToken: string;
  refreshToken?: string;
  member: {
    id: string;
    email: string;
    displayName: string;
    status?: string;
    createdAt: string;
  };
}

export function memberToCurrentUser(member: RefreshSuccess['member']): CurrentUserDto {
  return {
    id: member.id,
    email: member.email,
    username: member.email.split('@')[0] ?? member.id,
    displayName: member.displayName,
    role: 'member',
    createdAt: member.createdAt,
  };
}

export interface BootstrapDeps {
  post: (url: string, body: unknown, config: unknown) => Promise<{ data: RefreshSuccess }>;
  baseUrl: string;
  login: (token: string, user: CurrentUserDto) => void;
}

/**
 * Pure bootstrap routine. Returns `true` if the refresh succeeded and the
 * store was seeded, `false` if the user stays anonymous. Never throws.
 */
export async function runAuthBootstrap(deps: BootstrapDeps): Promise<boolean> {
  try {
    const { data } = await deps.post(
      `${deps.baseUrl}/auth/refresh`,
      {},
      { withCredentials: true, timeout: 10_000 },
    );
    if (data?.accessToken && data?.member) {
      deps.login(data.accessToken, memberToCurrentUser(data.member));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * React hook: runs `runAuthBootstrap` once on mount so the user stays signed
 * in across full page reloads (the refresh_token is in an httpOnly cookie).
 */
export function useBootstrapAuth(): { isReady: boolean } {
  const login = useAuthStore((s) => s.login);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    runAuthBootstrap({
      post: (url, body, config) =>
        axios.post(url, body, config as Record<string, unknown>) as Promise<{ data: RefreshSuccess }>,
      baseUrl: API_BASE_URL,
      login,
    }).finally(() => {
      if (!cancelled) setIsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [login]);

  return { isReady };
}
