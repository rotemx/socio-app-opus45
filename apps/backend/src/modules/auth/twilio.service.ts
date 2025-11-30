import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { z } from 'zod';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { AppConfigService } from '../../config';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { RedisService } from '../../redis';

/**
 * Phone verification status returned by Twilio Verify
 */
export interface VerificationStatus {
  /** The phone number being verified */
  phone: string;
  /** Status: 'pending', 'approved', 'canceled', etc. */
  status: string;
  /** Whether the verification was successful */
  valid: boolean;
}

/**
 * Zod schema for Twilio API error response
 */
const TwilioErrorResponseSchema = z.object({
  code: z.number(),
  message: z.string(),
  more_info: z.string().optional(),
  status: z.number().optional(),
});

/**
 * Zod schema for Twilio Verify API response for creating a verification
 */
const TwilioVerificationResponseSchema = z.object({
  sid: z.string(),
  service_sid: z.string(),
  account_sid: z.string(),
  to: z.string(),
  channel: z.string(),
  status: z.string(),
  valid: z.boolean(),
  date_created: z.string(),
  date_updated: z.string(),
});

/**
 * Zod schema for Twilio Verify API response for checking a verification
 */
const TwilioVerificationCheckResponseSchema = z.object({
  sid: z.string(),
  service_sid: z.string(),
  account_sid: z.string(),
  to: z.string(),
  channel: z.string(),
  status: z.string(),
  valid: z.boolean(),
  date_created: z.string(),
  date_updated: z.string(),
});

/**
 * Country code mapping for common countries
 * Used for country code detection when not explicitly provided
 */
const COUNTRY_CODE_MAP: Record<string, string> = {
  US: '+1',
  IL: '+972',
  GB: '+44',
  DE: '+49',
  FR: '+33',
  ES: '+34',
  IT: '+39',
  CA: '+1',
  AU: '+61',
  BR: '+55',
  MX: '+52',
  IN: '+91',
  CN: '+86',
  JP: '+81',
  KR: '+82',
  RU: '+7',
};

/**
 * Twilio Service
 * Handles phone verification using Twilio Verify API
 *
 * Features:
 * - Send OTP via SMS
 * - Verify OTP codes
 * - Rate limiting per phone number
 * - E.164 phone number formatting
 */
