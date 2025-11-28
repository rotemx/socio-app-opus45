import {
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
import { AuthService } from './auth.service';
import {
  type LoginDto,
  type RegisterDto,
  type RefreshTokenDto,
  type PhoneVerifyRequestDto,
  type PhoneVerifyConfirmDto,
  type OAuthCallbackDto,
} from './dto/auth.dto';
import { Public } from '../../common/decorators';
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
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Headers('x-device-id') deviceId?: string,
  ) {
    return this.authService.register(dto, deviceId);
  }

  /**
   * Login with email and password
   * POST /auth/login
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Headers('x-device-id') deviceId?: string,
  ) {
    return this.authService.login(dto, deviceId);
  }

  /**
   * Refresh access token
   * POST /auth/refresh
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshTokens(
    @Body() dto: RefreshTokenDto,
    @Headers('x-device-id') deviceId?: string,
  ) {
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
    @Headers('x-device-id') deviceId?: string,
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
    @Headers('x-device-id') deviceId?: string,
  ) {
    return this.authService.convertGuestToUser(user.sub, dto, deviceId);
  }

  /**
   * Request phone verification code
   * POST /auth/phone/request
   */
  @Public()
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
  @Post('phone/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmPhoneVerification(@Body() _dto: PhoneVerifyConfirmDto) {
    // TODO: Implement phone verification confirmation (SOCIO-205)
    throw new NotImplementedException('Phone verification confirmation not yet implemented');
  }

  /**
   * OAuth callback handler
   * POST /auth/oauth/callback
   */
  @Public()
  @Post('oauth/callback')
  @HttpCode(HttpStatus.OK)
  async oauthCallback(@Body() _dto: OAuthCallbackDto) {
    // TODO: Implement OAuth flow (Google, Apple) (SOCIO-203, SOCIO-204)
    throw new NotImplementedException('OAuth callback not yet implemented');
  }
}
