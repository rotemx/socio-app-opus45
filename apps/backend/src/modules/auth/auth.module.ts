import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { GoogleOAuthService } from './google-oauth.service';
import { AppleOAuthService } from './apple-oauth.service';
import { TwilioService } from './twilio.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AppConfigService } from '../../config';

/**
 * Authentication Module
 * Provides authentication and authorization functionality
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        secret: config.jwtSecret,
        signOptions: {
          // Expiry is configured per-token in AuthService
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    GoogleOAuthService,
    AppleOAuthService,
    TwilioService,
    JwtStrategy,
  ],
  exports: [
    AuthService,
    PasswordService,
    GoogleOAuthService,
    AppleOAuthService,
    TwilioService,
    JwtModule,
  ],
})
export class AuthModule {}
