// Auth module exports
export { AuthModule } from './auth.module';
export { AuthService } from './auth.service';
export { AuthController } from './auth.controller';
export { PasswordService } from './password.service';
export { GoogleOAuthService, type GoogleUserInfo } from './google-oauth.service';
export { AppleOAuthService, type AppleUserInfo } from './apple-oauth.service';
export { TwilioService, type VerificationStatus } from './twilio.service';
export { JwtStrategy } from './strategies/jwt.strategy';
export { CurrentUser } from './decorators/current-user.decorator';

// DTOs
export * from './dto/auth.dto';

// Types
export type {
  AccessTokenPayload,
  RefreshTokenPayload,
  TokenPair,
  AuthenticatedUser,
} from './types/token.types';
