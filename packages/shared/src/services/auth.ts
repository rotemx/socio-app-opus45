import type { User, AuthTokens, LoginRequest, RegisterRequest } from '@socio/types';
import { api } from './api';

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

export interface VerifyPhoneResponse {
  success: boolean;
  message: string;
}

export interface SendOtpResponse {
  success: boolean;
  message: string;
}

export const authService = {
  /**
   * Login with email/password or OAuth provider
   */
  async login(request: LoginRequest): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/login', request);
    if (response.tokens.accessToken) {
      api.setAccessToken(response.tokens.accessToken);
    }
    return response;
  },

  /**
   * Register a new user
   */
  async register(request: RegisterRequest & { password: string }): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/register', request);
    if (response.tokens.accessToken) {
      api.setAccessToken(response.tokens.accessToken);
    }
    return response;
  },

  /**
   * OAuth login with provider token (Google/Apple)
   */
  async oauthLogin(
    provider: 'google' | 'apple',
    providerToken: string
  ): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/oauth', {
      authProvider: provider,
      providerToken,
    });
    if (response.tokens.accessToken) {
      api.setAccessToken(response.tokens.accessToken);
    }
    return response;
  },

  /**
   * Request phone verification OTP
   */
  async sendPhoneOtp(phone: string): Promise<SendOtpResponse> {
    return api.post<SendOtpResponse>('/auth/phone/send-otp', { phone });
  },

  /**
   * Verify phone with OTP code
   */
  async verifyPhoneOtp(phone: string, code: string): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/phone/verify', { phone, code });
    if (response.tokens.accessToken) {
      api.setAccessToken(response.tokens.accessToken);
    }
    return response;
  },

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    const response = await api.post<AuthTokens>('/auth/refresh', { refreshToken });
    if (response.accessToken) {
      api.setAccessToken(response.accessToken);
    }
    return response;
  },

  /**
   * Logout (invalidate refresh token)
   */
  async logout(refreshToken: string): Promise<void> {
    try {
      await api.post<{ success: boolean }>('/auth/logout', { refreshToken });
    } finally {
      api.setAccessToken(null);
    }
  },

  /**
   * Get current user profile
   */
  async getCurrentUser(): Promise<User> {
    return api.get<User>('/auth/me');
  },

  /**
   * Request password reset email
   */
  async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    return api.post<{ success: boolean; message: string }>('/auth/password/reset-request', { email });
  },

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    return api.post<{ success: boolean; message: string }>('/auth/password/reset', { token, newPassword });
  },

  /**
   * Set the access token for API requests
   */
  setAccessToken(token: string | null): void {
    api.setAccessToken(token);
  },
};
