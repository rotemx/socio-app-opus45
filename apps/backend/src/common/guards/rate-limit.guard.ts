import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { Reflector } from '@nestjs/core';
import { type RateLimitConfig, RATE_LIMIT_KEY } from '../decorators/rate-limit.decorator';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { RedisService } from '../../redis';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Only apply to HTTP requests
    if (context.getType() !== 'http') {
      return true;
    }

    const config = this.reflector.getAllAndOverride<RateLimitConfig>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no rate limit configured, allow request
    if (!config) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const ip = request.ip || request.connection.remoteAddress;
    const user = request.user;

    // Determine key prefix
    // If explicit prefix provided, use it. Otherwise use controller:handler name
    let prefix = config.keyPrefix;
    if (!prefix) {
      const className = context.getClass().name;
      const handlerName = context.getHandler().name;
      prefix = `${className}:${handlerName}`;
    }

    // Build the key based on configuration
    let key: string;
    if (config.perUser && user && user.sub) {
      // Rate limit per user
      key = `${prefix}:user:${user.sub}`;
    } else {
      // Rate limit per IP
      // If behind proxy, check X-Forwarded-For
      const forwardedFor = request.headers['x-forwarded-for'];
      const realIp = forwardedFor ? forwardedFor.split(',')[0].trim() : ip;
      key = `${prefix}:ip:${realIp}`;
    }

    const limit = config.limit;
    const window = config.windowSeconds;

    try {
      // SECURITY: For fail-closed endpoints, verify Redis is connected first
      if (config.failClosed && !this.redisService.isConnected()) {
        this.logger.error('Redis not connected - failing closed for sensitive endpoint');
        throw new HttpException(
          {
            statusCode: HttpStatus.SERVICE_UNAVAILABLE,
            message: 'Service temporarily unavailable. Please try again later.',
            error: 'Service Unavailable',
          },
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }

      const result = await this.redisService.checkRateLimit(key, limit, window);

      const response = context.switchToHttp().getResponse();
      response.header('X-RateLimit-Limit', limit.toString());
      response.header('X-RateLimit-Remaining', result.remaining.toString());
      response.header('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000).toString());

      if (!result.allowed) {
        response.header('Retry-After', Math.ceil((result.resetAt - Date.now()) / 1000).toString());
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Too many requests',
            error: 'Too Many Requests',
          },
          HttpStatus.TOO_MANY_REQUESTS
        );
      }

      return true;
    } catch (error) {
      if (error instanceof HttpException) throw error;

      // SECURITY: If failClosed is enabled, reject the request when rate limiting fails
      // This prevents abuse of sensitive endpoints (SMS sending, password reset, etc.)
      if (config.failClosed) {
        this.logger.error(
          `Rate limiting failed (failing closed): ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        throw new HttpException(
          {
            statusCode: HttpStatus.SERVICE_UNAVAILABLE,
            message: 'Service temporarily unavailable. Please try again later.',
            error: 'Service Unavailable',
          },
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }

      // Fail open for general endpoints if Redis is down, but log it
      this.logger.error(
        `Rate limiting failed (failing open): ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return true;
    }
  }
}
