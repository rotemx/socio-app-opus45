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
import { PresenceService } from '../presence/presence.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { RedisService, REDIS_PUBLISHER, REDIS_SUBSCRIBER, REDIS_CHANNELS } from '../../redis';
import { WsAuthGuard } from '../../common/guards/ws-auth.guard';
import type { AccessTokenPayload } from '../auth/types/token.types';
import {
  JoinRoomDto,
  LeaveRoomDto,
  SendMessageDto,
  TypingDto,
  TypingStartDto,
  TypingStopDto,
  WsTokenRefreshDto,
  WsGetRoomPresenceDto,
  WsSetPresenceStatusDto,
  WsMarkMessageReadDto,
  WsGetReadReceiptsDto,
  type RoomJoinedResponse,
  type MessageResponse,
  type UserPresenceEvent,
  type TypingEvent,
  type TypingUpdateEvent,
  type WsErrorResponse,
  type TokenRefreshResponse,
  type ReadReceiptEvent,
  type ReadReceiptsResponse,
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
    private readonly presenceService: PresenceService,
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
    await this.redisService.subscribe(REDIS_CHANNELS.USER_STATUS, (_channel, message) => {
      try {
        const data = JSON.parse(message) as { userId: string; status: string };
        if (data.status !== 'OFFLINE') {
          this.handleUserConnectedElsewhere(data.userId);
        }
      } catch (error) {
        this.logger.error('Failed to parse user status message', error);
      }
    });

    // Subscribe to presence updates and broadcast to room members
    await this.redisService.subscribe(REDIS_CHANNELS.PRESENCE_UPDATE, (_channel, message) => {
      try {
        const data = JSON.parse(message) as {
          type: string;
          roomId: string;
          userId: string;
          status: string;
          timestamp: number;
        };
        this.broadcastPresenceToRoom(data.roomId, {
          userId: data.userId,
          status: data.status,
          timestamp: data.timestamp,
        });
      } catch (error) {
        this.logger.error('Failed to parse presence update message', error);
      }
    });

    // Subscribe to typing updates and broadcast to room members
    await this.redisService.subscribe(REDIS_CHANNELS.TYPING_UPDATE, (_channel, message) => {
      try {
        const data = JSON.parse(message) as {
          roomId: string;
          typingUsers: Array<{ userId: string; username: string }>;
          timestamp: number;
        };
        this.broadcastTypingUpdateToRoom(data.roomId, data.typingUsers);
      } catch (error) {
        this.logger.error('Failed to parse typing update message', error);
      }
    });

    // Subscribe to read receipt updates and broadcast to message senders
    await this.redisService.subscribe(REDIS_CHANNELS.READ_RECEIPT_UPDATE, (_channel, message) => {
      try {
        const data = JSON.parse(message) as {
          targetUserId: string;
          event: ReadReceiptEvent;
        };
        this.broadcastReadReceiptToUser(data.targetUserId, data.event);
      } catch (error) {
        this.logger.error('Failed to parse read receipt update message', error);
      }
    });
  }

  /**
   * Broadcast presence update to all users in a room
   */
  private broadcastPresenceToRoom(
    roomId: string,
    presenceData: { userId: string; status: string; timestamp: number }
  ): void {
    this.server.to(roomId).emit('presence:update', {
      roomId,
      ...presenceData,
    });
  }

  /**
   * Broadcast typing update to all users in a room
   */
  private broadcastTypingUpdateToRoom(
    roomId: string,
    typingUsers: Array<{ userId: string; username: string }>
  ): void {
    const event: TypingUpdateEvent = { roomId, typingUsers };
    this.server.to(roomId).emit('typing:update', event);
  }

  /**
   * Broadcast read receipt to all sockets of a specific user (message sender)
   * This notifies the sender that their message was read
   *
   * @param targetUserId - The user ID to send the notification to (message sender)
   * @param event - The read receipt event data (contains reader info)
   */
  private broadcastReadReceiptToUser(targetUserId: string, event: ReadReceiptEvent): void {
    const socketIds = this.userSockets.get(targetUserId);
    if (socketIds) {
      for (const socketId of socketIds) {
        this.server.to(socketId).emit('message:read', event);
      }
    }
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
      this.logger.debug(
        `Cancelled disconnect grace period for user ${userId} (connected elsewhere)`
      );
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

      // Validate user status (active check)
      const user = await this.authService.validateUser(payload.sub);
      if (!user || !user.isActive) {
        this.logger.warn(`Connection rejected: User inactive or not found (${payload.sub})`);
        this.emitError(client, 'UNAUTHORIZED', 'User account is deactivated');
        client.disconnect(true);
        return;
      }

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

      // Cancel any pending disconnect grace period (local)
      const pendingDisconnect = this.disconnectGrace.get(userId);
      if (pendingDisconnect) {
        clearTimeout(pendingDisconnect);
        this.disconnectGrace.delete(userId);
        this.logger.debug(`Reconnection within grace period (local): ${userId}`);
      }

      // Handle reconnection via PresenceService (distributed via Redis)
      // This cancels grace period across all server instances
      await this.presenceService.handleReconnection(userId, payload.deviceId);

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
   * Implements grace period for reconnection (both local and distributed via Redis)
   */
  handleDisconnect(client: AuthenticatedSocket): void {
    const user = client.data.user;
    if (!user) {
      this.logger.debug(`Anonymous client disconnected: ${client.id}`);
      return;
    }

    const userId = user.sub;
    const rooms = client.data.rooms;

    // Remove this socket from user's socket set
    const userSocketSet = this.userSockets.get(userId);
    if (userSocketSet) {
      userSocketSet.delete(client.id);

      // If user has no more connected sockets, start grace period
      if (userSocketSet.size === 0) {
        this.userSockets.delete(userId);

        // Start distributed grace period via PresenceService
        this.presenceService.startDisconnectGracePeriod(userId).catch((error) => {
          this.logger.error(
            `Failed to start grace period: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        });

        // Start local grace period before notifying rooms of user leaving
        const graceTimeout = setTimeout(() => {
          this.handleUserOffline(userId, rooms);
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
    if (rooms) {
      for (const roomId of rooms) {
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

      // Set user presence in room (triggers presence:update broadcast via Redis pub/sub)
      await this.presenceService.setUserPresenceInRoom(user.sub, roomId, 'ONLINE');

      // Get room presence with detailed status info
      const roomPresence = await this.presenceService.getRoomPresence(roomId);
      const onlineUsers = roomPresence.members
        .filter((m) => m.status === 'ONLINE' || m.status === 'BUSY')
        .map((m) => m.userId);

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

    // Remove user presence from room (triggers presence:offline broadcast via Redis pub/sub)
    await this.redisService.removeUserPresenceFromRoom(user.sub, roomId);

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
   * Handle typing indicator (legacy - kept for backwards compatibility)
   * @deprecated Use typing:start and typing:stop instead
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
   * Handle typing start indicator
   * Sets user as typing in a room with auto-expiry (5 seconds via Redis TTL)
   * Broadcasts typing:update event to all room members with list of typing users
   *
   * @example
   * ```typescript
   * socket.emit('typing:start', { roomId: 'uuid' }, (response) => {
   *   console.log(response.typingUsers); // Array of { userId, username }
   * });
   *
   * // Listen for typing updates
   * socket.on('typing:update', ({ roomId, typingUsers }) => {
   *   // Display "[Name] is typing..." or "[Name] and 2 others are typing..."
   * });
   * ```
   */
  @UseGuards(WsAuthGuard)
  @UsePipes(new ZodValidationPipe(TypingStartDto))
  @SubscribeMessage('typing:start')
  async handleTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: TypingStartDto
  ): Promise<TypingUpdateEvent> {
    const user = client.data.user!;
    const { roomId } = data;

    // Validate user is a member of the room (security check)
    try {
      await this.chatService.validateRoomAccess(user.sub, roomId);
    } catch (error) {
      this.logger.warn(
        `Room access validation failed for typing:start: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw new WsException({
        code: 'FORBIDDEN',
        message: 'Not a member of this room',
      });
    }

    // Set typing in Redis with TTL (auto-expires after 5 seconds)
    const typingUsers = await this.redisService.setUserTyping(user.sub, roomId, user.username);

    this.logger.debug(`User ${user.username} started typing in room ${roomId}`);

    return { roomId, typingUsers };
  }

  /**
   * Handle typing stop indicator
   * Removes user from typing list and broadcasts update to room members
   *
   * @example
   * ```typescript
   * socket.emit('typing:stop', { roomId: 'uuid' }, (response) => {
   *   console.log(response.typingUsers); // Updated list without the user
   * });
   * ```
   */
  @UseGuards(WsAuthGuard)
  @UsePipes(new ZodValidationPipe(TypingStopDto))
  @SubscribeMessage('typing:stop')
  async handleTypingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: TypingStopDto
  ): Promise<TypingUpdateEvent> {
    const user = client.data.user!;
    const { roomId } = data;

    // Validate user is a member of the room (security check)
    try {
      await this.chatService.validateRoomAccess(user.sub, roomId);
    } catch (error) {
      this.logger.warn(
        `Room access validation failed for typing:stop: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw new WsException({
        code: 'FORBIDDEN',
        message: 'Not a member of this room',
      });
    }

    // Remove typing from Redis
    const typingUsers = await this.redisService.removeUserTyping(user.sub, roomId);

    this.logger.debug(`User ${user.username} stopped typing in room ${roomId}`);

    return { roomId, typingUsers };
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
   * Get room presence (all users' presence in a room)
   * Requires user to be a member of the room
   *
   * @example
   * ```typescript
   * socket.emit('presence:room', { roomId: 'uuid' }, (response) => {
   *   console.log(response.members); // Array of { userId, status, lastSeenAt }
   *   console.log(response.totalOnline); // Number of online users
   * });
   * ```
   */
  @UseGuards(WsAuthGuard)
  @UsePipes(new ZodValidationPipe(WsGetRoomPresenceDto))
  @SubscribeMessage('presence:room')
  async handleGetRoomPresence(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: WsGetRoomPresenceDto
  ): Promise<{
    roomId: string;
    members: Array<{ userId: string; status: string; lastSeenAt: number }>;
    totalOnline: number;
    totalIdle: number;
    totalOffline: number;
  }> {
    const user = client.data.user!;

    // Verify user is a member of the room
    try {
      await this.chatService.validateRoomAccess(user.sub, data.roomId);
    } catch (error) {
      this.logger.warn(
        `Room presence check failed for user ${user.sub}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw new WsException({
        code: 'FORBIDDEN',
        message: 'Not a member of this room',
      });
    }

    const presence = await this.presenceService.getRoomPresence(data.roomId);
    return presence;
  }

  /**
   * Set user status (idle, away, busy)
   * Broadcasts presence update to all rooms the user is in
   *
   * @example
   * ```typescript
   * socket.emit('presence:status', { status: 'IDLE' });
   * socket.emit('presence:status', { status: 'AWAY' });
   * socket.emit('presence:status', { status: 'BUSY' });
   * ```
   */
  @UseGuards(WsAuthGuard)
  @UsePipes(new ZodValidationPipe(WsSetPresenceStatusDto))
  @SubscribeMessage('presence:status')
  async handleSetPresenceStatus(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: WsSetPresenceStatusDto
  ): Promise<{ success: boolean }> {
    const user = client.data.user!;
    const { status } = data;

    // Update global presence
    await this.redisService.setUserOnline(user.sub, { status });

    // Update presence in all rooms user is in
    const userRooms = await this.redisService.getUserRooms(user.sub);
    await Promise.allSettled(
      userRooms.map((roomId) =>
        this.presenceService.setUserPresenceInRoom(user.sub, roomId, status).catch((error) => {
          this.logger.error(
            `Failed to set presence in room ${roomId}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        })
      )
    );

    this.logger.debug(`User ${user.username} set status to ${status}`);
    return { success: true };
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
   * Mark a message as read
   * Updates the read receipt and broadcasts to the message sender
   *
   * Rate limited to 30 requests per 10 seconds per user to prevent abuse
   *
   * @example
   * ```typescript
   * socket.emit('message:read', { roomId: 'uuid', messageId: 'uuid' }, (response) => {
   *   console.log(response.success);
   * });
   *
   * // The message sender will receive:
   * socket.on('message:read', ({ roomId, messageId, userId, username, readAt }) => {
   *   // Update UI to show "seen by [username]"
   * });
   * ```
   */
  @UseGuards(WsAuthGuard)
  @UsePipes(new ZodValidationPipe(WsMarkMessageReadDto))
  @SubscribeMessage('message:read')
  async handleMarkMessageRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: WsMarkMessageReadDto
  ): Promise<{ success: boolean }> {
    const user = client.data.user!;
    const { roomId, messageId } = data;

    try {
      // Rate limit: 30 requests per 10 seconds per user
      const rateLimitResult = await this.redisService.checkRateLimit(
        `ws:message:read:${user.sub}`,
        30,
        10
      );
      if (!rateLimitResult.allowed) {
        throw new WsException({
          code: 'RATE_LIMITED',
          message: 'Too many read receipt requests. Please slow down.',
        });
      }

      // Check if the user has read receipts enabled
      const readReceiptsEnabled = await this.chatService.checkUserReadReceiptsEnabled(user.sub);
      if (!readReceiptsEnabled) {
        // Silently succeed but don't broadcast - user has disabled read receipts
        return { success: true };
      }

      // Mark message as read and get sender info
      const { senderId, readAt } = await this.chatService.markMessageAsRead(
        user.sub,
        roomId,
        messageId
      );

      // Don't broadcast if user read their own message
      if (senderId === user.sub) {
        return { success: true };
      }

      // Prepare read receipt event for the message sender
      // Contains info about WHO read the message (the current user)
      const readReceiptEvent: ReadReceiptEvent = {
        roomId,
        messageId,
        userId: user.sub, // The reader's ID
        username: user.username, // The reader's username
        readAt,
      };

      // Broadcast ONLY to message sender via Redis pub/sub (for multi-instance support)
      // Privacy: We don't broadcast to the entire room - only the sender needs to know
      // We need to include the target user (senderId) separately from the event data
      await this.redisService.publishJson(REDIS_CHANNELS.READ_RECEIPT_UPDATE, {
        targetUserId: senderId, // Who should receive this notification
        event: readReceiptEvent, // The actual event data (reader info)
      });

      this.logger.debug(
        `Message ${messageId} marked as read by ${user.username}, notified sender ${senderId}`
      );

      return { success: true };
    } catch (error) {
      // Re-throw WsException directly to preserve original error codes (e.g., RATE_LIMITED)
      if (error instanceof WsException) {
        throw error;
      }
      this.logger.warn(
        `Failed to mark message as read: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw new WsException({
        code: 'MARK_READ_FAILED',
        message: error instanceof Error ? error.message : 'Failed to mark message as read',
      });
    }
  }

  /**
   * Get read receipts for a specific message
   * Returns who has read the message
   *
   * Rate limited to 20 requests per 10 seconds per user to prevent abuse
   *
   * @example
   * ```typescript
   * socket.emit('read_receipts:get', { roomId: 'uuid', messageId: 'uuid' }, (response) => {
   *   console.log(response.readers); // Array of { userId, username, readAt }
   * });
   * ```
   */
  @UseGuards(WsAuthGuard)
  @UsePipes(new ZodValidationPipe(WsGetReadReceiptsDto))
  @SubscribeMessage('read_receipts:get')
  async handleGetReadReceipts(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: WsGetReadReceiptsDto
  ): Promise<ReadReceiptsResponse> {
    const user = client.data.user!;
    const { roomId, messageId } = data;

    try {
      // Rate limit: 20 requests per 10 seconds per user
      const rateLimitResult = await this.redisService.checkRateLimit(
        `ws:read_receipts:get:${user.sub}`,
        20,
        10
      );
      if (!rateLimitResult.allowed) {
        throw new WsException({
          code: 'RATE_LIMITED',
          message: 'Too many read receipt requests. Please slow down.',
        });
      }

      // Get read receipts (includes membership check)
      const readers = await this.chatService.getReadReceipts(user.sub, roomId, messageId);

      return {
        roomId,
        messageId,
        readers,
      };
    } catch (error) {
      // Re-throw WsException directly to preserve original error codes (e.g., RATE_LIMITED)
      if (error instanceof WsException) {
        throw error;
      }
      this.logger.warn(
        `Failed to get read receipts: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw new WsException({
        code: 'GET_READ_RECEIPTS_FAILED',
        message: error instanceof Error ? error.message : 'Failed to get read receipts',
      });
    }
  }

  /**
   * Handle user going offline after grace period
   * Uses PresenceService for comprehensive cleanup (Redis + DB + room presence + typing)
   */
  private handleUserOffline(userId: string, rooms?: Set<string>): void {
    // Use PresenceService for comprehensive offline handling
    // This handles: Redis presence, room presence sorted sets, and database
    this.presenceService.setOffline(userId).catch((error) => {
      this.logger.error(
        `Failed to set user offline via PresenceService: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    });

    // Remove typing indicators from all rooms (cleanup ephemeral typing state)
    this.redisService.removeUserTypingFromAllRooms(userId).catch((error) => {
      this.logger.error(
        `Failed to remove typing indicators: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    });

    // Remove user from all rooms in Redis (membership tracking)
    if (rooms) {
      for (const roomId of rooms) {
        this.redisService.removeUserFromRoom(userId, roomId).catch((error) => {
          this.logger.error(
            `Failed to remove user from room in Redis: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        });

        // Notify all rooms this user was in
        // Note: presence:update events are also sent via Redis pub/sub by PresenceService
        this.server.to(roomId).emit('user:left', {
          userId,
          roomId,
          action: 'left',
        });
      }
    }

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
