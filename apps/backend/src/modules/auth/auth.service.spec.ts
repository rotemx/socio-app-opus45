import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { PrismaService } from '../../database';
import type { AppConfigService } from '../../config';
import type { JwtService } from '@nestjs/jwt';
import type { PasswordService } from './password.service';
import type { GoogleOAuthService } from './google-oauth.service';
import type { AppleOAuthService } from './apple-oauth.service';
import type { RedisService } from '../../redis';

describe('AuthService', () => {
  let service: AuthService;
  let mockPrismaService: jest.Mocked<Pick<PrismaService, 'user' | 'refreshToken'>>;
  let mockConfigService: Partial<AppConfigService>;
  let mockJwtService: jest.Mocked<Pick<JwtService, 'sign' | 'verify'>>;
  let mockPasswordService: jest.Mocked<Pick<PasswordService, 'hash' | 'verify'>>;
  let mockGoogleOAuthService: jest.Mocked<
    Pick<GoogleOAuthService, 'verifyIdToken' | 'exchangeCodeForUserInfo'>
  >;
  let mockAppleOAuthService: jest.Mocked<
    Pick<AppleOAuthService, 'verifyIdentityToken' | 'exchangeCodeForUserInfo'>
  >;
  let mockRedisService: jest.Mocked<Pick<RedisService, 'getOrSet' | 'setJson' | 'getJson'>>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPrismaService = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      } as unknown as jest.Mocked<PrismaService['user']>,
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      } as unknown as jest.Mocked<PrismaService['refreshToken']>,
    };

    mockConfigService = {
      jwtSecret: 'test-secret-key-minimum-32-characters-long',
      jwtExpiry: '15m',
      jwtRefreshExpiry: '7d',
    } as const;

    mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    mockPasswordService = {
      hash: jest.fn(),
      verify: jest.fn(),
    };

    mockGoogleOAuthService = {
      verifyIdToken: jest.fn(),
      exchangeCodeForUserInfo: jest.fn(),
    };

    mockAppleOAuthService = {
      verifyIdentityToken: jest.fn(),
      exchangeCodeForUserInfo: jest.fn(),
    };

    mockRedisService = {
      getOrSet: jest.fn(),
      setJson: jest.fn(),
      getJson: jest.fn(),
    };

    // Create service instance directly
    service = new AuthService(
      mockPrismaService as unknown as PrismaService,
      mockConfigService as AppConfigService,
      mockJwtService as unknown as JwtService,
      mockPasswordService as unknown as PasswordService,
      mockGoogleOAuthService as unknown as GoogleOAuthService,
      mockAppleOAuthService as unknown as AppleOAuthService,
      mockRedisService as unknown as RedisService
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    const registerDto = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'Password123',
    };

    it('should register a new user successfully', async () => {
      (mockPrismaService.user.findFirst as jest.Mock).mockResolvedValue(null);
      mockPasswordService.hash.mockResolvedValue('hashed-password');
      (mockPrismaService.user.create as jest.Mock).mockResolvedValue({
        id: 'user-id',
        username: 'testuser',
        email: 'test@example.com',
      });
      mockJwtService.sign.mockReturnValue('mock-token');
      (mockPrismaService.refreshToken.create as jest.Mock).mockResolvedValue({});

      const result = await service.register(registerDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('expiresIn');
      expect(mockPasswordService.hash).toHaveBeenCalledWith('Password123');
      expect(mockPrismaService.user.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if email exists', async () => {
      (mockPrismaService.user.findFirst as jest.Mock).mockResolvedValue({
        email: 'test@example.com',
      });

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
      await expect(service.register(registerDto)).rejects.toThrow('Email already registered');
    });

    it('should throw ConflictException if username exists', async () => {
      (mockPrismaService.user.findFirst as jest.Mock).mockResolvedValue({
        username: 'testuser',
        email: 'other@example.com',
      });

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
      await expect(service.register(registerDto)).rejects.toThrow('Username already taken');
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'Password123',
    };

    it('should login successfully with valid credentials', async () => {
      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        username: 'testuser',
        passwordHash: 'hashed-password',
        isActive: true,
      });
      mockPasswordService.verify.mockResolvedValue(true);
      (mockPrismaService.user.update as jest.Mock).mockResolvedValue({});
      mockJwtService.sign.mockReturnValue('mock-token');
      (mockPrismaService.refreshToken.create as jest.Mock).mockResolvedValue({});

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(mockPasswordService.verify).toHaveBeenCalledWith('Password123', 'hashed-password');
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('Invalid email or password');
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-id',
        passwordHash: 'hashed-password',
        isActive: true,
      });
      mockPasswordService.verify.mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for deactivated account', async () => {
      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-id',
        passwordHash: 'hashed-password',
        isActive: false,
      });
      mockPasswordService.verify.mockResolvedValue(true);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('Account is deactivated');
    });
  });

  describe('refreshTokens', () => {
    const refreshDto = { refreshToken: 'valid-refresh-token' };

    it('should refresh tokens successfully', async () => {
      const mockPayload = {
        sub: 'user-id',
        type: 'refresh',
        family: 'token-family',
      };
      mockJwtService.verify.mockReturnValue(mockPayload);
      (mockPrismaService.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'token-id',
        family: 'token-family',
        isRevoked: false,
        expiresAt: new Date(Date.now() + 86400000),
        deviceId: 'device-1',
        user: {
          id: 'user-id',
          email: 'test@example.com',
          username: 'testuser',
          isActive: true,
        },
      });
      (mockPrismaService.refreshToken.update as jest.Mock).mockResolvedValue({});
      mockJwtService.sign.mockReturnValue('new-token');
      (mockPrismaService.refreshToken.create as jest.Mock).mockResolvedValue({});

      const result = await service.refreshTokens(refreshDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(mockPrismaService.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'token-id' },
        data: { isRevoked: true },
      });
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refreshTokens(refreshDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for revoked token', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'user-id',
        type: 'refresh',
        family: 'token-family',
      });
      (mockPrismaService.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'token-id',
        family: 'token-family',
        isRevoked: true,
        user: { isActive: true },
      });
      (mockPrismaService.refreshToken.updateMany as jest.Mock).mockResolvedValue({});

      await expect(service.refreshTokens(refreshDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.refreshTokens(refreshDto)).rejects.toThrow('Token has been revoked');
    });

    it('should revoke token family on token reuse detection', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'user-id',
        type: 'refresh',
        family: 'token-family',
      });
      (mockPrismaService.refreshToken.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrismaService.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 2 });

      await expect(service.refreshTokens(refreshDto)).rejects.toThrow(UnauthorizedException);
      expect(mockPrismaService.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { family: 'token-family' },
        data: { isRevoked: true },
      });
    });
  });

  describe('logout', () => {
    it('should logout user from all devices', async () => {
      (mockPrismaService.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 3 });

      await service.logout('user-id');

      expect(mockPrismaService.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-id',
          isRevoked: false,
        },
        data: { isRevoked: true },
      });
    });

    it('should logout user from specific device', async () => {
      (mockPrismaService.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      await service.logout('user-id', 'device-1');

      expect(mockPrismaService.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-id',
          deviceId: 'device-1',
          isRevoked: false,
        },
        data: { isRevoked: true },
      });
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid access token', async () => {
      const mockPayload = {
        sub: 'user-id',
        type: 'access',
        username: 'testuser',
      };
      mockJwtService.verify.mockReturnValue(mockPayload);

      const result = await service.verifyAccessToken('valid-token');

      expect(result).toEqual(mockPayload);
    });

    it('should throw UnauthorizedException for refresh token used as access token', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'user-id',
        type: 'refresh',
      });

      await expect(service.verifyAccessToken('refresh-token')).rejects.toThrow(
        UnauthorizedException
      );
    });
  });

  describe('createGuestUser', () => {
    it('should create a guest user', async () => {
      (mockPrismaService.user.create as jest.Mock).mockResolvedValue({
        id: 'guest-id',
        username: 'guest_abcd1234',
        isGuest: true,
      });
      mockJwtService.sign.mockReturnValue('guest-token');
      (mockPrismaService.refreshToken.create as jest.Mock).mockResolvedValue({});

      const result = await service.createGuestUser('device-1');

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('tokens');
      expect(result.user.roles).toContain('guest');
      expect(mockPrismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isGuest: true,
          }),
        })
      );
    });
  });

  describe('convertGuestToUser', () => {
    const registerDto = {
      username: 'newuser',
      email: 'new@example.com',
      password: 'Password123',
    };

    it('should convert guest to full user', async () => {
      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'guest-id',
        isGuest: true,
      });
      (mockPrismaService.user.findFirst as jest.Mock).mockResolvedValue(null);
      mockPasswordService.hash.mockResolvedValue('hashed-password');
      (mockPrismaService.user.update as jest.Mock).mockResolvedValue({
        id: 'guest-id',
        username: 'newuser',
        email: 'new@example.com',
        isGuest: false,
      });
      (mockPrismaService.refreshToken.updateMany as jest.Mock).mockResolvedValue({});
      mockJwtService.sign.mockReturnValue('new-token');
      (mockPrismaService.refreshToken.create as jest.Mock).mockResolvedValue({});

      const result = await service.convertGuestToUser('guest-id', registerDto);

      expect(result).toHaveProperty('accessToken');
      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isGuest: false,
            guestExpiresAt: null,
          }),
        })
      );
    });

    it('should throw BadRequestException for non-guest user', async () => {
      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-id',
        isGuest: false,
      });

      await expect(service.convertGuestToUser('user-id', registerDto)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw BadRequestException for non-existent user', async () => {
      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.convertGuestToUser('fake-id', registerDto)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should delete expired and revoked tokens', async () => {
      (mockPrismaService.refreshToken.deleteMany as jest.Mock).mockResolvedValue({ count: 5 });

      const count = await service.cleanupExpiredTokens();

      expect(count).toBe(5);
      expect(mockPrismaService.refreshToken.deleteMany).toHaveBeenCalled();
    });
  });
});
