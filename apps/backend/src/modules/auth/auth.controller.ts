import { Body, Controller, HttpCode, HttpStatus, NotImplementedException, Post } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
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
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * Login with email and password
   * POST /auth/login
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * Refresh access token
   * POST /auth/refresh
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshTokens(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto);
  }

  /**
   * Create a guest user
   * POST /auth/guest
   */
  @Public()
  @Post('guest')
  async createGuest() {
    return this.authService.createGuestUser();
  }

  /**
   * Request phone verification code
   * POST /auth/phone/request
   */
  @Public()
  @Post('phone/request')
  @HttpCode(HttpStatus.OK)
  async requestPhoneVerification(@Body() _dto: PhoneVerifyRequestDto) {
    // TODO: Implement Twilio phone verification
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
    // TODO: Implement phone verification confirmation
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
    // TODO: Implement OAuth flow (Google, Apple)
    throw new NotImplementedException('OAuth callback not yet implemented');
  }
}
