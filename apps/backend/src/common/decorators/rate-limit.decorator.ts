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
  /**
   * SECURITY: If true, requests are rejected when rate limiting service is unavailable.
   * Use this for sensitive operations like:
   * - OTP/SMS sending (prevents SMS bombing attacks)
   * - Password reset requests
   * - Email verification
   *
   * Default: false (fail-open for general endpoints to maintain availability)
   */
  failClosed?: boolean;
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
 *
 * // Fail-closed for sensitive operations (e.g., OTP sending)
 * @RateLimit({ limit: 3, windowSeconds: 600, failClosed: true })
 * @Post('phone/request')
 * sendOtp(@Body() dto: PhoneDto) {}
 * ```
 */
export const RateLimit = (config: RateLimitConfig) => SetMetadata(RATE_LIMIT_KEY, config);
