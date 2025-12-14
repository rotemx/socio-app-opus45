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

/**
 * Default request timeout in milliseconds (30 seconds)
 */
const DEFAULT_TIMEOUT_MS = 30000;

interface RequestConfig {
  params?: Record<string, string | number | undefined>;
  headers?: Record<string, string>;
  timeoutMs?: number;
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

  /**
   * Create an AbortController with timeout
   */
  private createAbortController(timeoutMs?: number): { controller: AbortController; timeoutId: ReturnType<typeof setTimeout> } {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs ?? DEFAULT_TIMEOUT_MS);
    return { controller, timeoutId };
  }

  async get<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    const url = this.buildUrl(endpoint, config?.params);
    const { controller, timeoutId } = this.createAbortController(config?.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(config?.headers),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data: ApiResponse<T> = await response.json();
      if (!data.success || data.data === undefined) {
        throw new Error(data.error?.message || 'Unknown error');
      }

      return data.data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async post<T>(endpoint: string, body: unknown, config?: RequestConfig): Promise<T> {
    const url = this.buildUrl(endpoint, config?.params);
    const { controller, timeoutId } = this.createAbortController(config?.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(config?.headers),
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data: ApiResponse<T> = await response.json();
      if (!data.success || data.data === undefined) {
        throw new Error(data.error?.message || 'Unknown error');
      }

      return data.data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async put<T>(endpoint: string, body: unknown, config?: RequestConfig): Promise<T> {
    const url = this.buildUrl(endpoint, config?.params);
    const { controller, timeoutId } = this.createAbortController(config?.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: this.getHeaders(config?.headers),
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data: ApiResponse<T> = await response.json();
      if (!data.success || data.data === undefined) {
        throw new Error(data.error?.message || 'Unknown error');
      }

      return data.data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Delete a resource at the given endpoint
   * @param endpoint - API endpoint to delete
   * @param config - Optional request configuration
   * @returns Promise resolving to the response data, or undefined for 204 No Content responses
   * @remarks When the endpoint returns 204 No Content, use delete<void>() and expect undefined
   */
  async delete<T = void>(endpoint: string, config?: RequestConfig): Promise<T | undefined> {
    const url = this.buildUrl(endpoint, config?.params);
    const { controller, timeoutId } = this.createAbortController(config?.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: this.getHeaders(config?.headers),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      // Handle 204 No Content or empty responses
      if (response.status === 204 || response.headers.get('content-length') === '0') {
        return undefined;
      }

      const text = await response.text();
      if (!text) {
        return undefined;
      }

      const data: ApiResponse<T> = JSON.parse(text);
      if (!data.success || data.data === undefined) {
        throw new Error(data.error?.message || 'Unknown error');
      }

      return data.data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export const api = new ApiService(API_BASE_URL);
