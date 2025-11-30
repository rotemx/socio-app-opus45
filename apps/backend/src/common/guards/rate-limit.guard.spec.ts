import { type ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { type Reflector } from '@nestjs/core';
import { RateLimitGuard } from './rate-limit.guard';
import { type RateLimitConfig } from '../decorators/rate-limit.decorator';
import type { RedisService } from '../../redis';

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;
  let reflector: jest.Mocked<Reflector>;
  let redisService: jest.Mocked<RedisService>;

  const createMockContext = (
    ip = '127.0.0.1',
    userId?: string,
    headers: Record<string, string | string[]> = {}
  ): ExecutionContext => {
    const mockResponse = {
      header: jest.fn(),
      setHeader: jest.fn(), // Keep for backwards compatibility
    };

    const mockRequest = {
      ip,
      headers,
      user: userId ? { sub: userId } : undefined,
    };

    return {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
      getHandler: () => jest.fn(),
      getClass: () => class TestController {},
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    redisService = {
      checkRateLimit: jest.fn(),
    } as unknown as jest.Mocked<RedisService>;

    guard = new RateLimitGuard(redisService, reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    it('should allow request when no rate limit config is set', async () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);
      const context = createMockContext();

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(redisService.checkRateLimit).not.toHaveBeenCalled();
    });

    it('should allow request when under rate limit', async () => {
      const config: RateLimitConfig = {
        limit: 10,
        windowSeconds: 60,
        keyPrefix: 'test',
      };
      reflector.getAllAndOverride.mockReturnValue(config);
      redisService.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 9,
        resetAt: Date.now() + 60000,
      });

      const context = createMockContext();
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(redisService.checkRateLimit).toHaveBeenCalledWith('test:ip:127.0.0.1', 10, 60);
    });

    it('should reject request when over rate limit', async () => {
      const config: RateLimitConfig = {
        limit: 5,
        windowSeconds: 60,
        keyPrefix: 'auth:login',
      };
      reflector.getAllAndOverride.mockReturnValue(config);
      redisService.checkRateLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 30000,
      });

      const context = createMockContext();

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
      try {
        await guard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      }
    });

    it('should use user ID in key when perUser is true and user is authenticated', async () => {
      const config: RateLimitConfig = {
        limit: 100,
        windowSeconds: 60,
        keyPrefix: 'api',
        perUser: true,
      };
      reflector.getAllAndOverride.mockReturnValue(config);
      redisService.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 99,
        resetAt: Date.now() + 60000,
      });

      const context = createMockContext('127.0.0.1', 'user-123');
      await guard.canActivate(context);

      expect(redisService.checkRateLimit).toHaveBeenCalledWith('api:user:user-123', 100, 60);
    });

    it('should fall back to IP when perUser is true but user is not authenticated', async () => {
      const config: RateLimitConfig = {
        limit: 10,
        windowSeconds: 60,
        keyPrefix: 'api',
        perUser: true,
      };
      reflector.getAllAndOverride.mockReturnValue(config);
      redisService.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 9,
        resetAt: Date.now() + 60000,
      });

      const context = createMockContext('192.168.1.1');
      await guard.canActivate(context);

      expect(redisService.checkRateLimit).toHaveBeenCalledWith('api:ip:192.168.1.1', 10, 60);
    });

    it('should use X-Forwarded-For header when present', async () => {
      const config: RateLimitConfig = {
        limit: 10,
        windowSeconds: 60,
        keyPrefix: 'test',
      };
      reflector.getAllAndOverride.mockReturnValue(config);
      redisService.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 9,
        resetAt: Date.now() + 60000,
      });

      const context = createMockContext('127.0.0.1', undefined, {
        'x-forwarded-for': '203.0.113.195, 70.41.3.18, 150.172.238.178',
      });
      await guard.canActivate(context);

      expect(redisService.checkRateLimit).toHaveBeenCalledWith('test:ip:203.0.113.195', 10, 60);
    });

    it('should set rate limit headers on response', async () => {
      const config: RateLimitConfig = {
        limit: 10,
        windowSeconds: 60,
        keyPrefix: 'test',
      };
      reflector.getAllAndOverride.mockReturnValue(config);
      const resetAt = Date.now() + 60000;
      redisService.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 5,
        resetAt,
      });

      const context = createMockContext();
      await guard.canActivate(context);

      const response = context.switchToHttp().getResponse();
      expect(response.header).toHaveBeenCalledWith('X-RateLimit-Limit', '10');
      expect(response.header).toHaveBeenCalledWith('X-RateLimit-Remaining', '5');
      expect(response.header).toHaveBeenCalledWith(
        'X-RateLimit-Reset',
        Math.ceil(resetAt / 1000).toString()
      );
    });

    it('should set Retry-After header when rate limit exceeded', async () => {
      const config: RateLimitConfig = {
        limit: 5,
        windowSeconds: 60,
        keyPrefix: 'test',
      };
      reflector.getAllAndOverride.mockReturnValue(config);
      const resetAt = Date.now() + 30000;
      redisService.checkRateLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetAt,
      });

      const context = createMockContext();

      try {
        await guard.canActivate(context);
      } catch {
        // Expected to throw
      }

      const response = context.switchToHttp().getResponse();
      expect(response.header).toHaveBeenCalledWith('Retry-After', expect.any(String));
    });

    it('should fail-open when Redis errors', async () => {
      const config: RateLimitConfig = {
        limit: 10,
        windowSeconds: 60,
        keyPrefix: 'test',
      };
      reflector.getAllAndOverride.mockReturnValue(config);
      redisService.checkRateLimit.mockRejectedValue(new Error('Redis connection failed'));

      const context = createMockContext();
      const result = await guard.canActivate(context);

      // Should allow request on Redis failure (fail-open)
      expect(result).toBe(true);
    });

    it('should use default key when keyPrefix is not provided', async () => {
      const config: RateLimitConfig = {
        limit: 10,
        windowSeconds: 60,
      };
      reflector.getAllAndOverride.mockReturnValue(config);
      redisService.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 9,
        resetAt: Date.now() + 60000,
      });

      const context = createMockContext();
      await guard.canActivate(context);

      // Should use controller:handler format
      expect(redisService.checkRateLimit).toHaveBeenCalledWith(
        expect.stringMatching(/^TestController:mockConstructor:ip:127\.0\.0\.1$/),
        10,
        60
      );
    });
  });
});
