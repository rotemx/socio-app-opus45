/**
 * JWT Token Types and Payloads
 */

/**
 * Access Token Payload
 * Short-lived token for API access (expiry configurable via JWT_EXPIRY)
 */
export interface AccessTokenPayload {
  /** User ID (subject) */
  sub: string;
  /** Token type discriminator */
  type: 'access';
  /** User's email (optional for guest users) */
  email?: string;
  /** Username */
  username: string;
  /** User roles for authorization */
  roles: string[];
  /** Device identifier for session tracking */
  deviceId?: string;
  /** Session identifier */
  sessionId: string;
  /** Issued at timestamp */
  iat: number;
  /** Expiration timestamp */
  exp: number;
}

/**
 * Refresh Token Payload
 * Long-lived token for obtaining new access tokens (expiry configurable via JWT_REFRESH_EXPIRY)
 */
export interface RefreshTokenPayload {
  /** User ID (subject) */
  sub: string;
  /** Token type discriminator */
  type: 'refresh';
  /** Token family for rotation detection */
  family: string;
  /** Device identifier */
  deviceId?: string;
  /** Issued at timestamp */
  iat: number;
  /** Expiration timestamp */
  exp: number;
}

/**
 * Token pair returned after successful authentication
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  /** Access token expiration time in seconds */
  expiresIn: number;
}

/**
 * Authenticated user attached to request
 */
export interface AuthenticatedUser {
  id: string;
  email?: string;
  username: string;
  roles: string[];
  sessionId: string;
  deviceId?: string;
}
