import {
  Injectable,
  Logger,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { createPrivateKey, createVerify } from 'crypto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { JwtService } from '@nestjs/jwt';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { AppConfigService } from '../../config';

/**
 * Apple user info extracted from identity token
 */
export interface AppleUserInfo {
  /** Apple user ID (sub claim) - stable identifier */
  id: string;
  /** User's email address (may be private relay) */
  email?: string;
  /** Whether email is verified */
  emailVerified: boolean;
  /** User's display name (only on first sign-in) */
  name?: string;
  /** User's first name (only on first sign-in) */
  givenName?: string;
  /** User's last name (only on first sign-in) */
  familyName?: string;
}

/**
 * Apple token response from code exchange
 */
interface AppleTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  id_token: string;
}

/**
 * Apple public key for JWT verification
 */
interface ApplePublicKey {
  kty: string;
  kid: string;
  use: string;
  alg: string;
  n: string;
  e: string;
}

/**
 * Apple JWKS response
 */
interface AppleJWKS {
  keys: ApplePublicKey[];
}

/**
 * Decoded Apple identity token header
 */
interface AppleTokenHeader {
  kid: string;
  alg: string;
}

/**
 * Decoded Apple identity token payload
 */
interface AppleTokenPayload {
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  sub: string;
  nonce?: string;
  nonce_supported: boolean;
  email?: string;
  email_verified?: string | boolean;
  is_private_email?: string | boolean;
  real_user_status?: number;
  auth_time: number;
}

/**
 * Apple Sign-In Service
 * Handles Apple identity token verification and authorization code exchange
 *
 * Supports two flows:
 * 1. Identity Token verification (mobile apps using Sign in with Apple SDK)
 * 2. Authorization code exchange (web apps using OAuth redirect)
 */
@Injectable()
export class AppleOAuthService {
  private readonly logger = new Logger(AppleOAuthService.name);
  private readonly APPLE_AUTH_URL = 'https://appleid.apple.com/auth/token';
  private readonly APPLE_KEYS_URL = 'https://appleid.apple.com/auth/keys';
  private cachedAppleKeys: AppleJWKS | null = null;
  private keyCacheTime = 0;
  private readonly KEY_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  constructor(
    private readonly config: AppConfigService,
    private readonly jwtService: JwtService
  ) {}

