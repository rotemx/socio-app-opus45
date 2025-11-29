import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { AppConfigService } from '../../../config';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { AuthService } from '../auth.service';
import type { AccessTokenPayload } from '../types/token.types';

/**
 * JWT Strategy for Passport
 * Validates JWT tokens and attaches user to request
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: AppConfigService,
    private readonly authService: AuthService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.jwtSecret,
    });
  }

  /**
   * Validate the JWT payload and return user data
   * This method is called by Passport after token verification
   */
  async validate(payload: AccessTokenPayload): Promise<AccessTokenPayload> {
    // Verify this is an access token, not a refresh token
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Verify user exists and is active (using cached validation)
    const user = await this.authService.validateUser(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is deactivated');
    }

    // Shadow banned users can still access the API but their actions are limited
    // This is handled at the service level, not here

    return payload;
  }
}
