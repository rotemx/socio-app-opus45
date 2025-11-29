import {
  Injectable,
  Logger,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import type { AuthProvider } from '@prisma/client';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { JwtService } from '@nestjs/jwt';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { PrismaService } from '../../database';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { AppConfigService } from '../../config';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { PasswordService } from './password.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { GoogleOAuthService, type GoogleUserInfo } from './google-oauth.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { AppleOAuthService, type AppleUserInfo } from './apple-oauth.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { RedisService } from '../../redis';
import type { LoginDto, RegisterDto, RefreshTokenDto } from './dto/auth.dto';

/**
 * Common OAuth user info structure
 * Used by handleOAuthLogin for both Google and Apple
 */
type OAuthUserInfo = GoogleUserInfo | AppleUserInfo;

/**
 * Helper to safely get picture from OAuth user (Google has it, Apple doesn't)
 */
function getOAuthPicture(user: OAuthUserInfo): string | undefined {
  return 'picture' in user ? user.picture : undefined;
}
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
  TokenPair,
  AuthenticatedUser,
} from './types/token.types';
import { randomUUID } from 'crypto';

/**
 * Authentication Service
 * Handles user authentication, token generation, and validation
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService,
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly appleOAuthService: AppleOAuthService,
    private readonly redisService: RedisService
  ) {}

  /**
   * Validate user existence and status with caching
   * Used by JwtStrategy and ChatGateway to prevent DB hits on every request
   */
  async validateUser(userId: string): Promise<{ id: string; isActive: boolean; shadowBanned: boolean } | null> {
    const cacheKey = `auth:validate:${userId}`;
    const CACHE_TTL = 60; // 1 minute cache

    return this.redisService.getOrSet(
      cacheKey,
      async () => {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            isActive: true,
            shadowBanned: true,
          },
        });
        return user;
      },
      CACHE_TTL
    );
  }

  /**
   * Register a new user with email and password
   */
  async register(dto: RegisterDto, deviceId?: string): Promise<TokenPair> {
    this.logger.log(`Registering new user: ${dto.username}`);

    // Check if email or username already exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { username: dto.username }],
      },
    });

    if (existingUser) {
      if (existingUser.email === dto.email) {
        throw new ConflictException('Email already registered');
      }
      throw new ConflictException('Username already taken');
    }

    // Hash password
    const passwordHash = await this.passwordService.hash(dto.password);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email,
        passwordHash,
        displayName: dto.displayName ?? dto.username,
        authProvider: 'EMAIL',
      },
    });

    this.logger.log(`User registered successfully: ${user.id}`);

    // Generate tokens
    return this.generateTokens(user.id, user.email, user.username, deviceId);
  }

  /**
   * Login with email and password
   */
  async login(dto: LoginDto, deviceId?: string): Promise<TokenPair> {
    this.logger.log(`Login attempt for: ${dto.email}`);

    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await this.passwordService.verify(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Update last active timestamp
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    });

    this.logger.log(`Login successful for user: ${user.id}`);

    // Generate tokens
    return this.generateTokens(user.id, user.email, user.username, deviceId);
  }

  /**
   * Refresh access token using refresh token
   * Implements token rotation for security
   */
  async refreshTokens(dto: RefreshTokenDto, deviceId?: string): Promise<TokenPair> {
    // Verify and decode refresh token
    let payload: RefreshTokenPayload;
    try {
      payload = this.jwtService.verify<RefreshTokenPayload>(dto.refreshToken, {
        secret: this.config.jwtSecret,
      });
    } catch (error) {
      this.logger.debug(
        `Token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Verify token type
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Find the refresh token in database
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: dto.refreshToken },
      include: { user: true },
    });

    if (!storedToken) {
      // Token not found - possible token reuse attack
      // Revoke all tokens in this family
      await this.revokeTokenFamily(payload.family);
      this.logger.warn(`Possible token reuse detected for family: ${payload.family}`);
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (storedToken.isRevoked) {
      // Token was already revoked - token reuse attack detected
      // Revoke all tokens in this family
      await this.revokeTokenFamily(storedToken.family);
      this.logger.warn(`Token reuse attack detected for family: ${storedToken.family}`);
      throw new UnauthorizedException('Token has been revoked');
    }

    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    if (!storedToken.user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Revoke the old refresh token
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { isRevoked: true },
    });

    // Generate new tokens with same family (for rotation detection)
    return this.generateTokens(
      storedToken.user.id,
      storedToken.user.email,
      storedToken.user.username,
      deviceId ?? storedToken.deviceId ?? undefined,
      storedToken.family // Keep same family
    );
  }

  /**
   * Logout user and invalidate refresh tokens
   */
  async logout(userId: string, deviceId?: string): Promise<void> {
    this.logger.log(`Logging out user: ${userId}`);

    if (deviceId) {
      // Revoke tokens for specific device
      await this.prisma.refreshToken.updateMany({
        where: {
          userId,
          deviceId,
          isRevoked: false,
        },
        data: { isRevoked: true },
      });
    } else {
      // Revoke all refresh tokens for user
      await this.prisma.refreshToken.updateMany({
        where: {
          userId,
          isRevoked: false,
        },
        data: { isRevoked: true },
      });
    }

    this.logger.log(`User logged out successfully: ${userId}`);
  }

  /**
   * Logout from all devices
   */
  async logoutAll(userId: string): Promise<void> {
    this.logger.log(`Logging out user from all devices: ${userId}`);

    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        isRevoked: false,
      },
      data: { isRevoked: true },
    });
  }

  /**
   * Verify access token and return payload
   */
  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      const payload = this.jwtService.verify<AccessTokenPayload>(token, {
        secret: this.config.jwtSecret,
      });

      if (payload.type !== 'access') {
        throw new UnauthorizedException('Invalid token type');
      }

      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  /**
   * Get authenticated user from token payload
   */
  getAuthenticatedUser(payload: AccessTokenPayload): AuthenticatedUser {
    return {
      id: payload.sub,
      email: payload.email,
      username: payload.username,
      roles: payload.roles,
      sessionId: payload.sessionId,
      deviceId: payload.deviceId,
    };
  }

  /**
   * Create a guest user
   */
  async createGuestUser(
    deviceId?: string
  ): Promise<{ user: AuthenticatedUser; tokens: TokenPair }> {
    this.logger.log('Creating guest user');

    const guestUsername = `guest_${randomUUID().slice(0, 8)}`;
    const guestExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = await this.prisma.user.create({
      data: {
        username: guestUsername,
        displayName: 'Guest',
        isGuest: true,
        guestExpiresAt,
        authProvider: 'EMAIL',
      },
    });

    // Generate sessionId before tokens so we can return it
    const sessionId = randomUUID();
    const tokens = await this.generateTokens(
      user.id,
      null,
      user.username,
      deviceId,
      undefined,
      sessionId
    );

    return {
      user: {
        id: user.id,
        username: user.username,
        roles: ['guest'],
        sessionId,
        deviceId,
      },
      tokens,
    };
  }

  /**
   * Convert guest user to full account
   */
  async convertGuestToUser(
    guestId: string,
    dto: RegisterDto,
    deviceId?: string
  ): Promise<TokenPair> {
    this.logger.log(`Converting guest to full user: ${guestId}`);

    // Verify guest exists and is actually a guest
    const guest = await this.prisma.user.findUnique({
      where: { id: guestId },
    });

    if (!guest) {
      throw new BadRequestException('Guest user not found');
    }

    if (!guest.isGuest) {
      throw new BadRequestException('User is not a guest');
    }

    // Check if email or username already exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { username: dto.username }],
        NOT: { id: guestId },
      },
    });

    if (existingUser) {
      if (existingUser.email === dto.email) {
        throw new ConflictException('Email already registered');
      }
      throw new ConflictException('Username already taken');
    }

    // Hash password and update user
    const passwordHash = await this.passwordService.hash(dto.password);

    const updatedUser = await this.prisma.user.update({
      where: { id: guestId },
      data: {
        username: dto.username,
        email: dto.email,
        passwordHash,
        displayName: dto.displayName ?? dto.username,
        isGuest: false,
        guestExpiresAt: null,
      },
    });

    // Revoke all existing tokens for this user
    await this.logoutAll(guestId);

    // Generate new tokens
    return this.generateTokens(updatedUser.id, updatedUser.email, updatedUser.username, deviceId);
  }

  /**
   * Authenticate with Google ID token (mobile flow)
   * Verifies the token and creates/updates user, then returns JWT tokens
   *
   * @param idToken - Google ID token from mobile Sign-In SDK
   * @param deviceId - Optional device identifier
   * @returns JWT token pair
   */
  async loginWithGoogleIdToken(idToken: string, deviceId?: string): Promise<TokenPair> {
    this.logger.log('Google ID token login attempt');

    // Verify the token and get user info
    const googleUser = await this.googleOAuthService.verifyIdToken(idToken);

    // Find or create user
    return this.handleOAuthLogin(googleUser, 'GOOGLE', deviceId);
  }

  /**
   * Authenticate with Google authorization code (web flow)
   * Exchanges the code for tokens and creates/updates user
   *
   * @param code - Authorization code from OAuth redirect
   * @param redirectUri - The redirect URI used in the initial request
   * @param deviceId - Optional device identifier
   * @returns JWT token pair
   */
  async loginWithGoogleCode(
    code: string,
    redirectUri: string,
    deviceId?: string
  ): Promise<TokenPair> {
    this.logger.log('Google authorization code login attempt');

    // Exchange code for user info
    const googleUser = await this.googleOAuthService.exchangeCodeForUserInfo(code, redirectUri);

    // Find or create user
    return this.handleOAuthLogin(googleUser, 'GOOGLE', deviceId);
  }

  /**
   * Authenticate with Apple identity token (mobile flow)
   * Verifies the token and creates/updates user, then returns JWT tokens
   *
   * @param identityToken - Apple identity token from Sign in with Apple SDK
   * @param user - Optional user info (only provided on first sign-in)
   * @param deviceId - Optional device identifier
   * @returns JWT token pair
   */
  async loginWithAppleIdToken(
    identityToken: string,
    user?: { name?: { firstName?: string; lastName?: string }; email?: string },
    deviceId?: string
  ): Promise<TokenPair> {
    this.logger.log('Apple identity token login attempt');

    // Verify the token and get user info
    const appleUser = await this.appleOAuthService.verifyIdentityToken(identityToken, user);

    // Find or create user
    return this.handleOAuthLogin(appleUser, 'APPLE', deviceId);
  }

  /**
   * Authenticate with Apple authorization code (web flow)
   * Exchanges the code for tokens and creates/updates user
   *
   * @param code - Authorization code from OAuth redirect
   * @param redirectUri - The redirect URI used in the initial request
   * @param user - Optional user info (only provided on first sign-in)
   * @param deviceId - Optional device identifier
   * @returns JWT token pair
   */
  async loginWithAppleCode(
    code: string,
    redirectUri: string,
    user?: { name?: { firstName?: string; lastName?: string }; email?: string },
    deviceId?: string
  ): Promise<TokenPair> {
    this.logger.log('Apple authorization code login attempt');

    // Exchange code for user info
    const appleUser = await this.appleOAuthService.exchangeCodeForUserInfo(code, redirectUri, user);

    // Find or create user
    return this.handleOAuthLogin(appleUser, 'APPLE', deviceId);
  }

  /**
   * Handle OAuth login/registration
   * Finds existing user by provider ID or email, or creates a new user
   *
   * @param oauthUser - User info from OAuth provider
   * @param provider - Auth provider (GOOGLE, APPLE)
   * @param deviceId - Optional device identifier
   * @returns JWT token pair
   */
  private async handleOAuthLogin(
    oauthUser: OAuthUserInfo,
    provider: AuthProvider,
    deviceId?: string
  ): Promise<TokenPair> {
    // First, try to find user by provider ID
    let user = await this.prisma.user.findFirst({
      where: {
        authProvider: provider,
        authProviderId: oauthUser.id,
      },
    });

    if (user) {
      this.logger.log(`OAuth login for existing user: ${user.id}`);

      // Check if user is active
      if (!user.isActive) {
        throw new UnauthorizedException('Account is deactivated');
      }

      // Update last active and potentially update profile info
      const picture = getOAuthPicture(oauthUser);
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          lastActiveAt: new Date(),
          // Update avatar if not set (Google provides pictures, Apple doesn't)
          ...(picture && !user.avatarUrl ? { avatarUrl: picture } : {}),
        },
      });

      return this.generateTokens(user.id, user.email, user.username, deviceId);
    }

    // Check if user exists with same email (linking scenario)
    if (oauthUser.email) {
      const existingEmailUser = await this.prisma.user.findUnique({
        where: { email: oauthUser.email },
      });

      if (existingEmailUser) {
        // User exists with this email but different provider
        // Link the OAuth account to existing user
        this.logger.log(`Linking OAuth account to existing email user: ${existingEmailUser.id}`);

        if (!existingEmailUser.isActive) {
          throw new UnauthorizedException('Account is deactivated');
        }

        // Update user with OAuth provider info
        // Note: This updates authProvider but preserves passwordHash, so users can still
        // login with password. For full multi-provider support, consider a separate
        // userAuthProviders table in a future migration.
        const linkPicture = getOAuthPicture(oauthUser);
        await this.prisma.user.update({
          where: { id: existingEmailUser.id },
          data: {
            authProvider: provider,
            authProviderId: oauthUser.id,
            lastActiveAt: new Date(),
            // Set verified if OAuth provider verified the email
            isVerified: oauthUser.emailVerified || existingEmailUser.isVerified,
            // Update avatar if not set (Google provides pictures, Apple doesn't)
            ...(linkPicture && !existingEmailUser.avatarUrl ? { avatarUrl: linkPicture } : {}),
          },
        });

        return this.generateTokens(
          existingEmailUser.id,
          existingEmailUser.email,
          existingEmailUser.username,
          deviceId
        );
      }
    }

    // Create new user
    this.logger.log(`Creating new user from OAuth: ${oauthUser.email}`);

    // Ensure email is present for new user creation
    if (!oauthUser.email) {
      throw new BadRequestException('Email is required for OAuth registration');
    }

    // Generate a unique username from the name or email
    const baseUsername = this.generateUsernameFromOAuth(oauthUser);
    const username = await this.ensureUniqueUsername(baseUsername);

    const newUserPicture = getOAuthPicture(oauthUser);
    user = await this.prisma.user.create({
      data: {
        username,
        email: oauthUser.email,
        displayName: oauthUser.name,
        avatarUrl: newUserPicture,
        authProvider: provider,
        authProviderId: oauthUser.id,
        isVerified: oauthUser.emailVerified,
      },
    });

    this.logger.log(`New OAuth user created: ${user.id}`);

    return this.generateTokens(user.id, user.email, user.username, deviceId);
  }

  /**
   * Generate a username from OAuth user info
   */
  private generateUsernameFromOAuth(oauthUser: OAuthUserInfo): string {
    // Try to use name parts
    if (oauthUser.givenName) {
      const name = oauthUser.givenName.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (name.length >= 3) {
        return name;
      }
    }

    // Fall back to email prefix
    if (oauthUser.email) {
      const emailPrefix = oauthUser.email.split('@')[0];
      if (emailPrefix) {
        const cleanedPrefix = emailPrefix.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanedPrefix.length >= 3) {
          return cleanedPrefix.slice(0, 20); // Max 20 chars as base
        }
      }
    }

    // Last resort: random
    return `user_${randomUUID().slice(0, 8)}`;
  }

  /**
   * Ensure username is unique by appending numbers if needed
   */
  private async ensureUniqueUsername(baseUsername: string): Promise<string> {
    const username = baseUsername.slice(0, 50); // Max 50 chars per schema
    let suffix = 0;

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, no-constant-condition -- loop until unique
    while (true) {
      const candidateUsername = suffix === 0 ? username : `${username.slice(0, 45)}${suffix}`;
      const existing = await this.prisma.user.findUnique({
        where: { username: candidateUsername },
        select: { id: true },
      });

      if (!existing) {
        return candidateUsername;
      }

      suffix++;
      if (suffix > 9999) {
        // Extremely unlikely, but prevent infinite loop
        throw new InternalServerErrorException('Failed to generate unique username');
      }
    }
  }

  /**
   * Generate JWT tokens for a user
   */
  private async generateTokens(
    userId: string,
    email: string | null,
    username: string,
    deviceId?: string,
    tokenFamily?: string,
    providedSessionId?: string
  ): Promise<TokenPair> {
    const sessionId = providedSessionId ?? randomUUID();
    const family = tokenFamily ?? randomUUID();

    // Create access token
    const accessPayload: Omit<AccessTokenPayload, 'iat' | 'exp'> = {
      sub: userId,
      type: 'access',
      email: email ?? undefined,
      username,
      roles: ['user'], // Default role, can be extended
      deviceId,
      sessionId,
    };

    const accessTokenExpiry = this.config.jwtExpiry ?? '15m';
    const refreshTokenExpiry = this.config.jwtRefreshExpiry ?? '7d';
    const accessTokenExpirySeconds = this.parseExpiryToSeconds(accessTokenExpiry);
    const refreshTokenExpirySeconds = this.parseExpiryToSeconds(refreshTokenExpiry);

    const accessToken = this.jwtService.sign(accessPayload as Record<string, unknown>, {
      secret: this.config.jwtSecret,
      expiresIn: accessTokenExpirySeconds,
    });

    // Create refresh token
    const refreshPayload: Omit<RefreshTokenPayload, 'iat' | 'exp'> = {
      sub: userId,
      type: 'refresh',
      family,
      deviceId,
    };

    const refreshToken = this.jwtService.sign(refreshPayload as Record<string, unknown>, {
      secret: this.config.jwtSecret,
      expiresIn: refreshTokenExpirySeconds,
    });

    // Store refresh token in database
    await this.prisma.refreshToken.create({
      data: {
        userId,
        token: refreshToken,
        family,
        deviceId,
        expiresAt: new Date(Date.now() + refreshTokenExpirySeconds * 1000),
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: accessTokenExpirySeconds,
    };
  }

  /**
   * Revoke all tokens in a token family
   * Used when token reuse is detected
   */
  private async revokeTokenFamily(family: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { family },
      data: { isRevoked: true },
    });
  }

  /**
   * Parse JWT expiry string to seconds
   */
  private parseExpiryToSeconds(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match || !match[1] || !match[2]) {
      return 900; // Default 15 minutes
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 24 * 60 * 60;
      default:
        return 900;
    }
  }

  /**
   * Clean up expired refresh tokens (for scheduled job)
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: new Date() } }, { isRevoked: true }],
      },
    });

    this.logger.log(`Cleaned up ${result.count} expired/revoked refresh tokens`);
    return result.count;
  }
}
