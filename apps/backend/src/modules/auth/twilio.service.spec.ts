import {
  BadRequestException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { TwilioService } from './twilio.service';
import type { AppConfigService } from '../../config';
import type { RedisService } from '../../redis';

describe('TwilioService', () => {
  let service: TwilioService;
  let configValues: {
    twilioAccountSid?: string;
    twilioAuthToken?: string;
    twilioVerifyServiceSid?: string;
  };
  let rateLimitResult: { allowed: boolean; remaining: number; resetAt: number };

  const mockTwilioVerificationResponse = {
    sid: 'VE123',
    service_sid: 'VA123',
    account_sid: 'AC123',
    to: '+972501234567',
    channel: 'sms',
    status: 'pending',
    valid: false,
    date_created: new Date().toISOString(),
    date_updated: new Date().toISOString(),
  };

  const mockTwilioVerificationCheckResponse = {
    sid: 'VE123',
    service_sid: 'VA123',
    account_sid: 'AC123',
    to: '+972501234567',
    channel: 'sms',
    status: 'approved',
    valid: true,
    date_created: new Date().toISOString(),
    date_updated: new Date().toISOString(),
  };

  const createMockConfigService = (): AppConfigService =>
    ({
      get twilioAccountSid() {
        return configValues.twilioAccountSid;
      },
      get twilioAuthToken() {
        return configValues.twilioAuthToken;
      },
      get twilioVerifyServiceSid() {
        return configValues.twilioVerifyServiceSid;
      },
    }) as AppConfigService;

  let redisConnected = true;

  const createMockRedisService = (): RedisService =>
    ({
      checkRateLimit: jest.fn().mockResolvedValue(rateLimitResult),
      isConnected: jest.fn().mockImplementation(() => redisConnected),
    }) as unknown as RedisService;

  beforeEach(() => {
    configValues = {
      twilioAccountSid: 'AC123',
      twilioAuthToken: 'test-auth-token',
      twilioVerifyServiceSid: 'VA123',
    };

    rateLimitResult = {
      allowed: true,
      remaining: 2,
      resetAt: Date.now() / 1000 + 600,
    };

    redisConnected = true;

    service = new TwilioService(createMockConfigService(), createMockRedisService());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('formatToE164', () => {
    it('should pass through valid E.164 numbers', () => {
      expect(service.formatToE164('+972501234567')).toBe('+972501234567');
      expect(service.formatToE164('+14155551234')).toBe('+14155551234');
    });

    it('should format Israeli numbers with country code', () => {
      expect(service.formatToE164('0501234567', 'IL')).toBe('+972501234567');
      expect(service.formatToE164('501234567', 'IL')).toBe('+972501234567');
    });

    it('should format US numbers with country code', () => {
      expect(service.formatToE164('4155551234', 'US')).toBe('+14155551234');
      expect(service.formatToE164('(415) 555-1234', 'US')).toBe('+14155551234');
    });

    it('should default to Israel for numbers starting with 0', () => {
      expect(service.formatToE164('0501234567')).toBe('+972501234567');
    });

    it('should assume US for 10-digit numbers without country code', () => {
      expect(service.formatToE164('4155551234')).toBe('+14155551234');
    });

    it('should strip non-digit characters', () => {
      expect(service.formatToE164('+1 (415) 555-1234')).toBe('+14155551234');
      expect(service.formatToE164('415.555.1234', 'US')).toBe('+14155551234');
    });

    it('should throw for invalid phone numbers', () => {
      expect(() => service.formatToE164('123')).toThrow(BadRequestException);
      expect(() => service.formatToE164('')).toThrow(BadRequestException);
    });

    it('should handle country codes case-insensitively', () => {
      expect(service.formatToE164('0501234567', 'il')).toBe('+972501234567');
      expect(service.formatToE164('4155551234', 'us')).toBe('+14155551234');
    });
  });

  describe('sendOtp', () => {
    it('should send OTP successfully', async () => {
      const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockTwilioVerificationResponse,
      } as Response);

      const result = await service.sendOtp('+972501234567');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://verify.twilio.com/v2/Services/VA123/Verifications',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        })
      );
      expect(result).toEqual({
        phone: '+972501234567',
        status: 'pending',
        valid: false,
      });
    });

    it('should format phone number before sending', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockTwilioVerificationResponse,
      } as Response);

      const result = await service.sendOtp('0501234567', 'IL');

      expect(result.phone).toBe('+972501234567');
    });

    it('should throw BadRequestException for invalid phone number', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        json: async () => ({ code: 60200, message: 'Invalid phone number' }),
      } as Response);

      await expect(service.sendOtp('+972501234567')).rejects.toThrow(
        new BadRequestException('Invalid phone number')
      );
    });

    it('should throw BadRequestException when max attempts reached', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          code: 60203,
          message: 'Max verification attempts reached',
        }),
      } as Response);

      await expect(service.sendOtp('+972501234567')).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException when Twilio not configured', async () => {
      configValues.twilioAccountSid = undefined;
      service = new TwilioService(createMockConfigService(), createMockRedisService());

      await expect(service.sendOtp('+972501234567')).rejects.toThrow(
        new InternalServerErrorException('Phone verification service not configured')
      );
    });

    it('should throw BadRequestException when rate limit exceeded', async () => {
      rateLimitResult = {
        allowed: false,
        remaining: 0,
        resetAt: Date.now() / 1000 + 300,
      };
      service = new TwilioService(createMockConfigService(), createMockRedisService());

      await expect(service.sendOtp('+972501234567')).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException for network errors', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

      await expect(service.sendOtp('+972501234567')).rejects.toThrow(
        new InternalServerErrorException('Failed to send verification code')
      );
    });

    it('should fail closed when Redis rate limiting throws an error', async () => {
      // Create a mock that throws an error (simulating Redis operation failure)
      const mockRedisService = {
        checkRateLimit: jest.fn().mockRejectedValue(new Error('Redis connection refused')),
        isConnected: jest.fn().mockReturnValue(true), // Connected but operation fails
      } as unknown as RedisService;

      const serviceWithBrokenRedis = new TwilioService(createMockConfigService(), mockRedisService);

      await expect(serviceWithBrokenRedis.sendOtp('+972501234567')).rejects.toThrow(
        new InternalServerErrorException(
          'Verification service temporarily unavailable. Please try again later.'
        )
      );
    });

    it('should fail closed when Redis is not connected', async () => {
      // Create a mock where Redis is disconnected
      const mockRedisService = {
        checkRateLimit: jest.fn(),
        isConnected: jest.fn().mockReturnValue(false),
      } as unknown as RedisService;

      const serviceWithDisconnectedRedis = new TwilioService(
        createMockConfigService(),
        mockRedisService
      );

      await expect(serviceWithDisconnectedRedis.sendOtp('+972501234567')).rejects.toThrow(
        new InternalServerErrorException(
          'Verification service temporarily unavailable. Please try again later.'
        )
      );

      // Verify checkRateLimit was never called since connection check failed first
      expect(mockRedisService.checkRateLimit).not.toHaveBeenCalled();
    });

    it('should fail closed when Redis disconnects during rate limit check (fail-open bypass prevention)', async () => {
      // Simulate RedisService's fail-open behavior: returns allowed=true with full remaining
      // when Redis operations fail internally
      let connectionCheckCount = 0;
      const mockRedisService = {
        checkRateLimit: jest.fn().mockResolvedValue({
          allowed: true,
          remaining: 3, // Full quota - suspicious if Redis actually failed
          resetAt: Date.now() / 1000 + 600,
        }),
        isConnected: jest.fn().mockImplementation(() => {
          connectionCheckCount++;
          // First check passes, second check (after rate limit) fails
          return connectionCheckCount <= 1;
        }),
      } as unknown as RedisService;

      const serviceWithFlakeyRedis = new TwilioService(createMockConfigService(), mockRedisService);

      await expect(serviceWithFlakeyRedis.sendOtp('+972501234567')).rejects.toThrow(
        new InternalServerErrorException(
          'Verification service temporarily unavailable. Please try again later.'
        )
      );
    });
  });

  describe('verifyOtp', () => {
    it('should verify OTP successfully', async () => {
      const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockTwilioVerificationCheckResponse,
      } as Response);

      const result = await service.verifyOtp('+972501234567', '123456');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://verify.twilio.com/v2/Services/VA123/VerificationCheck',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        })
      );
      expect(result).toEqual({
        phone: '+972501234567',
        status: 'approved',
        valid: true,
      });
    });

    it('should format phone number before verifying', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockTwilioVerificationCheckResponse,
      } as Response);

      const result = await service.verifyOtp('0501234567', '123456', 'IL');

      expect(result.phone).toBe('+972501234567');
    });

    it('should throw BadRequestException for invalid code format', async () => {
      await expect(service.verifyOtp('+972501234567', '12345')).rejects.toThrow(
        new BadRequestException('Invalid verification code format. Code must be 6 digits.')
      );

      await expect(service.verifyOtp('+972501234567', 'abcdef')).rejects.toThrow(
        new BadRequestException('Invalid verification code format. Code must be 6 digits.')
      );
    });

    it('should throw UnauthorizedException for expired code', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          code: 20404,
          message: 'Verification not found',
        }),
      } as Response);

      await expect(service.verifyOtp('+972501234567', '123456')).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('should throw UnauthorizedException for invalid code', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockTwilioVerificationCheckResponse,
          status: 'pending',
          valid: false,
        }),
      } as Response);

      await expect(service.verifyOtp('+972501234567', '123456')).rejects.toThrow(
        new UnauthorizedException('Invalid verification code')
      );
    });

    it('should throw InternalServerErrorException when Twilio not configured', async () => {
      configValues.twilioVerifyServiceSid = undefined;
      service = new TwilioService(createMockConfigService(), createMockRedisService());

      await expect(service.verifyOtp('+972501234567', '123456')).rejects.toThrow(
        new InternalServerErrorException('Phone verification service not configured')
      );
    });

    it('should throw InternalServerErrorException for network errors', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

      await expect(service.verifyOtp('+972501234567', '123456')).rejects.toThrow(
        new InternalServerErrorException('Failed to verify code')
      );
    });

    it('should throw BadRequestException when verify rate limit exceeded', async () => {
      // Create a mock that returns rate limit exceeded for verify operation
      const mockRedisService = {
        checkRateLimit: jest.fn().mockResolvedValue({
          allowed: false,
          remaining: 0,
          resetAt: Date.now() / 1000 + 300,
        }),
        isConnected: jest.fn().mockReturnValue(true),
      } as unknown as RedisService;

      const serviceWithRateLimit = new TwilioService(createMockConfigService(), mockRedisService);

      await expect(serviceWithRateLimit.verifyOtp('+972501234567', '123456')).rejects.toThrow(
        BadRequestException
      );
    });
  });
});
