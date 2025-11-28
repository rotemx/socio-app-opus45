import { type ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { type Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let mockReflector: jest.Mocked<Reflector>;

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

    guard = new RolesGuard(mockReflector);
  });

  const createMockExecutionContext = (user?: typeof mockUser | null): ExecutionContext => {
    const mockRequest = {
      user: user === null ? undefined : user,
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
    it('should allow access when no roles are specified', () => {
      mockReflector.getAllAndOverride.mockReturnValue(undefined);
      const context = createMockExecutionContext(mockUser);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access when roles array is empty', () => {
      mockReflector.getAllAndOverride.mockReturnValue([]);
      const context = createMockExecutionContext(mockUser);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw UnauthorizedException when user is not authenticated', () => {
      mockReflector.getAllAndOverride.mockReturnValue(['admin']);
      const context = createMockExecutionContext(null);

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('User not authenticated');
    });

    it('should allow access when user has required role', () => {
      mockReflector.getAllAndOverride.mockReturnValue(['user']);
      const context = createMockExecutionContext(mockUser);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access when user has one of required roles', () => {
      mockReflector.getAllAndOverride.mockReturnValue(['admin', 'user']);
      const context = createMockExecutionContext(mockUser);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when user lacks required role', () => {
      mockReflector.getAllAndOverride.mockReturnValue(['admin']);
      const context = createMockExecutionContext(mockUser);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('Access denied. Required role(s): admin');
    });

    it('should throw ForbiddenException with multiple required roles in message', () => {
      mockReflector.getAllAndOverride.mockReturnValue(['admin', 'moderator']);
      const context = createMockExecutionContext(mockUser);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow(
        'Access denied. Required role(s): admin, moderator'
      );
    });

    it('should allow access for user with admin role when admin is required', () => {
      mockReflector.getAllAndOverride.mockReturnValue(['admin']);
      const adminUser = { ...mockUser, roles: ['admin', 'user'] };
      const context = createMockExecutionContext(adminUser);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should handle user with empty roles array', () => {
      mockReflector.getAllAndOverride.mockReturnValue(['user']);
      const userWithNoRoles = { ...mockUser, roles: [] };
      const context = createMockExecutionContext(userWithNoRoles);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should handle user without roles property', () => {
      mockReflector.getAllAndOverride.mockReturnValue(['user']);
      const userWithoutRoles = { ...mockUser, roles: undefined } as unknown as typeof mockUser;
      const context = createMockExecutionContext(userWithoutRoles);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });
});