  /**
   * Verify an Apple identity token and extract user info
   * Used for mobile apps that get an identity token from Sign in with Apple SDK
   *
   * @param identityToken - The Apple identity token to verify
   * @param user - Optional user info from first sign-in (name, email)
   * @returns User info extracted from the token
   * @throws UnauthorizedException if token is invalid
   */
  async verifyIdentityToken(
    identityToken: string,
    user?: { name?: { firstName?: string; lastName?: string }; email?: string }
  ): Promise<AppleUserInfo> {
    this.logger.debug('Verifying Apple identity token');

    const clientId = this.config.appleClientId;
    if (!clientId) {
      this.logger.error('Apple Client ID not configured');
      throw new InternalServerErrorException('Apple Sign-In not configured');
    }

    try {
      // Decode token header to get key ID
      const [headerB64] = identityToken.split('.');
      if (!headerB64) {
        throw new UnauthorizedException('Invalid Apple identity token format');
      }

      const header = JSON.parse(
        Buffer.from(headerB64, 'base64url').toString('utf8')
      ) as AppleTokenHeader;

      // Get Apple's public keys
      const publicKeys = await this.getApplePublicKeys();
      const publicKey = publicKeys.keys.find((k) => k.kid === header.kid);

      if (!publicKey) {
        this.logger.warn(`Apple public key not found for kid: ${header.kid}`);
        throw new UnauthorizedException('Invalid Apple identity token');
      }

      // Verify the token signature and decode payload
      const payload = await this.verifyTokenSignature(identityToken, publicKey);

      // Validate token claims
      this.validateTokenClaims(payload, clientId);

      // Build user info
      // Note: Apple only sends user info (name, email) on FIRST sign-in
      // After that, only the `sub` (user ID) is reliably available
      return {
        id: payload.sub,
        email: payload.email ?? user?.email,
        emailVerified: payload.email_verified === true || payload.email_verified === 'true',
        name: user?.name
          ? `${user.name.firstName ?? ''} ${user.name.lastName ?? ''}`.trim()
          : undefined,
        givenName: user?.name?.firstName,
        familyName: user?.name?.lastName,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error(
        `Failed to verify Apple identity token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw new UnauthorizedException('Failed to verify Apple identity token');
    }
  }

  /**
   * Exchange an authorization code for tokens
   * Used for web apps using OAuth redirect flow
   *
   * @param code - The authorization code from Apple
   * @param redirectUri - The redirect URI used in the initial request
   * @param user - Optional user info from first sign-in
   * @returns User info from the identity token
   * @throws UnauthorizedException if code exchange fails
   */
  async exchangeCodeForUserInfo(
    code: string,
    redirectUri: string,
    user?: { name?: { firstName?: string; lastName?: string }; email?: string }
  ): Promise<AppleUserInfo> {
    this.logger.debug('Exchanging Apple authorization code for tokens');

    const clientId = this.config.appleClientId;
    const teamId = this.config.appleTeamId;
    const keyId = this.config.appleKeyId;
    const privateKey = this.config.applePrivateKey;

    if (!clientId || !teamId || !keyId || !privateKey) {
      this.logger.error('Apple Sign-In credentials not configured');
      throw new InternalServerErrorException('Apple Sign-In not configured');
    }

    try {
      // Generate client secret (JWT signed with private key)
      const clientSecret = this.generateClientSecret(clientId, teamId, keyId, privateKey);

      // Exchange code for tokens
      const tokenResponse = await fetch(this.APPLE_AUTH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        this.logger.debug(`Apple code exchange failed: ${error}`);
        throw new UnauthorizedException('Failed to exchange authorization code');
      }

      const tokens = (await tokenResponse.json()) as AppleTokenResponse;

      // Verify and extract user info from identity token
      return this.verifyIdentityToken(tokens.id_token, user);
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error(
        `Failed to exchange Apple code: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw new UnauthorizedException('Failed to exchange authorization code');
    }
  }

  /**
   * Get Apple's public keys for token verification
   * Keys are cached for 24 hours
   */
  private async getApplePublicKeys(): Promise<AppleJWKS> {
    const now = Date.now();

    // Return cached keys if still valid
    if (this.cachedAppleKeys && now - this.keyCacheTime < this.KEY_CACHE_TTL) {
      return this.cachedAppleKeys;
    }

    try {
      const response = await fetch(this.APPLE_KEYS_URL);
      if (!response.ok) {
        throw new Error(`Failed to fetch Apple public keys: ${response.status}`);
      }

      this.cachedAppleKeys = (await response.json()) as AppleJWKS;
      this.keyCacheTime = now;
      return this.cachedAppleKeys;
    } catch (error) {
      // If we have cached keys and fetch failed, use cached
      if (this.cachedAppleKeys) {
        this.logger.warn('Failed to refresh Apple keys, using cached');
        return this.cachedAppleKeys;
      }
      throw error;
    }
  }

  /**
   * Verify token signature using Apple's public key
   */
  private async verifyTokenSignature(
    token: string,
    publicKey: ApplePublicKey
  ): Promise<AppleTokenPayload> {
    const [headerB64, payloadB64, signatureB64] = token.split('.');
    if (!headerB64 || !payloadB64 || !signatureB64) {
      throw new UnauthorizedException('Invalid Apple identity token format');
    }

    // Convert JWK to PEM format for verification
    const pemKey = this.jwkToPem(publicKey);

    // Verify signature
    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${headerB64}.${payloadB64}`);

    const signature = Buffer.from(signatureB64, 'base64url');
    const isValid = verifier.verify(pemKey, signature);

    if (!isValid) {
      throw new UnauthorizedException('Invalid Apple identity token signature');
    }

    // Decode and return payload
    return JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as AppleTokenPayload;
  }

  /**
   * Convert JWK to PEM format
   */
  private jwkToPem(jwk: ApplePublicKey): string {
    // Convert base64url to base64
    const n = Buffer.from(jwk.n, 'base64url');
    const e = Buffer.from(jwk.e, 'base64url');

    // Build DER-encoded RSA public key
    const nLen = n.length;
    const eLen = e.length;

    // Ensure leading zero if high bit is set
    const nPad = n[0]! >= 0x80 ? 1 : 0;
    const ePad = e[0]! >= 0x80 ? 1 : 0;

    const sequenceLen = 2 + nLen + nPad + 2 + eLen + ePad;
    const totalLen = 2 + sequenceLen;

    const der = Buffer.alloc(totalLen + 24); // Extra space for headers
    let offset = 0;

    // SEQUENCE header for SubjectPublicKeyInfo
    der[offset++] = 0x30;
    offset = this.writeDerLength(der, offset, totalLen + 22);

    // SEQUENCE header for AlgorithmIdentifier
    der[offset++] = 0x30;
    der[offset++] = 0x0d;

    // OID for rsaEncryption
    der[offset++] = 0x06;
    der[offset++] = 0x09;
    der.set([0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01], offset);
    offset += 9;

    // NULL
    der[offset++] = 0x05;
    der[offset++] = 0x00;

    // BIT STRING header
    der[offset++] = 0x03;
    offset = this.writeDerLength(der, offset, totalLen + 1);
    der[offset++] = 0x00; // unused bits

    // SEQUENCE for RSAPublicKey
    der[offset++] = 0x30;
    offset = this.writeDerLength(der, offset, sequenceLen);

    // INTEGER n
    der[offset++] = 0x02;
    offset = this.writeDerLength(der, offset, nLen + nPad);
    if (nPad) der[offset++] = 0x00;
    n.copy(der, offset);
    offset += nLen;

    // INTEGER e
    der[offset++] = 0x02;
    offset = this.writeDerLength(der, offset, eLen + ePad);
    if (ePad) der[offset++] = 0x00;
    e.copy(der, offset);
    offset += eLen;

    const base64 = der.subarray(0, offset).toString('base64');
    return `-----BEGIN PUBLIC KEY-----\n${base64.match(/.{1,64}/g)?.join('\n')}\n-----END PUBLIC KEY-----`;
  }

  /**
   * Write DER length encoding
   */
  private writeDerLength(buffer: Buffer, offset: number, length: number): number {
    if (length < 0x80) {
      buffer[offset++] = length;
    } else if (length < 0x100) {
      buffer[offset++] = 0x81;
      buffer[offset++] = length;
    } else {
      buffer[offset++] = 0x82;
      buffer[offset++] = (length >> 8) & 0xff;
      buffer[offset++] = length & 0xff;
    }
    return offset;
  }

  /**
   * Validate Apple token claims
   */
  private validateTokenClaims(payload: AppleTokenPayload, clientId: string): void {
    // Verify issuer
    if (payload.iss !== 'https://appleid.apple.com') {
      throw new UnauthorizedException('Invalid Apple token issuer');
    }

    // Verify audience
    if (payload.aud !== clientId) {
      this.logger.warn(`Token audience mismatch: expected ${clientId}, got ${payload.aud}`);
      throw new UnauthorizedException('Invalid Apple token audience');
    }

    // Verify expiration
    if (Date.now() >= payload.exp * 1000) {
      throw new UnauthorizedException('Apple identity token has expired');
    }
  }

  /**
   * Generate client secret JWT for Apple token exchange
   * Apple requires a JWT signed with your private key as the client_secret
   */
  private generateClientSecret(
    clientId: string,
    teamId: string,
    keyId: string,
    privateKey: string
  ): string {
    const now = Math.floor(Date.now() / 1000);

    // Parse the private key (handle escaped newlines from env var)
    const formattedKey = privateKey.replace(/\\n/g, '\n');

    try {
      const key = createPrivateKey({
        key: formattedKey,
        format: 'pem',
      });

      return this.jwtService.sign(
        {
          iss: teamId,
          iat: now,
          exp: now + 86400, // 24 hours (Apple allows up to 6 months)
          aud: 'https://appleid.apple.com',
          sub: clientId,
        },
        {
          algorithm: 'ES256',
          privateKey: key,
          header: {
            alg: 'ES256',
            kid: keyId,
          },
        }
      );
    } catch (error) {
      this.logger.error(
        `Failed to generate Apple client secret: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw new InternalServerErrorException('Failed to generate Apple client secret');
    }
  }
}
