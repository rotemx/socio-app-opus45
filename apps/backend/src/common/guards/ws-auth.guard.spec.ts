import type { ExecutionContext } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { WsAuthGuard } from './ws-auth.guard';
import type { AuthService } from '../../modules/auth';

describe('WsAuthGuard', () => {
  let guard: WsAuthGuard;
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
    mockAuthService = {
      verifyAccessToken: jest.fn(),
    };

    guard = new WsAuthGuard(mockAuthService as unknown as AuthService);
  });

  const createMockClient = (options: {
    authToken?: string;
    authHeader?: string;
  }) => ({
    handshake: {
      auth: options.authToken ? { token: options.authToken } : {},
      headers: options.authHeader ? { authorization: options.authHeader } : {},
    },
    data: {} as Record<string, unknown>,
  });

  const createMockExecutionContext = (client: ReturnType<typeof createMockClient>): ExecutionContext =>
    ({
      switchToWs: () => ({
        getClient: () => client,
      }),
    }) as unknown as ExecutionContext;

  describe('canActivate', () => {
    it('should throw WsException if no token provided', async () => {
      const client = createMockClient({});
      const context = createMockExecutionContext(client);

      try {
        await guard.canActivate(context);
        fail('Expected WsException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(WsException);
        expect((error as WsException).getError()).toEqual({
          code: 'UNAUTHORIZED',
          message: 'Missing authentication token',
        });
      }
    });

    it('should verify token from handshake.auth.token', async () => {
      const client = createMockClient({ authToken: 'valid-token' });
      const context = createMockExecutionContext(client);
      mockAuthService.verifyAccessToken.mockResolvedValue(mockUser);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockAuthService.verifyAccessToken).toHaveBeenCalledWith('valid-token');
      expect(client.data.user).toEqual(mockUser);
    });

    it('should verify token from Authorization header with Bearer', async () => {
      const client = createMockClient({ authHeader: 'Bearer header-token' });
      const context = createMockExecutionContext(client);
      mockAuthService.verifyAccessToken.mockResolvedValue(mockUser);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockAuthService.verifyAccessToken).toHaveBeenCalledWith('header-token');
      expect(client.data.user).toEqual(mockUser);
    });

    it('should verify raw token from Authorization header', async () => {
      const client = createMockClient({ authHeader: 'raw-token' });
      const context = createMockExecutionContext(client);
      mockAuthService.verifyAccessToken.mockResolvedValue(mockUser);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockAuthService.verifyAccessToken).toHaveBeenCalledWith('raw-token');
      expect(client.data.user).toEqual(mockUser);
    });

    it('should prefer handshake.auth.token over Authorization header', async () => {
      const client = createMockClient({
        authToken: 'auth-token',
        authHeader: 'Bearer header-token',
      });
      const context = createMockExecutionContext(client);
      mockAuthService.verifyAccessToken.mockResolvedValue(mockUser);

      await guard.canActivate(context);

      expect(mockAuthService.verifyAccessToken).toHaveBeenCalledWith('auth-token');
    });

    it('should throw WsException for invalid token', async () => {
      const client = createMockClient({ authToken: 'invalid-token' });
      const context = createMockExecutionContext(client);
      mockAuthService.verifyAccessToken.mockRejectedValue(new Error('Invalid token'));

      try {
        await guard.canActivate(context);
        fail('Expected WsException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(WsException);
        expect((error as WsException).getError()).toEqual({
          code: 'UNAUTHORIZED',
          message: 'Invalid token',
        });
      }
    });

    it('should handle non-string auth token', async () => {
      const client = {
        handshake: {
          auth: { token: 123 as unknown as string }, // Non-string token
          headers: {},
        },
        data: {} as Record<string, unknown>,
      };
      const context = createMockExecutionContext(client);

      await expect(guard.canActivate(context)).rejects.toThrow(WsException);
    });
  });
});
