import { create } from 'zustand';
import type { User, AuthTokens } from '@socio/types';

export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  setUser: (user: User | null) => void;
  setTokens: (tokens: AuthTokens | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setAuth: (user: User, tokens: AuthTokens) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setTokens: (tokens) => set({ tokens }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setAuth: (user, tokens) =>
    set({ user, tokens, isAuthenticated: true, isLoading: false, error: null }),
  logout: () =>
    set({ user: null, tokens: null, isAuthenticated: false, isLoading: false, error: null }),
}));
