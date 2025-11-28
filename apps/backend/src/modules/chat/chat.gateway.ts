import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WsException,
} from '@nestjs/websockets';
import type { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { Inject, Logger, UseGuards, UsePipes } from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import { createAdapter } from '@socket.io/redis-adapter';
import type Redis from 'ioredis';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { ChatService } from './chat.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { AuthService } from '../auth';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { RedisService, REDIS_PUBLISHER, REDIS_SUBSCRIBER, REDIS_CHANNELS } from '../../redis';
import { WsAuthGuard } from '../../common/guards/ws-auth.guard';
import type { AccessTokenPayload } from '../auth/types/token.types';
import {
  JoinRoomDto,
  LeaveRoomDto,
  SendMessageDto,
  TypingDto,
  WsTokenRefreshDto,
  type RoomJoinedResponse,
  type MessageResponse,
  type UserPresenceEvent,
  type TypingEvent,
  type WsErrorResponse,
  type TokenRefreshResponse,
} from './dto/chat.dto';

/**
 * Extended Socket interface with user data
 */
interface AuthenticatedSocket extends Socket {
  data: {
    user?: AccessTokenPayload;
    rooms?: Set<string>;
    lastHeartbeat?: number;
  };
}

/**
 * Chat Gateway
 * Handles real-time WebSocket connections for messaging
 *
 * Supports:
 * - JWT authentication on handshake
 * - Room join/leave with validation
 * - Message broadcasting to room members
 * - Connection/disconnection handling
 * - Graceful reconnection (30s grace period)
 * - Typing indicators
 *
 * @example
 * ```typescript
 * // Client connection
 * const socket = io('http://localhost:3000', {
 *   auth: { token: 'your-jwt-token' }
 * });
 *
 * // Join a room
 * socket.emit('room:join', { roomId: 'uuid' });
 *
 * // Send a message
 * socket.emit('message:send', { roomId: 'uuid', content: 'Hello!' });
 *
 * // Listen for new messages
 * socket.on('message:new', (message) => console.log(message));
 * ```
 */
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
    credentials: true,
  },
  namespace: '/',
  transports: ['websocket', 'polling'],
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  // Track connected users: userId -> Set of socket IDs
  private readonly userSockets = new Map<string, Set<string>>();

  // Track disconnecting users for grace period: userId -> timeout
  private readonly disconnectGrace = new Map<string, NodeJS.Timeout>();

  // Grace period for reconnection (30 seconds)
  private readonly RECONNECT_GRACE_MS = 30 * 1000;

  constructor(
    private readonly chatService: ChatService,
    private readonly authService: AuthService,
    private readonly redisService: RedisService,
    @Inject(REDIS_PUBLISHER) private readonly pubClient: Redis,
    @Inject(REDIS_SUBSCRIBER) private readonly subClient: Redis
  ) {}

  /**
   * Gateway initialization
   * Sets up Redis adapter for multi-instance support
   */
  async afterInit(server: Server): Promise<void> {
    // Set up Redis adapter for multi-instance Socket.io support
    try {
      const adapter = createAdapter(this.pubClient, this.subClient);
      server.adapter(adapter);
      this.logger.log('WebSocket Gateway initialized with Redis adapter');
    } catch (error) {
      this.logger.error('Failed to initialize Redis adapter, falling back to in-memory adapter');
      this.logger.error(error instanceof Error ? error.message : 'Unknown error');
    }

    // Subscribe to user status updates for distributed grace period handling
    // If a user connects on another instance, we should cancel their disconnect timer here
    await this.redisService.subscribe(REDIS_CHANNELS.USER_STATUS, (channel, message) => {
      try {
        const data = JSON.parse(message) as { userId: string; status: string };
        if (data.status !== 'OFFLINE') {
          this.handleUserConnectedElsewhere(data.userId);
        }
      } catch (error) {
        this.logger.error('Failed to parse user status message', error);
      }
    });
  }

  /**
   * Handle notification that a user connected on another instance
   * Cancels any pending disconnect grace period for this user on this instance
   */
  private handleUserConnectedElsewhere(userId: string): void {
    const pendingDisconnect = this.disconnectGrace.get(userId);
    if (pendingDisconnect) {
      clearTimeout(pendingDisconnect);
      this.disconnectGrace.delete(userId);
      this.logger.debug(`Cancelled disconnect grace period for user ${userId} (connected elsewhere)`);
    }
  }

  /**
   * Handle new WebSocket connection
   * Validates JWT token and sets up user data
   */
  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    try {
      const token = this.extractToken(client);

      if (!token) {
        this.logger.warn(`Connection rejected: No token provided (${client.id})`);
        this.emitError(client, 'UNAUTHORIZED', 'Authentication token required');
        client.disconnect(true);
        return;
      }

      // Verify JWT token
      const payload = await this.authService.verifyAccessToken(token);

      // Attach user data to socket
      client.data.user = payload;
      client.data.rooms = new Set();
      client.data.lastHeartbeat = Date.now();

      // Track socket for this user
      const userId = payload.sub;
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);

      // Cancel any pending disconnect grace period
      const pendingDisconnect = this.disconnectGrace.get(userId);
      if (pendingDisconnect) {
        clearTimeout(pendingDisconnect);
        this.disconnectGrace.delete(userId);
        this.logger.debug(`Reconnection within grace period: ${userId}`);
      }

      // Set user online in Redis
      await this.redisService.setUserOnline(userId, {
        status: 'ONLINE',
        deviceId: payload.deviceId,
      });

      this.logger.log(`Client connected: ${client.id} (User: ${payload.username})`);

      // Notify client of successful connection
      client.emit('connection:success', {
        userId: payload.sub,
        username: payload.username,
        socketId: client.id,
      });
    } catch (error) {
      this.logger.warn(
        `Connection rejected: Invalid token (${client.id}) - ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      this.emitError(client, 'UNAUTHORIZED', 'Invalid or expired token');
      client.disconnect(true);
    }
  }

  /**
   * Handle WebSocket disconnection
   * Implements grace period for reconnection
   */
  handleDisconnect(client: AuthenticatedSocket): void {
    const user = client.data.user;
    if (!user) {
      this.logger.debug(`Anonymous client disconnected: ${client.id}`);
      return;
    }

    const userId = user.sub;

    // Remove this socket from user's socket set
    const userSocketSet = this.userSockets.get(userId);
    if (userSocketSet) {
      userSocketSet.delete(client.id);

      // If user has no more connected sockets, start grace period
      if (userSocketSet.size === 0) {
        this.userSockets.delete(userId);

        // Start grace period before notifying rooms of user leaving
        const graceTimeout = setTimeout(() => {
          this.handleUserOffline(userId, client.data.rooms);
          this.disconnectGrace.delete(userId);
        }, this.RECONNECT_GRACE_MS);

        this.disconnectGrace.set(userId, graceTimeout);
        this.logger.debug(
          `Client disconnected, grace period started: ${client.id} (User: ${user.username})`
        );
      } else {
        this.logger.debug(
          `Client disconnected, user still has ${userSocketSet.size} connections: ${client.id}`
        );
      }
    }

    // Leave all rooms for this socket
    if (client.data.rooms) {
      for (const roomId of client.data.rooms) {
        client.leave(roomId);
      }
    }
  }

  /**
   * Join a chat room
   */
  @UseGuards(WsAuthGuard)
  @UsePipes(new ZodValidationPipe(JoinRoomDto))
  @SubscribeMessage('room:join')
  async handleJoinRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: JoinRoomDto
  ): Promise<RoomJoinedResponse | WsErrorResponse> {
    const user = client.data.user!;
    const { roomId } = data;

    try {
      // Validate room membership
      const roomInfo = await this.chatService.validateRoomAccess(user.sub, roomId);

      // Join Socket.io room
      await client.join(roomId);
      client.data.rooms?.add(roomId);

      // Track user in room via Redis (for multi-instance awareness)
      await this.redisService.addUserToRoom(user.sub, roomId);

      // Get online users in room from Redis
      const onlineUsers = await this.redisService.getOnlineUsersInRoom(roomId);

      // Notify room of new user (except sender)
      const presenceEvent: UserPresenceEvent = {
        userId: user.sub,
        username: user.username,
        roomId,
        action: 'joined',
      };
      client.to(roomId).emit('user:joined', presenceEvent);

      this.logger.debug(`User ${user.username} joined room ${roomId}`);

      return {
        roomId,
        roomName: roomInfo.name,
        memberCount: roomInfo.memberCount,
        onlineUsers,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to join room: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw new WsException({
        code: 'JOIN_FAILED',
        message: error instanceof Error ? error.message : 'Failed to join room',
      });
    }
  }

  /**
   * Leave a chat room
   */
  @UseGuards(WsAuthGuard)
  @UsePipes(new ZodValidationPipe(LeaveRoomDto))
  @SubscribeMessage('room:leave')
  async handleLeaveRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: LeaveRoomDto
  ): Promise<{ roomId: string; success: boolean }> {
    const user = client.data.user!;
    const { roomId } = data;

    // Leave Socket.io room
    await client.leave(roomId);
    client.data.rooms?.delete(roomId);

    // Remove user from room in Redis
    await this.redisService.removeUserFromRoom(user.sub, roomId);

    // Notify room of user leaving
    const presenceEvent: UserPresenceEvent = {
      userId: user.sub,
      username: user.username,
      roomId,
      action: 'left',
    };
    client.to(roomId).emit('user:left', presenceEvent);

    this.logger.debug(`User ${user.username} left room ${roomId}`);

    return { roomId, success: true };
  }

  /**
   * Send a message to a room
   */
  @UseGuards(WsAuthGuard)
  @UsePipes(new ZodValidationPipe(SendMessageDto))
  @SubscribeMessage('message:send')
  async handleMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: SendMessageDto
  ): Promise<MessageResponse> {
    const user = client.data.user!;
    const { roomId, content, replyToId } = data;

    try {
      // Validate room membership and save message
      const message = await this.chatService.sendMessage(user.sub, roomId, content, replyToId);

      const messageResponse: MessageResponse = {
        id: message.id,
        roomId: message.roomId,
        senderId: message.senderId,
        senderName: user.username,
        content: message.content,
        replyToId: message.replyToId ?? undefined,
        createdAt: message.createdAt,
      };

      // Broadcast to all room members (including sender)
      this.server.to(roomId).emit('message:new', messageResponse);

      this.logger.debug(`Message sent in room ${roomId} by ${user.username}`);

      return messageResponse;
    } catch (error) {
      this.logger.warn(
        `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw new WsException({
        code: 'SEND_FAILED',
        message: error instanceof Error ? error.message : 'Failed to send message',
      });
    }
  }

  /**
   * Handle typing indicator
   */
  @UseGuards(WsAuthGuard)
  @UsePipes(new ZodValidationPipe(TypingDto))
  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: TypingDto
  ): void {
    const user = client.data.user!;
    const { roomId, isTyping } = data;

    const typingEvent: TypingEvent = {
      userId: user.sub,
      username: user.username,
      roomId,
      isTyping,
    };

    // Broadcast to room (except sender)
    client.to(roomId).emit('typing', typingEvent);
  }

  /**
   * Handle heartbeat for presence tracking
   */
  @UseGuards(WsAuthGuard)
  @SubscribeMessage('heartbeat')
  async handleHeartbeat(
    @ConnectedSocket() client: AuthenticatedSocket
  ): Promise<{ timestamp: number }> {
    const user = client.data.user!;
    client.data.lastHeartbeat = Date.now();

    // Update heartbeat in Redis for presence tracking
    await this.redisService.heartbeat(user.sub);

    return { timestamp: Date.now() };
  }

  /**
   * Handle token refresh during active WebSocket connection
   * Allows clients to refresh tokens without disconnecting
   *
   * Note: This handler intentionally does NOT use @UseGuards(WsAuthGuard)
   * because clients need to refresh when their access token is expired.
   * The refresh token validation by authService.refreshTokens() provides
   * the necessary authentication. The client.data.user is available from
   * the initial authenticated connection.
   *
   * @example
   * ```typescript
   * socket.emit('auth:refresh', { refreshToken: 'your-refresh-token' }, (response) => {
   *   if (response.accessToken) {
   *     // Update local storage with new tokens
   *   }
   * });
   *
   * // Or listen for the event
   * socket.on('auth:refreshed', (tokens) => {
   *   // Update local storage with new tokens
   * });
   * ```
   */
  @UsePipes(new ZodValidationPipe(WsTokenRefreshDto))
  @SubscribeMessage('auth:refresh')
  async handleTokenRefresh(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: WsTokenRefreshDto
  ): Promise<TokenRefreshResponse | WsErrorResponse> {
    const user = client.data.user;

    // Ensure the client was originally authenticated (has user data from initial connection)
    if (!user) {
      this.logger.warn('Token refresh attempted on unauthenticated socket');
      throw new WsException({
        code: 'UNAUTHORIZED',
        message: 'Socket not authenticated',
      });
    }

    try {
      this.logger.debug(`Token refresh requested by user: ${user.sub}`);

      // Refresh tokens using the auth service
      const newTokens = await this.authService.refreshTokens(
        { refreshToken: data.refreshToken },
        user.deviceId
      );

      // Verify and get payload from new access token
      const newPayload = await this.authService.verifyAccessToken(newTokens.accessToken);

      // Update socket's user data with new token payload
      client.data.user = newPayload;
      client.data.lastHeartbeat = Date.now();

      this.logger.debug(`Token refreshed successfully for user: ${newPayload.sub}`);

      const response: TokenRefreshResponse = {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        expiresIn: newTokens.expiresIn,
      };

      // Emit to the client as an event as well (for listeners)
      client.emit('auth:refreshed', response);

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Token refresh failed';
      this.logger.warn(`Token refresh failed for user ${user.sub}: ${errorMessage}`);

      throw new WsException({
        code: 'TOKEN_REFRESH_FAILED',
        message: errorMessage,
      });
    }
  }

  /**
   * Handle user going offline after grace period
   */
  private handleUserOffline(userId: string, rooms?: Set<string>): void {
    // Update presence status in Redis
    this.redisService.setUserOffline(userId).catch((error) => {
      this.logger.error(
        `Failed to set user offline in Redis: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    });

    // Remove user from all rooms in Redis
    if (rooms) {
      for (const roomId of rooms) {
        this.redisService.removeUserFromRoom(userId, roomId).catch((error) => {
          this.logger.error(
            `Failed to remove user from room in Redis: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        });

        // Notify all rooms this user was in
        this.server.to(roomId).emit('user:left', {
          userId,
          roomId,
          action: 'left',
        });
      }
    }

    // Also update presence in database
    this.chatService.setUserOffline(userId).catch((error) => {
      this.logger.error(
        `Failed to set user offline in DB: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    });

    this.logger.log(`User went offline after grace period: ${userId}`);
  }

  /**
   * Extract JWT token from socket handshake
   */
  private extractToken(client: Socket): string | null {
    // Check handshake.auth.token (recommended)
    const authToken = client.handshake.auth?.token;
    if (authToken && typeof authToken === 'string') {
      return authToken;
    }

    // Check Authorization header
    const authHeader = client.handshake.headers?.authorization;
    if (authHeader) {
      if (authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
      }
      return authHeader;
    }

    return null;
  }

  /**
   * Emit error to client
   */
  private emitError(client: Socket, code: string, message: string): void {
    client.emit('error', { code, message });
  }

  /**
   * Get online users count for a room
   */
  getOnlineCountInRoom(roomId: string): number {
    const room = this.server.sockets.adapter.rooms.get(roomId);
    return room ? room.size : 0;
  }

  /**
   * Broadcast to all sockets of a specific user
   */
  broadcastToUser(userId: string, event: string, data: unknown): void {
    const socketIds = this.userSockets.get(userId);
    if (socketIds) {
      for (const socketId of socketIds) {
        this.server.to(socketId).emit(event, data);
      }
    }
  }
}
