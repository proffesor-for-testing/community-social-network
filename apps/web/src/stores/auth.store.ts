import { create } from 'zustand';
import type { CurrentUserDto } from '../api/types';

interface AuthState {
  /** In-memory access token (never persisted to storage) */
  accessToken: string | null;
  /** Currently authenticated user profile */
  user: CurrentUserDto | null;
  /** Derived convenience flag */
  isAuthenticated: boolean;

  setAccessToken: (token: string) => void;
  setUser: (user: CurrentUserDto) => void;
  login: (token: string, user: CurrentUserDto) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,

  setAccessToken: (token) =>
    set({ accessToken: token, isAuthenticated: true }),

  setUser: (user) => set({ user }),

  login: (token, user) =>
    set({ accessToken: token, user, isAuthenticated: true }),

  clearAuth: () =>
    set({ accessToken: null, user: null, isAuthenticated: false }),
}));