@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);
  private readonly TWILIO_API_BASE = 'https://verify.twilio.com/v2';
  private readonly RATE_LIMIT_SEND_KEY_PREFIX = 'phone:otp:send';
  private readonly RATE_LIMIT_VERIFY_KEY_PREFIX = 'phone:otp:verify';
  private readonly RATE_LIMIT_SEND_MAX_ATTEMPTS = 3;
  private readonly RATE_LIMIT_VERIFY_MAX_ATTEMPTS = 5; // Allow more verify attempts than sends
  private readonly RATE_LIMIT_WINDOW_SECONDS = 600; // 10 minutes

  constructor(
    private readonly config: AppConfigService,
    private readonly redisService: RedisService
  ) {}

  /**
   * Check if Twilio is configured
   */
  private ensureTwilioConfigured(): void {
    if (
      !this.config.twilioAccountSid ||
      !this.config.twilioAuthToken ||
      !this.config.twilioVerifyServiceSid
    ) {
      this.logger.error('Twilio credentials not configured');
      throw new InternalServerErrorException('Phone verification service not configured');
    }
  }

  /**
   * Format a phone number to E.164 format
   *
   * @param phone - The phone number to format
   * @param countryCode - Optional 2-letter country code (e.g., 'US', 'IL')
   * @returns E.164 formatted phone number
   */
  formatToE164(phone: string, countryCode?: string): string {
    // Remove all non-digit characters except leading +
    let cleaned = phone.replace(/[^\d+]/g, '');

    // If already in E.164 format (starts with +), validate and return
    if (cleaned.startsWith('+')) {
      // Validate E.164 format: + followed by 1-15 digits
      if (/^\+[1-9]\d{1,14}$/.test(cleaned)) {
        return cleaned;
      }
      // Remove the + and try to reformat
      cleaned = cleaned.slice(1);
    }

    // If country code provided, add it
    if (countryCode) {
      const prefix = COUNTRY_CODE_MAP[countryCode.toUpperCase()];
      if (prefix) {
        // Remove leading zeros (common in some countries)
        cleaned = cleaned.replace(/^0+/, '');
        return `${prefix}${cleaned}`;
      }
    }

    // Default to Israel (+972) if no country code and number starts with 0
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.slice(1);
      return `+972${cleaned}`;
    }

    // If number is 10 digits and no + prefix, assume US
    if (cleaned.length === 10 && /^\d{10}$/.test(cleaned)) {
      return `+1${cleaned}`;
    }

    // Otherwise, add + prefix if valid length (minimum 7 digits for valid phone numbers)
    // E.164 allows 1-15 digits, but real phone numbers are at least 7 digits
    if (/^[1-9]\d{6,14}$/.test(cleaned)) {
      return `+${cleaned}`;
    }

    throw new BadRequestException(
      'Invalid phone number format. Please provide a valid phone number with country code.'
    );
  }

  /**
   * Check rate limit for phone verification operations
   *
   * SECURITY: This fails CLOSED - if Redis is unavailable, requests are rejected
   * to prevent SMS bombing attacks and cost abuse.
   *
   * @param phone - E.164 formatted phone number
   * @param operation - 'send' for OTP sending, 'verify' for OTP verification
   * @throws BadRequestException if rate limit exceeded
   * @throws InternalServerErrorException if rate limiting service unavailable
   */
  private async checkRateLimit(phone: string, operation: 'send' | 'verify'): Promise<void> {
    const keyPrefix =
      operation === 'send' ? this.RATE_LIMIT_SEND_KEY_PREFIX : this.RATE_LIMIT_VERIFY_KEY_PREFIX;
    const maxAttempts =
      operation === 'send'
        ? this.RATE_LIMIT_SEND_MAX_ATTEMPTS
        : this.RATE_LIMIT_VERIFY_MAX_ATTEMPTS;
    const key = `${keyPrefix}:${phone}`;

    try {
      // SECURITY: First verify Redis is connected before checking rate limit
      // This prevents bypass via RedisService's fail-open behavior
      if (!this.redisService.isConnected()) {
        this.logger.error(`Redis not connected - failing closed for phone ${operation} rate limit`);
        throw new InternalServerErrorException(
          'Verification service temporarily unavailable. Please try again later.'
        );
      }

      const result = await this.redisService.checkRateLimit(
        key,
        maxAttempts,
        this.RATE_LIMIT_WINDOW_SECONDS
      );

      // SECURITY: Detect if RedisService returned a fail-open response
      // When Redis fails, it returns remaining === limit (full quota) which is suspicious
      // during an active rate limiting check
      if (result.allowed && result.remaining === maxAttempts) {
        // This could be legitimate (first request) or fail-open
        // Verify Redis is still connected to distinguish
        if (!this.redisService.isConnected()) {
          this.logger.error(
            `Redis disconnected during ${operation} rate limit check - failing closed`
          );
          throw new InternalServerErrorException(
            'Verification service temporarily unavailable. Please try again later.'
          );
        }
      }

      if (!result.allowed) {
        const minutesRemaining = Math.ceil((result.resetAt - Date.now() / 1000) / 60);
        this.logger.warn(`Rate limit exceeded for phone ${operation}: ${this.maskPhone(phone)}`);
        throw new BadRequestException(
          `Too many ${operation === 'send' ? 'verification' : 'code check'} attempts. Please try again in ${minutesRemaining} minute${minutesRemaining === 1 ? '' : 's'}.`
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
        throw error;
      }
      // SECURITY: Fail CLOSED - reject request if rate limiting unavailable
      // This prevents SMS bombing attacks if Redis goes down
      this.logger.error(
        `Rate limit check failed (failing closed): ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw new InternalServerErrorException(
        'Verification service temporarily unavailable. Please try again later.'
      );
    }
  }

  /**
   * Send OTP verification code to a phone number
   *
   * @param phone - Phone number (will be formatted to E.164)
   * @param countryCode - Optional 2-letter country code
   * @returns Verification status
   */
  async sendOtp(phone: string, countryCode?: string): Promise<VerificationStatus> {
    this.ensureTwilioConfigured();

    // Format phone to E.164
    const formattedPhone = this.formatToE164(phone, countryCode);
    this.logger.log(`Sending OTP to: ${this.maskPhone(formattedPhone)}`);

    // Check rate limit for send operation
    await this.checkRateLimit(formattedPhone, 'send');

    try {
      const response = await fetch(
        `${this.TWILIO_API_BASE}/Services/${this.config.twilioVerifyServiceSid}/Verifications`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(`${this.config.twilioAccountSid}:${this.config.twilioAuthToken}`).toString('base64')}`,
          },
          body: new URLSearchParams({
            To: formattedPhone,
            Channel: 'sms',
          }),
        }
      );

      if (!response.ok) {
        const parseResult = TwilioErrorResponseSchema.safeParse(await response.json());
        if (!parseResult.success) {
          this.logger.error(`Invalid Twilio error response format: ${parseResult.error.message}`);
          throw new InternalServerErrorException('Failed to send verification code');
        }
        const errorBody = parseResult.data;
        this.logger.error(
          `Twilio verification failed: ${errorBody.message} (code: ${errorBody.code})`
        );

        // Handle specific Twilio error codes
        if (errorBody.code === 60200) {
          throw new BadRequestException('Invalid phone number');
        }
        if (errorBody.code === 60203) {
          throw new BadRequestException(
            'Maximum verification attempts reached for this phone number'
          );
        }
        if (errorBody.code === 60212) {
          throw new BadRequestException('Phone number is blocked for verification');
        }

        throw new InternalServerErrorException('Failed to send verification code');
      }

      const parseResult = TwilioVerificationResponseSchema.safeParse(await response.json());
      if (!parseResult.success) {
        this.logger.error(`Invalid Twilio verification response format: ${parseResult.error.message}`);
        throw new InternalServerErrorException('Failed to send verification code');
      }
      const result = parseResult.data;

      this.logger.log(
        `OTP sent successfully to: ${this.maskPhone(formattedPhone)}, status: ${result.status}`
      );

      return {
        phone: formattedPhone,
        status: result.status,
        valid: result.valid,
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error(
        `Failed to send OTP: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw new InternalServerErrorException('Failed to send verification code');
    }
  }

  /**
   * Verify OTP code for a phone number
   *
   * @param phone - Phone number (will be formatted to E.164)
   * @param code - 6-digit OTP code
   * @param countryCode - Optional 2-letter country code
   * @returns Verification status
   */
  async verifyOtp(phone: string, code: string, countryCode?: string): Promise<VerificationStatus> {
    this.ensureTwilioConfigured();

    // Format phone to E.164
    const formattedPhone = this.formatToE164(phone, countryCode);
    this.logger.log(`Verifying OTP for: ${this.maskPhone(formattedPhone)}`);

    // Validate code format first (cheap check before rate limit)
    if (!/^\d{6}$/.test(code)) {
      throw new BadRequestException('Invalid verification code format. Code must be 6 digits.');
    }

    // Check rate limit for verify operation (prevents brute-force attacks)
    await this.checkRateLimit(formattedPhone, 'verify');

    try {
      const response = await fetch(
        `${this.TWILIO_API_BASE}/Services/${this.config.twilioVerifyServiceSid}/VerificationCheck`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(`${this.config.twilioAccountSid}:${this.config.twilioAuthToken}`).toString('base64')}`,
          },
          body: new URLSearchParams({
            To: formattedPhone,
            Code: code,
          }),
        }
      );

      if (!response.ok) {
        const parseResult = TwilioErrorResponseSchema.safeParse(await response.json());
        if (!parseResult.success) {
          this.logger.error(`Invalid Twilio error response format: ${parseResult.error.message}`);
          throw new InternalServerErrorException('Failed to verify code');
        }
        const errorBody = parseResult.data;
        this.logger.error(
          `Twilio verification check failed: ${errorBody.message} (code: ${errorBody.code})`
        );

        // Handle specific Twilio error codes
        if (errorBody.code === 20404) {
          throw new UnauthorizedException(
            'Verification code expired or not found. Please request a new code.'
          );
        }
        if (errorBody.code === 60202) {
          throw new BadRequestException('Maximum verification check attempts reached');
        }

        throw new InternalServerErrorException('Failed to verify code');
      }

      const parseResult = TwilioVerificationCheckResponseSchema.safeParse(await response.json());
      if (!parseResult.success) {
        this.logger.error(`Invalid Twilio verification check response format: ${parseResult.error.message}`);
        throw new InternalServerErrorException('Failed to verify code');
      }
      const result = parseResult.data;

      this.logger.log(
        `OTP verification result for ${this.maskPhone(formattedPhone)}: status=${result.status}, valid=${result.valid}`
      );

      if (result.status !== 'approved' || !result.valid) {
        throw new UnauthorizedException('Invalid verification code');
      }

      return {
        phone: formattedPhone,
        status: result.status,
        valid: result.valid,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      this.logger.error(
        `Failed to verify OTP: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw new InternalServerErrorException('Failed to verify code');
    }
  }

  /**
   * Mask phone number for logging (show only last 4 digits)
   */
  private maskPhone(phone: string): string {
    if (phone.length <= 4) {
      return '****';
    }
    return `${'*'.repeat(phone.length - 4)}${phone.slice(-4)}`;
  }
}
