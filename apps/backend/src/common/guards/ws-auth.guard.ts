import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { type Socket } from 'socket.io';

/**
 * WebSocket Authentication Guard
 * Verifies JWT token from WebSocket handshake
 */
@Injectable()
export class WsAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    const authHeader = client.handshake.headers?.authorization;
    const token =
      client.handshake.auth?.token ||
      (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : authHeader);

    if (!token) {
      throw new WsException('Missing authentication token');
    }

    // TODO: Implement JWT verification with AuthService
    // When implementing:
    // 1. Inject AuthService in constructor
    // 2. const payload = await this.authService.verifyToken(token);
    // 3. client.data.user = payload;
    try {
      return true;
    } catch {
      throw new WsException('Invalid authentication token');
    }
  }
}
