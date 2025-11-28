import {
  Injectable,
  Logger,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { AppConfigService } from '../../config';

/**
 * Google user info extracted from ID token or userinfo endpoint
 */
export interface GoogleUserInfo {
  /** Google user ID (sub claim) */
  id: string;
  /** User's email address */
  email: string;
  /** Whether email is verified */
  emailVerified: boolean;
  /** User's display name */
  name: string;
  /** User's first name */
  givenName?: string;
  /** User's last name */
  familyName?: string;
  /** URL to user's profile picture */
  picture?: string;
}

/**
 * Google token response from token exchange
 */
interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
  refresh_token?: string;
}

/**
 * Google OAuth Service
 * Handles Google OAuth token verification and user info retrieval
 *
 * Supports two flows:
 * 1. ID Token verification (mobile apps using Google Sign-In SDK)
 * 2. Authorization code exchange (web apps using OAuth redirect)
 */
@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);
  private readonly GOOGLE_TOKEN_INFO_URL = 'https://oauth2.googleapis.com/tokeninfo';
  private readonly GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
  private readonly GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

  constructor(private readonly config: AppConfigService) {}

  /**
   * Verify a Google ID token and extract user info
   * Used for mobile apps that get an ID token from Google Sign-In SDK
   *
   * @param idToken - The Google ID token to verify
   * @returns User info extracted from the token
   * @throws UnauthorizedException if token is invalid
   */
  async verifyIdToken(idToken: string): Promise<GoogleUserInfo> {
    this.logger.debug('Verifying Google ID token');

    const clientId = this.config.googleClientId;
    if (!clientId) {
      this.logger.error('Google Client ID not configured');
      throw new InternalServerErrorException('Google OAuth not configured');
    }

    try {
      // Verify token with Google's tokeninfo endpoint
      const response = await fetch(`${this.GOOGLE_TOKEN_INFO_URL}?id_token=${idToken}`);

      if (!response.ok) {
        const error = await response.text();
        this.logger.debug(`Google token verification failed: ${error}`);
        throw new UnauthorizedException('Invalid Google ID token');
      }

      const tokenInfo = (await response.json()) as {
        aud: string;
        sub: string;
        email: string;
        email_verified: string;
        name: string;
        given_name?: string;
        family_name?: string;
        picture?: string;
        exp: string;
      };

      // Verify the token was issued for our app
      if (tokenInfo.aud !== clientId) {
        this.logger.warn(`Token audience mismatch: expected ${clientId}, got ${tokenInfo.aud}`);
        throw new UnauthorizedException('Invalid Google ID token audience');
      }

      // Check if token is expired
      const expiryTime = parseInt(tokenInfo.exp, 10) * 1000;
      if (Date.now() >= expiryTime) {
        throw new UnauthorizedException('Google ID token has expired');
      }

      return {
        id: tokenInfo.sub,
        email: tokenInfo.email,
        emailVerified: tokenInfo.email_verified === 'true',
        name: tokenInfo.name,
        givenName: tokenInfo.given_name,
        familyName: tokenInfo.family_name,
        picture: tokenInfo.picture,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error(
        `Failed to verify Google ID token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw new UnauthorizedException('Failed to verify Google ID token');
    }
  }

  /**
   * Exchange an authorization code for tokens
   * Used for web apps using OAuth redirect flow
   *
   * @param code - The authorization code from Google
   * @param redirectUri - The redirect URI used in the initial request
   * @returns User info from the access token
   * @throws UnauthorizedException if code exchange fails
   */
  async exchangeCodeForUserInfo(code: string, redirectUri: string): Promise<GoogleUserInfo> {
    this.logger.debug('Exchanging Google authorization code for tokens');

    const clientId = this.config.googleClientId;
    const clientSecret = this.config.googleClientSecret;

    if (!clientId || !clientSecret) {
      this.logger.error('Google OAuth credentials not configured');
      throw new InternalServerErrorException('Google OAuth not configured');
    }

    try {
      // Exchange code for tokens
      const tokenResponse = await fetch(this.GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        this.logger.debug(`Google code exchange failed: ${error}`);
        throw new UnauthorizedException('Failed to exchange authorization code');
      }

      const tokens = (await tokenResponse.json()) as GoogleTokenResponse;

      // If we got an ID token, verify and extract user info from it
      if (tokens.id_token) {
        return this.verifyIdToken(tokens.id_token);
      }

      // Otherwise, use the access token to get user info
      return this.getUserInfo(tokens.access_token);
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error(
        `Failed to exchange Google code: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw new UnauthorizedException('Failed to exchange authorization code');
    }
  }

  /**
   * Get user info using an access token
   *
   * @param accessToken - Google access token
   * @returns User info from Google
   */
  private async getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    try {
      const response = await fetch(this.GOOGLE_USERINFO_URL, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new UnauthorizedException('Failed to get user info from Google');
      }

      const userInfo = (await response.json()) as {
        sub: string;
        email: string;
        email_verified: boolean;
        name: string;
        given_name?: string;
        family_name?: string;
        picture?: string;
      };

      return {
        id: userInfo.sub,
        email: userInfo.email,
        emailVerified: userInfo.email_verified,
        name: userInfo.name,
        givenName: userInfo.given_name,
        familyName: userInfo.family_name,
        picture: userInfo.picture,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(
        `Failed to get Google user info: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw new UnauthorizedException('Failed to get user info from Google');
    }
  }
}
