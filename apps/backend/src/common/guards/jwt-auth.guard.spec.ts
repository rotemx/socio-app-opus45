import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { type Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthService } from '../../modules/auth';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let mockReflector: jest.Mocked<Reflector>;
  let mockAuthService: jest.Mocked<Pick<AuthService, 'verifyAccessToken'>>;

  const mockUser = {
    sub: 'user-id',
    type: 'access' as const,
    email: 'test@example.com',
    username: 'testuser',
    roles: ['user'],
    sessionId: 'session-id',
    deviceId: 'device-id',
    iat: Date.now(),
    exp: Date.now() + 900000,
  };

  beforeEach(() => {
    mockReflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    mockAuthService = {
      verifyAccessToken: jest.fn(),
    };

    guard = new JwtAuthGuard(mockReflector, mockAuthService as unknown as AuthService);
  });

  const createMockExecutionContext = (authHeader?: string): ExecutionContext => {
    const mockRequest = {
      headers: {
        authorization: authHeader,
      },
      user: undefined,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
  };

  describe('canActivate', () => {
    it('should allow access for public routes', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(true);
      const context = createMockExecutionContext();

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockAuthService.verifyAccessToken).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if no token provided', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      const context = createMockExecutionContext();

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(context)).rejects.toThrow('Missing authentication token');
    });

    it('should throw UnauthorizedException for invalid Bearer format', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      const context = createMockExecutionContext('InvalidFormat');

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(context)).rejects.toThrow('Missing authentication token');
    });

    it('should verify token and attach user to request', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockAuthService.verifyAccessToken.mockResolvedValue(mockUser);
      const context = createMockExecutionContext('Bearer valid-token');

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockAuthService.verifyAccessToken).toHaveBeenCalledWith('valid-token');

      const request = context.switchToHttp().getRequest();
      expect(request.user).toEqual(mockUser);
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockAuthService.verifyAccessToken.mockRejectedValue(new Error('Invalid token'));
      const context = createMockExecutionContext('Bearer invalid-token');

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Invalid or expired authentication token'
      );
    });

    it('should rethrow UnauthorizedException from AuthService', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockAuthService.verifyAccessToken.mockRejectedValue(
        new UnauthorizedException('Token expired')
      );
      const context = createMockExecutionContext('Bearer expired-token');

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(context)).rejects.toThrow('Token expired');
    });

    it('should reject Bearer header without token', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      const context = createMockExecutionContext('Bearer ');

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });
  });
});
