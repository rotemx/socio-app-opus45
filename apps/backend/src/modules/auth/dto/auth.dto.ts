import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// Login with email/password
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

// Register new user
const registerSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(100).optional(),
});

// Phone verification request
const phoneVerifyRequestSchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Invalid phone number format'),
});

// Phone verification confirm
const phoneVerifyConfirmSchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/),
  code: z.string().length(6),
});

// Refresh token
const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// OAuth callback
const oauthCallbackSchema = z.object({
  provider: z.enum(['google', 'apple']),
  code: z.string().min(1, 'Authorization code is required'),
  redirectUri: z.string().url().optional(),
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

// Types
export type JwtPayload = z.infer<typeof jwtPayloadSchema>;
