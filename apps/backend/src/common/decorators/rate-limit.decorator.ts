import { SetMetadata } from '@nestjs/common';

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  limit: number;
  /** Time window in seconds */
  windowSeconds: number;
  /** Optional custom key prefix (defaults to route path) */
  keyPrefix?: string;
  /** Whether to use user ID in the key (for authenticated routes) */
  perUser?: boolean;
}

export const RATE_LIMIT_KEY = 'rate-limit';

/**
 * Rate limiting decorator
 * Apply to controllers or individual endpoints to enable rate limiting
 *
 * @example
 * ```typescript
 * // Limit to 5 requests per minute for unauthenticated users
 * @RateLimit({ limit: 5, windowSeconds: 60 })
 * @Post('login')
 * login(@Body() dto: LoginDto) {}
 *
 * // Limit to 100 requests per minute per user
 * @RateLimit({ limit: 100, windowSeconds: 60, perUser: true })
 * @Get('messages')
 * getMessages() {}
 * ```
 */
export const RateLimit = (config: RateLimitConfig) => SetMetadata(RATE_LIMIT_KEY, config);
