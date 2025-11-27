import { Injectable } from '@nestjs/common';
import { type EnvConfig } from './env.validation';

/**
 * Configuration service for type-safe access to environment variables
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly envConfig: EnvConfig) {}

  get nodeEnv(): string {
    return this.envConfig.NODE_ENV;
  }

  get isProduction(): boolean {
    return this.envConfig.NODE_ENV === 'production';
  }

  get isDevelopment(): boolean {
    return this.envConfig.NODE_ENV === 'development';
  }

  get isTest(): boolean {
    return this.envConfig.NODE_ENV === 'test';
  }

  get port(): number {
    return this.envConfig.PORT;
  }

  get databaseUrl(): string {
    return this.envConfig.DATABASE_URL;
  }

  get redisUrl(): string | undefined {
    return this.envConfig.REDIS_URL;
  }

  get jwtSecret(): string {
    return this.envConfig.JWT_SECRET;
  }

  get jwtExpiry(): string {
    return this.envConfig.JWT_EXPIRY;
  }

  get jwtRefreshExpiry(): string {
    return this.envConfig.JWT_REFRESH_EXPIRY;
  }

  get corsOrigin(): string {
    return this.envConfig.CORS_ORIGIN;
  }

  // 100ms config
  get hmsAccessKey(): string | undefined {
    return this.envConfig.HMS_ACCESS_KEY;
  }

  get hmsSecret(): string | undefined {
    return this.envConfig.HMS_SECRET;
  }

  get hmsTemplateId(): string | undefined {
    return this.envConfig.HMS_TEMPLATE_ID;
  }

  // Twilio config
  get twilioAccountSid(): string | undefined {
    return this.envConfig.TWILIO_ACCOUNT_SID;
  }

  get twilioAuthToken(): string | undefined {
    return this.envConfig.TWILIO_AUTH_TOKEN;
  }

  get twilioVerifyServiceSid(): string | undefined {
    return this.envConfig.TWILIO_VERIFY_SERVICE_SID;
  }

  // AWS config
  get awsAccessKeyId(): string | undefined {
    return this.envConfig.AWS_ACCESS_KEY_ID;
  }

  get awsSecretAccessKey(): string | undefined {
    return this.envConfig.AWS_SECRET_ACCESS_KEY;
  }

  get awsS3Bucket(): string | undefined {
    return this.envConfig.AWS_S3_BUCKET;
  }

  get awsRegion(): string {
    return this.envConfig.AWS_REGION;
  }
}
