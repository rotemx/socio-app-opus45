import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  NotImplementedException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { type AuthService } from './auth.service';
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
  constructor(private readonly authService: AuthService) {}

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
   * Request phone verification code
   * POST /auth/phone/request
   */
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 3, windowSeconds: 60, keyPrefix: 'auth:phone:request' })
  @Post('phone/request')
  @HttpCode(HttpStatus.OK)
  async requestPhoneVerification(@Body() _dto: PhoneVerifyRequestDto) {
    // TODO: Implement Twilio phone verification (SOCIO-205)
    throw new NotImplementedException('Phone verification not yet implemented');
  }

  /**
   * Confirm phone verification code
   * POST /auth/phone/confirm
   */
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 5, windowSeconds: 60, keyPrefix: 'auth:phone:confirm' })
  @Post('phone/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmPhoneVerification(@Body() _dto: PhoneVerifyConfirmDto) {
    // TODO: Implement phone verification confirmation (SOCIO-205)
    throw new NotImplementedException('Phone verification confirmation not yet implemented');
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
