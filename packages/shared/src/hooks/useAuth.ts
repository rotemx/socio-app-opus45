import { useCallback } from 'react';
import type { LoginRequest, RegisterRequest, User, AuthTokens } from '@socio/types';
import { useAuthStore } from '../stores/authStore';
import { authService } from '../services/auth';

export interface UseAuthReturn {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (request: LoginRequest) => Promise<void>;
  register: (request: RegisterRequest & { password: string }) => Promise<void>;
  oauthLogin: (provider: 'google' | 'apple', providerToken: string) => Promise<void>;
  sendPhoneOtp: (phone: string) => Promise<void>;
  verifyPhoneOtp: (phone: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export function useAuth(): UseAuthReturn {
  const store = useAuthStore();
  const { user, tokens, isAuthenticated, isLoading, error, setAuth, setLoading, setError } = store;

  const login = useCallback(
    async (request: LoginRequest) => {
      setLoading(true);
      setError(null);
      try {
        const response = await authService.login(request);
        setAuth(response.user, response.tokens);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Login failed';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [setAuth, setLoading, setError]
  );

  const register = useCallback(
    async (request: RegisterRequest & { password: string }) => {
      setLoading(true);
      setError(null);
      try {
        const response = await authService.register(request);
        setAuth(response.user, response.tokens);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Registration failed';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [setAuth, setLoading, setError]
  );

  const oauthLogin = useCallback(
    async (provider: 'google' | 'apple', providerToken: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await authService.oauthLogin(provider, providerToken);
        setAuth(response.user, response.tokens);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'OAuth login failed';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [setAuth, setLoading, setError]
  );

  const sendPhoneOtp = useCallback(
    async (phone: string) => {
      setLoading(true);
      setError(null);
      try {
        await authService.sendPhoneOtp(phone);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to send OTP';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError]
  );

  const verifyPhoneOtp = useCallback(
    async (phone: string, code: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await authService.verifyPhoneOtp(phone, code);
        setAuth(response.user, response.tokens);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Invalid verification code';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [setAuth, setLoading, setError]
  );

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      if (tokens?.refreshToken) {
        await authService.logout(tokens.refreshToken);
      }
    } finally {
      setLoading(false);
      store.logout();
    }
  }, [tokens?.refreshToken, store, setLoading]);

  const clearError = useCallback(() => {
    setError(null);
  }, [setError]);

  return {
    user,
    tokens,
    isAuthenticated,
    isLoading,
    error,
    login,
    register,
    oauthLogin,
    sendPhoneOtp,
    verifyPhoneOtp,
    logout,
    clearError,
  };
}
