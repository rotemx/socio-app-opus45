import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { RedisService } from '../../../redis';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);
  private readonly DEFAULT_LIMIT = 100;
  private readonly DEFAULT_WINDOW = 60; // 1 minute

  constructor(
    private readonly redisService: RedisService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Only apply to HTTP requests
    if (context.getType() !== 'http') {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const ip = request.ip || request.connection.remoteAddress;
    const user = request.user;
    
    // Use user ID if authenticated, otherwise IP
    const key = user ? `user:${user.sub}` : `ip:${ip}`;
    const limit = this.DEFAULT_LIMIT;
    const window = this.DEFAULT_WINDOW;

    try {
      const result = await this.redisService.checkRateLimit(key, limit, window);

      const response = context.switchToHttp().getResponse();
      response.header('X-RateLimit-Limit', limit.toString());
      response.header('X-RateLimit-Remaining', result.remaining.toString());
      response.header('X-RateLimit-Reset', result.resetAt.toString());

      if (!result.allowed) {
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
      
      // Fail open if Redis is down, but log it
      this.logger.error(`Rate limiting failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return true;
    }
  }
}