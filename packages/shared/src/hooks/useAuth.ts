import { useCallback } from 'react';
import type { LoginRequest, RegisterRequest, User, AuthTokens } from '@socio/types';
import { useAuthStore } from '../stores/authStore';
import { authService } from '../services/auth';

export interface AuthResult {
  user: User;
  tokens: AuthTokens;
}

export interface UseAuthReturn {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (request: LoginRequest) => Promise<AuthResult>;
  register: (request: RegisterRequest & { password: string }) => Promise<AuthResult>;
  oauthLogin: (provider: 'google' | 'apple', providerToken: string) => Promise<AuthResult>;
  sendPhoneOtp: (phone: string) => Promise<void>;
  verifyPhoneOtp: (phone: string, code: string) => Promise<AuthResult>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export function useAuth(): UseAuthReturn {
  const store = useAuthStore();
  const { user, tokens, isAuthenticated, isLoading, error, setAuth, setLoading, setError } = store;

  const login = useCallback(
    async (request: LoginRequest): Promise<AuthResult> => {
      setLoading(true);
      setError(null);
      try {
        const response = await authService.login(request);
        setAuth(response.user, response.tokens);
        return { user: response.user, tokens: response.tokens };
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
    async (request: RegisterRequest & { password: string }): Promise<AuthResult> => {
      setLoading(true);
      setError(null);
      try {
        const response = await authService.register(request);
        setAuth(response.user, response.tokens);
        return { user: response.user, tokens: response.tokens };
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
    async (provider: 'google' | 'apple', providerToken: string): Promise<AuthResult> => {
      setLoading(true);
      setError(null);
      try {
        const response = await authService.oauthLogin(provider, providerToken);
        setAuth(response.user, response.tokens);
        return { user: response.user, tokens: response.tokens };
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
    async (phone: string, code: string): Promise<AuthResult> => {
      setLoading(true);
      setError(null);
      try {
        const response = await authService.verifyPhoneOtp(phone, code);
        setAuth(response.user, response.tokens);
        return { user: response.user, tokens: response.tokens };
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

  const requestPasswordReset = useCallback(
    async (email: string) => {
      setLoading(true);
      setError(null);
      try {
        await authService.requestPasswordReset(email);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to send reset email';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError]
  );

  const resetPassword = useCallback(
    async (token: string, newPassword: string) => {
      setLoading(true);
      setError(null);
      try {
        await authService.resetPassword(token, newPassword);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to reset password';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError]
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
    requestPasswordReset,
    resetPassword,
    logout,
    clearError,
  };
}
