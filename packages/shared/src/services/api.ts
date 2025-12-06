import type { ApiResponse } from '@socio/types';
import { z } from 'zod';

// Zod schema for process-like object
const ProcessEnvSchema = z.object({
  process: z.object({
    env: z.record(z.string(), z.string().optional()),
  }),
});

// Base URL for API - uses process.env which bundlers (Vite, Metro) can replace
const getEnvVar = (key: string): string | undefined => {
  try {
    // Access process.env safely for both Node.js and bundled environments
    const result = ProcessEnvSchema.safeParse(globalThis);
    if (result.success) {
      return result.data.process.env[key];
    }
    return undefined;
  } catch {
    return undefined;
  }
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

  private getHeaders(customHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...customHeaders,
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
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
