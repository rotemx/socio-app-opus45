import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
  Inject,
} from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT, REDIS_KEYS, REDIS_TTL, REDIS_CHANNELS } from './redis.constants';

/**
 * Presence data structure stored in Redis
 */
export interface RedisPresenceData {
  userId: string;
  status: 'ONLINE' | 'AWAY' | 'BUSY' | 'OFFLINE';
  lastSeenAt: number;
  deviceId?: string;
  rooms?: string[];
}

/**
 * Input for setUserOnline (lastSeenAt is auto-set)
 */
export interface SetUserOnlineInput {
  status: 'ONLINE' | 'AWAY' | 'BUSY';
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
