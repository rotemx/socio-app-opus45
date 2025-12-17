import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Password validation schema with complexity requirements
 * Enforces: min 8 chars, max 128 chars, lowercase, uppercase, and number
 */
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(128, 'Password must be at most 128 characters long')
  .refine((password) => /[a-z]/.test(password), {
    message: 'Password must contain at least one lowercase letter',
  })
  .refine((password) => /[A-Z]/.test(password), {
    message: 'Password must contain at least one uppercase letter',
  })
  .refine((password) => /[0-9]/.test(password), {
    message: 'Password must contain at least one number',
  });

// Login with email/password - relaxed validation for login (don't reveal password requirements)
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required').max(128),
});

// Register new user - strict password validation
const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be at most 50 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  email: z.string().email('Invalid email address'),
  password: passwordSchema,
  displayName: z.string().min(1).max(100).optional(),
});

// Phone verification request
// Supports both E.164 format (+1234567890) and local format with country code
const phoneVerifyRequestSchema = z.object({
  phone: z.string().min(7, 'Phone number is too short').max(20, 'Phone number is too long'),
  countryCode: z
    .string()
    .length(2, 'Country code must be 2 characters (e.g., US, IL)')
    .toUpperCase()
    .optional(),
});

// Phone verification confirm
const phoneVerifyConfirmSchema = z.object({
  phone: z.string().min(7, 'Phone number is too short').max(20, 'Phone number is too long'),
  code: z
    .string()
    .length(6, 'Verification code must be 6 digits')
    .regex(/^\d{6}$/, 'Verification code must contain only digits'),
  countryCode: z
    .string()
    .length(2, 'Country code must be 2 characters (e.g., US, IL)')
    .toUpperCase()
    .optional(),
});

// Refresh token
const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// OAuth callback (generic)
const oauthCallbackSchema = z.object({
  provider: z.enum(['google', 'apple']),
  code: z.string().min(1, 'Authorization code is required'),
  redirectUri: z.string().url().optional(),
});

// Google ID token login (mobile flow)
const googleIdTokenSchema = z.object({
  idToken: z.string().min(1, 'Google ID token is required'),
});

// Google authorization code login (web flow)
const googleCodeSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  redirectUri: z.string().url('Valid redirect URI is required'),
});

// Apple user info (only provided on first sign-in)
const appleUserSchema = z
  .object({
    name: z
      .object({
        firstName: z.string().optional(),
        lastName: z.string().optional(),
      })
      .optional(),
    email: z.string().email().optional(),
  })
  .optional();

// Apple identity token login (mobile flow)
const appleIdTokenSchema = z.object({
  identityToken: z.string().min(1, 'Apple identity token is required'),
  user: appleUserSchema,
});

// Apple authorization code login (web flow)
const appleCodeSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  redirectUri: z.string().url('Valid redirect URI is required'),
  user: appleUserSchema,
});

// JWT payload type
export const jwtPayloadSchema = z.object({
  sub: z.string().uuid(),
  email: z.string().email().optional(),
  username: z.string(),
  type: z.enum(['access', 'refresh']),
  deviceId: z.string().optional(),
  sessionId: z.string().optional(),
  iat: z.number(),
  exp: z.number(),
});

// DTO Classes
export class LoginDto extends createZodDto(loginSchema) {}
export class RegisterDto extends createZodDto(registerSchema) {}
export class PhoneVerifyRequestDto extends createZodDto(phoneVerifyRequestSchema) {}
export class PhoneVerifyConfirmDto extends createZodDto(phoneVerifyConfirmSchema) {}
export class RefreshTokenDto extends createZodDto(refreshTokenSchema) {}
export class OAuthCallbackDto extends createZodDto(oauthCallbackSchema) {}
export class GoogleIdTokenDto extends createZodDto(googleIdTokenSchema) {}
export class GoogleCodeDto extends createZodDto(googleCodeSchema) {}
export class AppleIdTokenDto extends createZodDto(appleIdTokenSchema) {}
export class AppleCodeDto extends createZodDto(appleCodeSchema) {}

// Types
export type JwtPayload = z.infer<typeof jwtPayloadSchema>;
