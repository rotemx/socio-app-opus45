import { z } from 'zod';

/**
 * Environment variables validation schema using Zod
 */
export const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),

  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().url().optional(),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  // CORS - must be explicitly configured in production
  CORS_ORIGIN: z.string(),

  // 100ms (Voice/Video)
  HMS_ACCESS_KEY: z.string().optional(),
  HMS_SECRET: z.string().optional(),
  HMS_TEMPLATE_ID: z.string().optional(),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Twilio (Phone Verification)
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_VERIFY_SERVICE_SID: z.string().optional(),

  // AWS Configuration
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  AWS_REGION: z.string().default('il-central-1'),
  AWS_CLOUDFRONT_URL: z.string().url().optional(),
  AWS_SECRETS_DB_ARN: z.string().optional(), // ARN for database credentials in Secrets Manager
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validate environment variables on application startup
 */
export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const errors = result.error.errors
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');

    throw new Error(`Environment validation failed:\n${errors}`);
  }

  return result.data;
}
