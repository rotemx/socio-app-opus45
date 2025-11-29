import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { AuthService } from './auth.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { TwilioService } from './twilio.service';
import {
  type LoginDto,
  type RegisterDto,
  type RefreshTokenDto,
  type PhoneVerifyRequestDto,
  type PhoneVerifyConfirmDto,
  type OAuthCallbackDto,
  type GoogleIdTokenDto,
  type GoogleCodeDto,
  type AppleIdTokenDto,
  type AppleCodeDto,
} from './dto/auth.dto';
import { Public, RateLimit } from '../../common/decorators';
import { RateLimitGuard } from '../../common/guards';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AccessTokenPayload } from './types/token.types';

/**
 * Authentication Controller
 * Handles authentication endpoints for login, register, and token management
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly twilioService: TwilioService
  ) {}

  /**
   * Register a new user
   * POST /auth/register
   */
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 3, windowSeconds: 60, keyPrefix: 'auth:register' })
  @Post('register')
  async register(@Body() dto: RegisterDto, @Headers('x-device-id') deviceId?: string) {
    return this.authService.register(dto, deviceId);
  }

  /**
   * Login with email and password
   * POST /auth/login
   */
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 5, windowSeconds: 60, keyPrefix: 'auth:login' })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Headers('x-device-id') deviceId?: string) {
    return this.authService.login(dto, deviceId);
  }

  /**
   * Refresh access token
   * POST /auth/refresh
   */
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 20, windowSeconds: 60, keyPrefix: 'auth:refresh' })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshTokens(@Body() dto: RefreshTokenDto, @Headers('x-device-id') deviceId?: string) {
    return this.authService.refreshTokens(dto, deviceId);
  }

  /**
   * Logout current session
   * POST /auth/logout
   */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard('jwt'))
  async logout(
    @CurrentUser() user: AccessTokenPayload,
    @Headers('x-device-id') deviceId?: string
  ): Promise<void> {
    await this.authService.logout(user.sub, deviceId);
  }

  /**
   * Logout from all devices
   * POST /auth/logout-all
   */
  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard('jwt'))
  async logoutAll(@CurrentUser() user: AccessTokenPayload): Promise<void> {
    await this.authService.logoutAll(user.sub);
  }

  /**
   * Create a guest user
   * POST /auth/guest
   */
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 10, windowSeconds: 60, keyPrefix: 'auth:guest' })
  @Post('guest')
  async createGuest(@Headers('x-device-id') deviceId?: string) {
    return this.authService.createGuestUser(deviceId);
  }

  /**
   * Convert guest to full user
   * POST /auth/guest/convert
   */
  @Post('guest/convert')
  @UseGuards(AuthGuard('jwt'))
  async convertGuest(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: RegisterDto,
    @Headers('x-device-id') deviceId?: string
  ) {
    return this.authService.convertGuestToUser(user.sub, dto, deviceId);
  }

  /**
   * Request phone verification code (send OTP)
   * POST /auth/phone/send-otp
   *
   * Rate limited to 3 requests per phone number per 10 minutes
   * (enforced in TwilioService, not here, since we need per-phone limiting)
   */
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 10, windowSeconds: 60, keyPrefix: 'auth:phone:send' })
  @Post('phone/send-otp')
  @HttpCode(HttpStatus.OK)
  async sendPhoneOtp(@Body() dto: PhoneVerifyRequestDto) {
    const result = await this.twilioService.sendOtp(dto.phone, dto.countryCode);
    return {
      message: 'Verification code sent',
      phone: result.phone,
    };
  }

  /**
   * Verify phone OTP code
   * POST /auth/phone/verify-otp
   *
   * On successful verification, can optionally link phone to authenticated user
   */
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 10, windowSeconds: 60, keyPrefix: 'auth:phone:verify' })
  @Post('phone/verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyPhoneOtp(@Body() dto: PhoneVerifyConfirmDto) {
    // Verify the OTP
    const result = await this.twilioService.verifyOtp(dto.phone, dto.code, dto.countryCode);

    // Return success - the caller can use this to proceed with phone-based auth
    // or link the verified phone to their account
    return {
      message: 'Phone verified successfully',
      phone: result.phone,
      verified: result.valid,
    };
  }

  /**
   * Legacy endpoint - redirects to send-otp
   * POST /auth/phone/request
   * @deprecated Use POST /auth/phone/send-otp instead
   */
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 10, windowSeconds: 60, keyPrefix: 'auth:phone:send' })
  @Post('phone/request')
  @HttpCode(HttpStatus.OK)
  async requestPhoneVerification(@Body() dto: PhoneVerifyRequestDto) {
    return this.sendPhoneOtp(dto);
  }

  /**
   * Legacy endpoint - redirects to verify-otp
   * POST /auth/phone/confirm
   * @deprecated Use POST /auth/phone/verify-otp instead
   */
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 10, windowSeconds: 60, keyPrefix: 'auth:phone:verify' })
  @Post('phone/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmPhoneVerification(@Body() dto: PhoneVerifyConfirmDto) {
    return this.verifyPhoneOtp(dto);
  }

  /**
   * OAuth callback handler (generic)
   * POST /auth/oauth/callback
   */
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 10, windowSeconds: 60, keyPrefix: 'auth:oauth' })
  @Post('oauth/callback')
  @HttpCode(HttpStatus.OK)
  async oauthCallback(@Body() dto: OAuthCallbackDto, @Headers('x-device-id') deviceId?: string) {
    if (dto.provider === 'google') {
      if (!dto.redirectUri) {
        throw new BadRequestException('Redirect URI is required for Google OAuth code flow');
      }
      return this.authService.loginWithGoogleCode(dto.code, dto.redirectUri, deviceId);
    }
    if (dto.provider === 'apple') {
      if (!dto.redirectUri) {
        throw new BadRequestException('Redirect URI is required for Apple OAuth code flow');
      }
      return this.authService.loginWithAppleCode(dto.code, dto.redirectUri, undefined, deviceId);
    }
    throw new BadRequestException('Unsupported OAuth provider');
  }

  /**
   * Google OAuth with ID token (mobile flow)
   * POST /auth/google/token
   *
   * For mobile apps using Google Sign-In SDK that provides an ID token
   */
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 10, windowSeconds: 60, keyPrefix: 'auth:google:token' })
  @Post('google/token')
  @HttpCode(HttpStatus.OK)
  async googleIdTokenLogin(
    @Body() dto: GoogleIdTokenDto,
    @Headers('x-device-id') deviceId?: string
  ) {
    return this.authService.loginWithGoogleIdToken(dto.idToken, deviceId);
  }

  /**
   * Google OAuth with authorization code (web flow)
   * POST /auth/google/code
   *
   * For web apps using OAuth redirect flow
   */
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 10, windowSeconds: 60, keyPrefix: 'auth:google:code' })
  @Post('google/code')
  @HttpCode(HttpStatus.OK)
  async googleCodeLogin(@Body() dto: GoogleCodeDto, @Headers('x-device-id') deviceId?: string) {
    return this.authService.loginWithGoogleCode(dto.code, dto.redirectUri, deviceId);
  }

  /**
   * Apple Sign-In with identity token (mobile flow)
   * POST /auth/apple/token
   *
   * For mobile apps using Sign in with Apple SDK
   * Note: user info (name, email) is only provided on FIRST sign-in
   */
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 10, windowSeconds: 60, keyPrefix: 'auth:apple:token' })
  @Post('apple/token')
  @HttpCode(HttpStatus.OK)
  async appleIdTokenLogin(@Body() dto: AppleIdTokenDto, @Headers('x-device-id') deviceId?: string) {
    return this.authService.loginWithAppleIdToken(dto.identityToken, dto.user, deviceId);
  }

  /**
   * Apple Sign-In with authorization code (web flow)
   * POST /auth/apple/code
   *
   * For web apps using OAuth redirect flow
   */
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 10, windowSeconds: 60, keyPrefix: 'auth:apple:code' })
  @Post('apple/code')
  @HttpCode(HttpStatus.OK)
  async appleCodeLogin(@Body() dto: AppleCodeDto, @Headers('x-device-id') deviceId?: string) {
    return this.authService.loginWithAppleCode(dto.code, dto.redirectUri, dto.user, deviceId);
  }
}
