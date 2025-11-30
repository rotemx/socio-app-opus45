import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT, REDIS_KEYS, REDIS_TTL, REDIS_CHANNELS } from './redis.constants';

/**
 * Presence status types
 */
export type PresenceStatus = 'ONLINE' | 'IDLE' | 'AWAY' | 'BUSY' | 'OFFLINE';

/**
 * Presence data structure stored in Redis
 */
export interface RedisPresenceData {
  userId: string;
  status: PresenceStatus;
  lastSeenAt: number;
  deviceId?: string;
  rooms?: string[];
}

/**
 * Room presence entry (user presence within a specific room)
 */
export interface RoomPresenceEntry {
  userId: string;
  status: PresenceStatus;
  lastSeenAt: number;
}

/**
 * Input for setUserOnline (lastSeenAt is auto-set)
 */
export interface SetUserOnlineInput {
  status: Exclude<PresenceStatus, 'OFFLINE'>;
  deviceId?: string;
  rooms?: string[];
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Pub/sub message handler
 */
export type MessageHandler = (channel: string, message: string) => void;

/**
 * Redis Service
 * Provides Redis operations for caching, pub/sub, and rate limiting
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private subscriber: Redis | null = null;
  private readonly messageHandlers = new Map<string, Set<MessageHandler>>();

  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Redis service initialized');
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  /**
   * Get the underlying Redis client
   */
  getClient(): Redis {
    return this.client;
  }

