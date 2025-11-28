import { InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { GoogleOAuthService } from './google-oauth.service';
import type { AppConfigService } from '../../config';

describe('GoogleOAuthService', () => {
  let service: GoogleOAuthService;
  let configValues: { googleClientId?: string; googleClientSecret?: string };

  const mockGoogleUserInfo = {
    sub: 'google-user-id',
    email: 'test@gmail.com',
    email_verified: 'true',
    name: 'Test User',
    given_name: 'Test',
    family_name: 'User',
    picture: 'https://lh3.googleusercontent.com/photo.jpg',
    exp: String(Math.floor(Date.now() / 1000) + 3600), // 1 hour from now
    aud: 'test-client-id',
  };

  const createMockConfigService = (): AppConfigService => ({
    get googleClientId() {
      return configValues.googleClientId;
    },
    get googleClientSecret() {
      return configValues.googleClientSecret;
    },
  }) as AppConfigService;

  beforeEach(() => {
    configValues = {
      googleClientId: 'test-client-id',
      googleClientSecret: 'test-client-secret',
    };

    service = new GoogleOAuthService(createMockConfigService());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('verifyIdToken', () => {
    it('should verify valid ID token and return user info', async () => {
      const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockGoogleUserInfo,
      } as Response);

      const result = await service.verifyIdToken('valid-id-token');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/tokeninfo?id_token=valid-id-token',
      );
      expect(result).toEqual({
        id: 'google-user-id',
        email: 'test@gmail.com',
        emailVerified: true,
        name: 'Test User',
        givenName: 'Test',
        familyName: 'User',
        picture: 'https://lh3.googleusercontent.com/photo.jpg',
      });
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        text: async () => 'Invalid token',
      } as Response);

      await expect(service.verifyIdToken('invalid-token')).rejects.toThrow(
        new UnauthorizedException('Invalid Google ID token'),
      );
    });

    it('should throw UnauthorizedException for token audience mismatch', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ ...mockGoogleUserInfo, aud: 'wrong-client-id' }),
      } as Response);

      await expect(service.verifyIdToken('token-with-wrong-aud')).rejects.toThrow(
        new UnauthorizedException('Invalid Google ID token audience'),
      );
    });

    it('should throw UnauthorizedException for expired token', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          ...mockGoogleUserInfo,
          exp: String(Math.floor(Date.now() / 1000) - 3600), // 1 hour ago
        }),
      } as Response);

      await expect(service.verifyIdToken('expired-token')).rejects.toThrow(
        new UnauthorizedException('Google ID token has expired'),
      );
    });

    it('should throw InternalServerErrorException when Google Client ID not configured', async () => {
      configValues.googleClientId = undefined;
      service = new GoogleOAuthService(createMockConfigService());

      await expect(service.verifyIdToken('any-token')).rejects.toThrow(
        new InternalServerErrorException('Google OAuth not configured'),
      );
    });

    it('should throw UnauthorizedException for network errors', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

      await expect(service.verifyIdToken('token')).rejects.toThrow(
        new UnauthorizedException('Failed to verify Google ID token'),
      );
    });
  });

  describe('exchangeCodeForUserInfo', () => {
    const mockTokenResponse = {
      access_token: 'access-token',
      expires_in: 3600,
      scope: 'openid email profile',
      token_type: 'Bearer',
      id_token: 'id-token',
    };

    it('should exchange code and return user info via id_token', async () => {
      const mockFetch = jest
        .spyOn(global, 'fetch')
        // First call: token exchange
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTokenResponse,
        } as Response)
        // Second call: verify id_token
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockGoogleUserInfo,
        } as Response);

      const result = await service.exchangeCodeForUserInfo('auth-code', 'https://example.com/callback');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        id: 'google-user-id',
        email: 'test@gmail.com',
        emailVerified: true,
        name: 'Test User',
        givenName: 'Test',
        familyName: 'User',
        picture: 'https://lh3.googleusercontent.com/photo.jpg',
      });
    });

    it('should exchange code and use userinfo endpoint when no id_token', async () => {
      const mockFetch = jest
        .spyOn(global, 'fetch')
        // First call: token exchange (no id_token)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ...mockTokenResponse, id_token: undefined }),
        } as Response)
        // Second call: userinfo endpoint
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            sub: 'google-user-id',
            email: 'test@gmail.com',
            email_verified: true,
            name: 'Test User',
            given_name: 'Test',
            family_name: 'User',
            picture: 'https://lh3.googleusercontent.com/photo.jpg',
          }),
        } as Response);

      const result = await service.exchangeCodeForUserInfo('auth-code', 'https://example.com/callback');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenLastCalledWith(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        expect.objectContaining({
          headers: { Authorization: 'Bearer access-token' },
        }),
      );
      expect(result.id).toBe('google-user-id');
    });

    it('should throw UnauthorizedException when code exchange fails', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        text: async () => 'Invalid grant',
      } as Response);

      await expect(
        service.exchangeCodeForUserInfo('invalid-code', 'https://example.com/callback'),
      ).rejects.toThrow(new UnauthorizedException('Failed to exchange authorization code'));
    });

    it('should throw InternalServerErrorException when credentials not configured', async () => {
      configValues.googleClientSecret = undefined;
      service = new GoogleOAuthService(createMockConfigService());

      await expect(
        service.exchangeCodeForUserInfo('code', 'https://example.com/callback'),
      ).rejects.toThrow(new InternalServerErrorException('Google OAuth not configured'));
    });

    it('should throw UnauthorizedException for network errors during exchange', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

      await expect(
        service.exchangeCodeForUserInfo('code', 'https://example.com/callback'),
      ).rejects.toThrow(new UnauthorizedException('Failed to exchange authorization code'));
    });
  });
});
