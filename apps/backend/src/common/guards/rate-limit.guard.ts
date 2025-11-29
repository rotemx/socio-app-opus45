import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { Reflector } from '@nestjs/core';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { RedisService } from '../../redis';
import { RATE_LIMIT_KEY, type RateLimitConfig } from '../decorators/rate-limit.decorator';

/**
 * Rate Limiting Guard
 * Uses Redis sliding window algorithm to rate limit requests
 *
 * Apply the @RateLimit() decorator to controllers or handlers to enable
 *
 * @example
 * ```typescript
 * // Apply to a controller method
 * @RateLimit({ limit: 5, windowSeconds: 60 })
 * @Post('login')
 * login() {}
 *
 * // Or apply globally in AppModule providers:
 * {
 *   provide: APP_GUARD,
 *   useClass: RateLimitGuard,
 * }
 * ```
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly redisService: RedisService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get rate limit config from decorator metadata
    const config = this.reflector.getAllAndOverride<RateLimitConfig | undefined>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no rate limit config, allow request
    if (!config) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const key = this.buildKey(request, config, context);

    try {
      const result = await this.redisService.checkRateLimit(key, config.limit, config.windowSeconds);

      // Set rate limit headers
      const response = context.switchToHttp().getResponse();
      response.setHeader('X-RateLimit-Limit', config.limit);
      response.setHeader('X-RateLimit-Remaining', result.remaining);
      response.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));

      if (!result.allowed) {
        const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
        response.setHeader('Retry-After', retryAfter);

        this.logger.warn(`Rate limit exceeded for key: ${key}`);

        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Too many requests, please try again later',
            retryAfter,
          },
          HttpStatus.TOO_MANY_REQUESTS
        );
      }

      return true;
    } catch (error) {
      // If it's already an HTTP exception (rate limit exceeded), re-throw
      if (error instanceof HttpException) {
        throw error;
      }

      // Log Redis errors but allow request (fail-open for rate limiting)
      this.logger.error('Rate limit check failed, allowing request:', error);
      return true;
    }
  }

  /**
   * Build the rate limit key
   * Format: rate-limit:{keyPrefix}:{identifier}
   */
  private buildKey(
    request: { ip: string; user?: { sub?: string }; route?: { path?: string } },
    config: RateLimitConfig,
    context: ExecutionContext
  ): string {
    const parts: string[] = [];

    // Use custom key prefix or route path
    if (config.keyPrefix) {
      parts.push(config.keyPrefix);
    } else {
      // Use the route path as default key
      const handler = context.getHandler();
      const controller = context.getClass();
      parts.push(`${controller.name}:${handler.name}`);
    }

    // Add user ID or IP address
    if (config.perUser && request.user?.sub) {
      parts.push(`user:${request.user.sub}`);
    } else {
      // Use IP address for unauthenticated requests
      // Handle forwarded IPs (X-Forwarded-For header)
      const ip = this.getClientIp(request);
      parts.push(`ip:${ip}`);
    }

    return parts.join(':');
  }

  /**
   * Get client IP address, handling proxies
   */
  private getClientIp(request: { ip: string; headers?: Record<string, string | string[]> }): string {
    // Check X-Forwarded-For header (common in reverse proxy setups)
    const forwarded = request.headers?.['x-forwarded-for'];
    if (forwarded) {
      const forwardedIp = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
      if (forwardedIp) {
        return forwardedIp.trim();
      }
    }

    // Fall back to direct IP
    return request.ip || 'unknown';
  }
}
