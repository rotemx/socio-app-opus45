export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface CursorPaginatedResponse<T> {
  items: T[];
  cursor?: string;
  hasMore: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  email?: string;
  phone?: string;
  password?: string;
  authProvider: 'email' | 'google' | 'apple' | 'phone';
  providerToken?: string;
}

export interface RegisterRequest {
  username: string;
  email?: string;
  phone?: string;
  password?: string;
  displayName?: string;
}
