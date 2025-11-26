import type { ApiResponse } from '@socio/types';

// Safe environment variable access for both Vite (Web) and Metro (Mobile)
const getEnvVar = (key: string): string | undefined => {
  try {
    // @ts-ignore - import.meta is available in Vite
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      return import.meta.env[`VITE_${key}`] || import.meta.env[key];
    }
  } catch (e) {
    // Ignore errors if import.meta is not available
  }
  
  try {
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key];
    }
  } catch (e) {
    // Ignore errors
  }
  
  return undefined;
};

const API_BASE_URL = getEnvVar('API_URL') || 'http://localhost:3000';

interface RequestConfig {
  params?: Record<string, string | number | undefined>;
  headers?: Record<string, string>;
}

class ApiService {
  private baseUrl: string;
  private accessToken: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  private buildUrl(endpoint: string, params?: Record<string, string | number | undefined>): string {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }
    return url.toString();
  }

  private getHeaders(customHeaders?: Record<string, string>): Headers {
    const headers = new Headers({
      'Content-Type': 'application/json',
      ...customHeaders,
    });

    if (this.accessToken) {
      headers.set('Authorization', `Bearer ${this.accessToken}`);
    }

    return headers;
  }

  async get<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    const url = this.buildUrl(endpoint, config?.params);
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(config?.headers),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data: ApiResponse<T> = await response.json();
    if (!data.success || !data.data) {
      throw new Error(data.error?.message || 'Unknown error');
    }

    return data.data;
  }

  async post<T>(endpoint: string, body: unknown, config?: RequestConfig): Promise<T> {
    const url = this.buildUrl(endpoint, config?.params);
    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(config?.headers),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data: ApiResponse<T> = await response.json();
    if (!data.success || !data.data) {
      throw new Error(data.error?.message || 'Unknown error');
    }

    return data.data;
  }

  async put<T>(endpoint: string, body: unknown, config?: RequestConfig): Promise<T> {
    const url = this.buildUrl(endpoint, config?.params);
    const response = await fetch(url, {
      method: 'PUT',
      headers: this.getHeaders(config?.headers),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data: ApiResponse<T> = await response.json();
    if (!data.success || !data.data) {
      throw new Error(data.error?.message || 'Unknown error');
    }

    return data.data;
  }

  async delete<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    const url = this.buildUrl(endpoint, config?.params);
    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.getHeaders(config?.headers),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data: ApiResponse<T> = await response.json();
    if (!data.success || !data.data) {
      throw new Error(data.error?.message || 'Unknown error');
    }

    return data.data;
  }
}

export const api = new ApiService(API_BASE_URL);