  /**
   * Check if Redis is connected
   */
  isConnected(): boolean {
    return this.client.status === 'ready';
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.quit();
      this.subscriber = null;
    }
    await this.client.quit();
    this.logger.log('Redis disconnected');
  }

  // ============================================
  // Basic Operations
  // ============================================

  /**
   * Get a value from Redis
   */
  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  /**
   * Set a value in Redis with optional TTL
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  /**
   * Delete a key from Redis
   */
  async del(key: string): Promise<number> {
    return this.client.del(key);
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  /**
   * Set TTL on a key
   */
  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    return (await this.client.expire(key, ttlSeconds)) === 1;
  }

  /**
   * Get TTL of a key
   */
  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  // ============================================
  // JSON Operations
  // ============================================

  /**
   * Get a JSON value from Redis
   */
  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      this.logger.warn(`Failed to parse JSON for key: ${key}`);
      return null;
    }
  }

  /**
   * Set a JSON value in Redis
   */
  async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  // ============================================
  // Hash Operations
  // ============================================

  /**
   * Get all fields from a hash
   */
  async hgetall(key: string): Promise<Record<string, string>> {
    return this.client.hgetall(key);
  }

  /**
   * Get a field from a hash
   */
  async hget(key: string, field: string): Promise<string | null> {
    return this.client.hget(key, field);
  }

  /**
   * Set a field in a hash
   */
  async hset(key: string, field: string, value: string): Promise<number> {
    return this.client.hset(key, field, value);
  }

  /**
   * Set multiple fields in a hash
   */
  async hmset(key: string, data: Record<string, string>): Promise<'OK'> {
    return this.client.hmset(key, data);
  }

  /**
   * Delete a field from a hash
   */
  async hdel(key: string, field: string): Promise<number> {
    return this.client.hdel(key, field);
  }

  // ============================================
  // Set Operations
  // ============================================

  /**
   * Add members to a set
   */
  async sadd(key: string, ...members: string[]): Promise<number> {
    return this.client.sadd(key, ...members);
  }

  /**
   * Remove members from a set
   */
  async srem(key: string, ...members: string[]): Promise<number> {
    return this.client.srem(key, ...members);
  }

  /**
   * Get all members of a set
   */
  async smembers(key: string): Promise<string[]> {
    return this.client.smembers(key);
  }

  /**
   * Check if member exists in set
   */
  async sismember(key: string, member: string): Promise<boolean> {
    return (await this.client.sismember(key, member)) === 1;
  }

  /**
   * Get set cardinality
   */
  async scard(key: string): Promise<number> {
    return this.client.scard(key);
  }

  // ============================================
  // Sorted Set Operations (for presence)
  // ============================================

  /**
   * Add a member to a sorted set with score
   */
  async zadd(key: string, score: number, member: string): Promise<number> {
    return this.client.zadd(key, score, member);
  }

  /**
   * Remove a member from a sorted set
   */
  async zrem(key: string, member: string): Promise<number> {
    return this.client.zrem(key, member);
  }

  /**
   * Get members with scores in range
   */
  async zrangebyscore(key: string, min: number | '-inf', max: number | '+inf'): Promise<string[]> {
    return this.client.zrangebyscore(key, min, max);
  }

  /**
   * Remove members with scores outside range
   */
  async zremrangebyscore(key: string, min: number | '-inf', max: number | '+inf'): Promise<number> {
    return this.client.zremrangebyscore(key, min, max);
  }

  // ============================================
  // Pub/Sub Operations
  // ============================================

  /**
   * Publish a message to a channel
   */
  async publish(channel: string, message: string): Promise<number> {
    return this.client.publish(channel, message);
  }

  /**
   * Publish a JSON message to a channel
   */
  async publishJson<T>(channel: string, data: T): Promise<number> {
    return this.publish(channel, JSON.stringify(data));
  }

  /**
   * Subscribe to a channel
   * Note: Creates a dedicated subscriber connection
   */
  async subscribe(channel: string, handler: MessageHandler): Promise<void> {
    // Create subscriber connection if not exists
    if (!this.subscriber) {
      this.subscriber = this.client.duplicate();
      this.subscriber.on('message', (ch: string, msg: string) => {
        const handlers = this.messageHandlers.get(ch);
        if (handlers) {
          for (const h of handlers) {
            try {
              h(ch, msg);
            } catch (error) {
              this.logger.error(`Error in message handler for channel ${ch}:`, error);
            }
          }
        }
      });
    }

    // Add handler
    if (!this.messageHandlers.has(channel)) {
      this.messageHandlers.set(channel, new Set());
      await this.subscriber.subscribe(channel);
    }
    this.messageHandlers.get(channel)!.add(handler);

    this.logger.debug(`Subscribed to channel: ${channel}`);
  }

  /**
   * Unsubscribe from a channel
   */
  async unsubscribe(channel: string, handler?: MessageHandler): Promise<void> {
    const handlers = this.messageHandlers.get(channel);
    if (!handlers) return;

    if (handler) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.messageHandlers.delete(channel);
        if (this.subscriber) {
          await this.subscriber.unsubscribe(channel);
        }
      }
    } else {
      this.messageHandlers.delete(channel);
      if (this.subscriber) {
        await this.subscriber.unsubscribe(channel);
      }
    }

    this.logger.debug(`Unsubscribed from channel: ${channel}`);
  }

  // ============================================
  // Presence Operations
  // ============================================

  /**
   * Set user online with presence data
   */
  async setUserOnline(userId: string, data: SetUserOnlineInput): Promise<void> {
    const key = `${REDIS_KEYS.PRESENCE}:${userId}`;
    const presenceData: RedisPresenceData = {
      userId,
      status: data.status,
      deviceId: data.deviceId,
      rooms: data.rooms,
      lastSeenAt: Date.now(),
    };

    await this.setJson(key, presenceData, REDIS_TTL.PRESENCE);

    // Add to online users set
    await this.zadd(`${REDIS_KEYS.PRESENCE}:online`, Date.now(), userId);

    // Publish presence update
    await this.publishJson(REDIS_CHANNELS.USER_STATUS, {
      userId,
      status: data.status,
      timestamp: Date.now(),
    });
  }

  /**
   * Set user offline
   */
  async setUserOffline(userId: string): Promise<void> {
    const key = `${REDIS_KEYS.PRESENCE}:${userId}`;

    // Update presence data
    const existing = await this.getJson<RedisPresenceData>(key);
    if (existing) {
      existing.status = 'OFFLINE';
      existing.lastSeenAt = Date.now();
      await this.setJson(key, existing, REDIS_TTL.PRESENCE);
    }

    // Remove from online users set
    await this.zrem(`${REDIS_KEYS.PRESENCE}:online`, userId);

    // Publish presence update
    await this.publishJson(REDIS_CHANNELS.USER_STATUS, {
      userId,
      status: 'OFFLINE',
      timestamp: Date.now(),
    });
  }

  /**
   * Update user heartbeat
   */
  async heartbeat(userId: string): Promise<void> {
    const key = `${REDIS_KEYS.PRESENCE}:${userId}`;
    const existing = await this.getJson<RedisPresenceData>(key);

    if (existing) {
      existing.lastSeenAt = Date.now();
      if (existing.status === 'OFFLINE') {
        existing.status = 'ONLINE';
      }
      await this.setJson(key, existing, REDIS_TTL.PRESENCE);
      await this.zadd(`${REDIS_KEYS.PRESENCE}:online`, Date.now(), userId);
    }
  }

  /**
   * Get user presence
   */
  async getUserPresence(userId: string): Promise<RedisPresenceData | null> {
    const key = `${REDIS_KEYS.PRESENCE}:${userId}`;
    return this.getJson<RedisPresenceData>(key);
  }

  /**
   * Get online users (active within threshold)
   */
  async getOnlineUsers(thresholdMs: number = REDIS_TTL.PRESENCE * 1000): Promise<string[]> {
    const minScore = Date.now() - thresholdMs;
    return this.zrangebyscore(`${REDIS_KEYS.PRESENCE}:online`, minScore, '+inf');
  }

  /**
   * Clean up stale presence entries
   */
  async cleanupStalePresence(thresholdMs: number = REDIS_TTL.PRESENCE * 1000): Promise<number> {
    const maxScore = Date.now() - thresholdMs;
    return this.zremrangebyscore(`${REDIS_KEYS.PRESENCE}:online`, '-inf', maxScore);
  }

  /**
   * Add user to room
   */
  async addUserToRoom(userId: string, roomId: string): Promise<void> {
    await this.sadd(`${REDIS_KEYS.ROOM}:${roomId}:users`, userId);
    await this.sadd(`${REDIS_KEYS.USER}:${userId}:rooms`, roomId);

    // Publish room event
    await this.publishJson(REDIS_CHANNELS.ROOM_EVENT, {
      type: 'user:joined',
      roomId,
      userId,
      timestamp: Date.now(),
    });
  }

  /**
   * Remove user from room
   */
  async removeUserFromRoom(userId: string, roomId: string): Promise<void> {
    await this.srem(`${REDIS_KEYS.ROOM}:${roomId}:users`, userId);
    await this.srem(`${REDIS_KEYS.USER}:${userId}:rooms`, roomId);

    // Publish room event
    await this.publishJson(REDIS_CHANNELS.ROOM_EVENT, {
      type: 'user:left',
      roomId,
      userId,
      timestamp: Date.now(),
    });
  }

  /**
   * Get online users in a room
   */
  async getOnlineUsersInRoom(roomId: string): Promise<string[]> {
    const roomUsers = await this.smembers(`${REDIS_KEYS.ROOM}:${roomId}:users`);
    if (roomUsers.length === 0) return [];

    const onlineUsers = await this.getOnlineUsers();
    return roomUsers.filter((userId) => onlineUsers.includes(userId));
  }

  /**
   * Get rooms a user is in
   */
  async getUserRooms(userId: string): Promise<string[]> {
    return this.smembers(`${REDIS_KEYS.USER}:${userId}:rooms`);
  }

  // ============================================
  // Room-Specific Presence (Sorted Sets)
  // ============================================

  /**
   * Set user presence in a specific room
   * Uses sorted set with timestamp as score for efficient queries
   * Format: room_presence:{roomId} -> { userId: timestamp }
   *
   * @param userId - User ID
   * @param roomId - Room ID
   * @param status - Presence status (ONLINE, IDLE, AWAY, BUSY)
   */
  async setUserPresenceInRoom(
    userId: string,
    roomId: string,
    status: Exclude<PresenceStatus, 'OFFLINE'>
  ): Promise<void> {
    try {
      const now = Date.now();
      const roomPresenceKey = `${REDIS_KEYS.ROOM_PRESENCE}:${roomId}`;
      const userPresenceKey = `${REDIS_KEYS.ROOM_PRESENCE}:${roomId}:${userId}`;

      // Store user in room's presence sorted set (score = timestamp for last activity)
      await this.zadd(roomPresenceKey, now, userId);

      // Store detailed presence data for the user in this room
      const presenceData: RoomPresenceEntry = {
        userId,
        status,
        lastSeenAt: now,
      };
      await this.setJson(userPresenceKey, presenceData, REDIS_TTL.PRESENCE);

      // Set TTL on the sorted set
      await this.expire(roomPresenceKey, REDIS_TTL.PRESENCE);

      // Publish presence update for this room
      await this.publishJson(REDIS_CHANNELS.PRESENCE_UPDATE, {
        type: 'presence:update',
        roomId,
        userId,
        status,
        timestamp: now,
      });
    } catch (error) {
      this.logger.error(`Failed to set presence for user ${userId} in room ${roomId}`, error);
      throw error;
    }
  }

  /**
   * Remove user presence from a specific room
   *
   * @param userId - User ID
   * @param roomId - Room ID
   */
  async removeUserPresenceFromRoom(userId: string, roomId: string): Promise<void> {
    try {
      const roomPresenceKey = `${REDIS_KEYS.ROOM_PRESENCE}:${roomId}`;
      const userPresenceKey = `${REDIS_KEYS.ROOM_PRESENCE}:${roomId}:${userId}`;

      // Remove from sorted set
      await this.zrem(roomPresenceKey, userId);

      // Remove detailed presence data
      await this.del(userPresenceKey);

      // Publish presence update
      await this.publishJson(REDIS_CHANNELS.PRESENCE_UPDATE, {
        type: 'presence:offline',
        roomId,
        userId,
        status: 'OFFLINE',
        timestamp: Date.now(),
      });
    } catch (error) {
      this.logger.error(`Failed to remove presence for user ${userId} from room ${roomId}`, error);
      throw error;
    }
  }

  /**
   * Get users' presence in a room
   * Returns users active within the threshold period, with a maximum limit
   *
   * @param roomId - Room ID
   * @param thresholdMs - Only include users active within this period (default: 15 min)
   * @param limit - Maximum number of users to return (default: 200, max: 500)
   * @returns Array of presence entries with status and last seen
   */
  async getRoomPresenceList(
    roomId: string,
    thresholdMs: number = 15 * 60 * 1000,
    limit: number = 200
  ): Promise<RoomPresenceEntry[]> {
    try {
      // Enforce maximum limit to prevent DoS
      const safeLimit = Math.min(Math.max(1, limit), 500);

      const roomPresenceKey = `${REDIS_KEYS.ROOM_PRESENCE}:${roomId}`;
      const minScore = Date.now() - thresholdMs;

      // Get active users in the room with limit
      // Using zrangebyscore with LIMIT to cap results
      const userIds = await this.client.zrangebyscore(
        roomPresenceKey,
        minScore,
        '+inf',
        'LIMIT',
        0,
        safeLimit
      );

      if (userIds.length === 0) {
        return [];
      }

      // Use pipeline to batch Redis GET operations for better performance
      const pipeline = this.client.pipeline();
      for (const userId of userIds) {
        const userPresenceKey = `${REDIS_KEYS.ROOM_PRESENCE}:${roomId}:${userId}`;
        pipeline.get(userPresenceKey);
      }

      const results = await pipeline.exec();
      const presenceEntries: RoomPresenceEntry[] = [];
      const now = Date.now();

      for (let i = 0; i < userIds.length; i++) {
        const userId = userIds[i];
        if (!userId) continue; // Skip if userId is undefined

        const result = results?.[i];
        const rawData = result?.[1] as string | null;

        if (rawData) {
          try {
            const data = JSON.parse(rawData) as RoomPresenceEntry;
            // Determine effective status based on last seen time
            const effectiveStatus = this.calculateEffectiveStatus(data.lastSeenAt, data.status);
            presenceEntries.push({
              userId: data.userId,
              status: effectiveStatus,
              lastSeenAt: data.lastSeenAt,
            });
          } catch {
            // Invalid JSON, treat as online
            presenceEntries.push({
              userId,
              status: 'ONLINE',
              lastSeenAt: now,
            });
          }
        } else {
          // User is in sorted set but no detailed data - treat as online
          presenceEntries.push({
            userId,
            status: 'ONLINE',
            lastSeenAt: now,
          });
        }
      }

      return presenceEntries;
    } catch (error) {
      this.logger.error(`Failed to get presence list for room ${roomId}`, error);
      throw error;
    }
  }

  /**
   * Set user to idle status
   * Called after inactivity period (5 minutes)
   *
   * @param userId - User ID
   */
  async setUserIdle(userId: string): Promise<void> {
    const key = `${REDIS_KEYS.PRESENCE}:${userId}`;
    const existing = await this.getJson<RedisPresenceData>(key);

    if (existing && existing.status === 'ONLINE') {
      existing.status = 'IDLE';
      existing.lastSeenAt = Date.now();
      await this.setJson(key, existing, REDIS_TTL.PRESENCE);

      // Update presence in all rooms user is in
      const userRooms = await this.getUserRooms(userId);
      for (const roomId of userRooms) {
        try {
          await this.setUserPresenceInRoom(userId, roomId, 'IDLE');
        } catch (error) {
          // Log error but continue with other rooms to avoid inconsistent state
          this.logger.error(
            `Failed to set idle status for user ${userId} in room ${roomId}`,
            error
          );
        }
      }

      // Publish status update
      await this.publishJson(REDIS_CHANNELS.USER_STATUS, {
        userId,
        status: 'IDLE',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Start disconnect grace period
   * Marks user as potentially disconnecting - will go offline after grace period
   *
   * @param userId - User ID
   * @param graceMs - Grace period in milliseconds (default: 30 seconds)
   */
  async startDisconnectGracePeriod(userId: string, graceMs: number = 30000): Promise<void> {
    const key = `${REDIS_KEYS.DISCONNECT_GRACE}:${userId}`;
    const expiresAt = Date.now() + graceMs;
    // Ensure minimum TTL of 1 second (Redis SETEX requires TTL >= 1)
    const ttlSeconds = Math.max(1, Math.ceil(graceMs / 1000));
    await this.set(key, String(expiresAt), ttlSeconds);
  }

  /**
   * Cancel disconnect grace period (user reconnected)
   *
   * @param userId - User ID
   * @returns true if grace period was cancelled, false if none existed
   */
  async cancelDisconnectGracePeriod(userId: string): Promise<boolean> {
    const key = `${REDIS_KEYS.DISCONNECT_GRACE}:${userId}`;
    const deleted = await this.del(key);
    return deleted > 0;
  }

  /**
   * Check if user is in disconnect grace period
   *
   * @param userId - User ID
   * @returns true if user is in grace period
   */
  async isInDisconnectGracePeriod(userId: string): Promise<boolean> {
    const key = `${REDIS_KEYS.DISCONNECT_GRACE}:${userId}`;
    return this.exists(key);
  }

  /**
   * Calculate effective presence status based on last seen time
   *
   * @param lastSeenAt - Timestamp of last activity
   * @param currentStatus - Current stored status
   * @returns Effective status considering inactivity
   */
  private calculateEffectiveStatus(
    lastSeenAt: number,
    currentStatus: PresenceStatus
  ): PresenceStatus {
    if (currentStatus === 'OFFLINE') return 'OFFLINE';

    const now = Date.now();
    const timeSinceLastSeen = now - lastSeenAt;

    // 15 minutes = offline
    if (timeSinceLastSeen > 15 * 60 * 1000) {
      return 'OFFLINE';
    }

    // 5 minutes = idle (if currently online)
    if (timeSinceLastSeen > 5 * 60 * 1000 && currentStatus === 'ONLINE') {
      return 'IDLE';
    }

    return currentStatus;
  }

  /**
   * Clean up stale room presence entries
   *
   * @param roomId - Room ID to clean up
   * @param thresholdMs - Remove entries older than this (default: 15 min)
   * @returns Number of entries removed
   */
  async cleanupStaleRoomPresence(
    roomId: string,
    thresholdMs: number = 15 * 60 * 1000
  ): Promise<number> {
    const roomPresenceKey = `${REDIS_KEYS.ROOM_PRESENCE}:${roomId}`;
    const maxScore = Date.now() - thresholdMs;
    return this.zremrangebyscore(roomPresenceKey, '-inf', maxScore);
  }

  // ============================================
  // Typing Indicators
  // ============================================

  /**
   * Set user as typing in a room
   * Uses Redis SET with TTL for auto-expiry after 5 seconds
   *
   * @param userId - User ID
   * @param roomId - Room ID
   * @param username - Username for display
   * @returns List of currently typing users in the room
   */
  async setUserTyping(
    userId: string,
    roomId: string,
    username: string
  ): Promise<Array<{ userId: string; username: string }>> {
    // Input validation - inputs should already be validated by gateway DTOs
    if (!userId || !roomId || !username) {
      throw new BadRequestException('setUserTyping requires userId, roomId, and username');
    }

    try {
      const userTypingKey = `${REDIS_KEYS.TYPING}:${roomId}:${userId}`;
      const roomTypingKey = `${REDIS_KEYS.TYPING}:${roomId}`;

      // Store user's typing data with TTL
      await this.setJson(
        userTypingKey,
        { userId, username, timestamp: Date.now() },
        REDIS_TTL.TYPING
      );

      // Add user to room's typing set
      await this.sadd(roomTypingKey, userId);

      // Always refresh TTL to prevent premature expiry when users continue typing
      await this.expire(roomTypingKey, REDIS_TTL.TYPING);

      // Get current typing users
      const typingUsers = await this.getTypingUsers(roomId);

      // Publish typing update
      await this.publishJson(REDIS_CHANNELS.TYPING_UPDATE, {
        roomId,
        typingUsers,
        timestamp: Date.now(),
      });

      return typingUsers;
    } catch (error) {
      this.logger.error(`Failed to set typing status for user ${userId} in room ${roomId}`, error);
      throw error;
    }
  }

  /**
   * Remove user from typing in a room
   *
   * @param userId - User ID
   * @param roomId - Room ID
   * @returns List of currently typing users in the room
   */
  async removeUserTyping(
    userId: string,
    roomId: string
  ): Promise<Array<{ userId: string; username: string }>> {
    // Input validation - inputs should already be validated by gateway DTOs
    if (!userId || !roomId) {
      throw new BadRequestException('removeUserTyping requires userId and roomId');
    }

    try {
      const userTypingKey = `${REDIS_KEYS.TYPING}:${roomId}:${userId}`;
      const roomTypingKey = `${REDIS_KEYS.TYPING}:${roomId}`;

      // Remove user's typing data
      await this.del(userTypingKey);

      // Remove from room's typing set
      await this.srem(roomTypingKey, userId);

      // Get current typing users
      const typingUsers = await this.getTypingUsers(roomId);

      // Publish typing update
      await this.publishJson(REDIS_CHANNELS.TYPING_UPDATE, {
        roomId,
        typingUsers,
        timestamp: Date.now(),
      });

      return typingUsers;
    } catch (error) {
      this.logger.error(
        `Failed to remove typing status for user ${userId} in room ${roomId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Get list of users currently typing in a room
   *
   * @param roomId - Room ID
   * @returns Array of typing users with userId and username
   */
  async getTypingUsers(roomId: string): Promise<Array<{ userId: string; username: string }>> {
    const roomTypingKey = `${REDIS_KEYS.TYPING}:${roomId}`;

    // Get all user IDs in the typing set
    const userIds = await this.smembers(roomTypingKey);
    if (userIds.length === 0) {
      return [];
    }

    // Get detailed data for each user using pipeline for efficiency
    const pipeline = this.client.pipeline();
    for (const id of userIds) {
      const userTypingKey = `${REDIS_KEYS.TYPING}:${roomId}:${id}`;
      pipeline.get(userTypingKey);
    }

    const results = await pipeline.exec();
    const typingUsers: Array<{ userId: string; username: string }> = [];
    const expiredUsers: string[] = [];

    for (let i = 0; i < userIds.length; i++) {
      const userId = userIds[i];
      if (!userId) continue;

      const result = results?.[i];
      const rawData = result?.[1] as string | null;

      if (rawData) {
        try {
          const data = JSON.parse(rawData) as { userId: string; username: string };
          typingUsers.push({ userId: data.userId, username: data.username });
        } catch {
          expiredUsers.push(userId);
        }
      } else {
        // User's typing data expired but still in set - mark for cleanup
        expiredUsers.push(userId);
      }
    }

    // Clean up expired users from the set (non-blocking)
    if (expiredUsers.length > 0) {
      this.srem(roomTypingKey, ...expiredUsers).catch((error) => {
        this.logger.error(`Failed to clean up expired typing users: ${error}`);
      });
    }

    return typingUsers;
  }

  /**
   * Remove user from typing in all rooms (called on disconnect)
   *
   * @param userId - User ID
   */
  async removeUserTypingFromAllRooms(userId: string): Promise<void> {
    const userRooms = await this.getUserRooms(userId);
    await Promise.allSettled(userRooms.map((roomId) => this.removeUserTyping(userId, roomId)));
  }

  // ============================================
  // Rate Limiting
  // ============================================

  /**
   * Check rate limit using sliding window (atomic operation)
   * Uses single pipeline for atomicity - adds entry then checks count
   */
  async checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number = REDIS_TTL.RATE_LIMIT_WINDOW
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;
    const rateLimitKey = `${REDIS_KEYS.RATE_LIMIT}:${key}`;

    // Single atomic pipeline: clean, add, count, expire
    const pipeline = this.client.pipeline();
    pipeline.zremrangebyscore(rateLimitKey, '-inf', windowStart);
    pipeline.zadd(rateLimitKey, now, `${now}-${Math.random()}`);
    pipeline.zcard(rateLimitKey);
    pipeline.expire(rateLimitKey, windowSeconds);

    const results = await pipeline.exec();
    if (!results) {
      // Fail-open on Redis error
      this.logger.error('Redis pipeline returned null in checkRateLimit');
      return { allowed: true, remaining: limit, resetAt: now + windowSeconds * 1000 };
    }

    // Check for errors in pipeline results
    const hasError = results.some(([err]) => err !== null);
    if (hasError) {
      this.logger.error('Redis pipeline error in checkRateLimit:', results);
      return { allowed: true, remaining: limit, resetAt: now + windowSeconds * 1000 };
    }

    // Get count from zcard result (index 2)
    const zcardResult = results[2];
    const count = typeof zcardResult?.[1] === 'number' ? zcardResult[1] : 0;

    // If count exceeds limit, deny (the entry was added but request is rejected)
    const allowed = count <= limit;

    return {
      allowed,
      remaining: Math.max(0, limit - count),
      resetAt: now + windowSeconds * 1000,
    };
  }

  // ============================================
  // Caching
  // ============================================

  /**
   * Get or set cache with TTL
   */
  async getOrSet<T>(key: string, factory: () => Promise<T>, ttlSeconds: number): Promise<T> {
    const cached = await this.getJson<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.setJson(key, value, ttlSeconds);
    return value;
  }

  /**
   * Invalidate cache using SCAN (production-safe, non-blocking)
   */
  async invalidateCache(pattern: string): Promise<number> {
    let deletedCount = 0;
    let cursor = '0';

    try {
      do {
        const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;

        if (keys.length > 0) {
          deletedCount += await this.client.del(...keys);
        }
      } while (cursor !== '0');
    } catch (error: unknown) {
      this.logger.error(`Error invalidating cache with pattern ${pattern}:`, error);
      throw error;
    }

    return deletedCount;
  }
}
