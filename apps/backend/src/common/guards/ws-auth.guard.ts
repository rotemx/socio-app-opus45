import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { AuthService } from '../../modules/auth';

/**
 * WebSocket Authentication Guard
 * Verifies JWT token from WebSocket handshake and attaches user to client data
 *
 * Supports token passed via:
 * 1. handshake.auth.token (recommended for Socket.io clients)
 * 2. Authorization header: "Bearer <token>"
 * 3. Authorization header: "<token>" (raw token)
 *
 * @example
 * ```typescript
 * // Client-side connection
 * const socket = io('http://localhost:3000', {
 *   auth: { token: 'jwt-token-here' }
 * });
 *
 * // Or via headers
 * const socket = io('http://localhost:3000', {
 *   extraHeaders: { authorization: 'Bearer jwt-token-here' }
 * });
 * ```
 */
@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    const token = this.extractToken(client);

    if (!token) {
      throw new WsException({
        code: 'UNAUTHORIZED',
        message: 'Missing authentication token',
      });
    }

    try {
      // Verify token and get payload
      const payload = await this.authService.verifyAccessToken(token);

      // Attach user to client data for use in handlers
      client.data = client.data || {};
      client.data.user = payload;

      return true;
    } catch (error) {
      throw new WsException({
        code: 'UNAUTHORIZED',
        message: error instanceof Error ? error.message : 'Invalid authentication token',
      });
    }
  }

  /**
   * Extract JWT token from WebSocket handshake
   * Supports multiple token locations for flexibility
   */
  private extractToken(client: Socket): string | null {
    // 1. Check handshake.auth.token (Socket.io recommended approach)
    const authToken = client.handshake.auth?.token;
    if (authToken && typeof authToken === 'string') {
      return authToken;
    }

    // 2. Check Authorization header
    const authHeader = client.handshake.headers?.authorization;
    if (authHeader) {
      // Handle "Bearer <token>" format
      if (authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
      }
      // Handle raw token
      return authHeader;
    }

    return null;
  }
}
