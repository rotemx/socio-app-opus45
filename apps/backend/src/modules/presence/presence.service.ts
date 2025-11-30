import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { PrismaService } from '../../database';
import {
  type UpdatePresenceDto,
  type PresenceResponse,
  type RoomPresenceResponse,
  type PresenceStatusType,
} from './dto/presence.dto';
import { type PresenceStatus } from '@prisma/client';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { RedisService } from '../../redis';

// Default device ID for web clients
const DEFAULT_DEVICE_ID = 'default';

// Grace period for reconnection (30 seconds)
const RECONNECT_GRACE_MS = 30 * 1000;

/**
 * Presence Service
 * Handles user online status tracking with Redis for fast caching
 * and PostgreSQL for persistence
 */
@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);

  // Consider users away after 5 minutes of inactivity
  private readonly AWAY_THRESHOLD_MS = 5 * 60 * 1000;
  // Consider users offline after 15 minutes of inactivity
  private readonly OFFLINE_THRESHOLD_MS = 15 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService
  ) {}

  /**
   * Update user's presence status
   * Updates both Redis (for fast reads) and PostgreSQL (for persistence)
   */
  async updateStatus(
    userId: string,
    dto: UpdatePresenceDto,
    deviceId = DEFAULT_DEVICE_ID
  ): Promise<void> {
    this.logger.debug(`Updating presence for user ${userId}: ${dto.status}`);

    // Update Redis cache
    if (dto.status === 'OFFLINE') {
      await this.redisService.setUserOffline(userId);
    } else {
      await this.redisService.setUserOnline(userId, {
        status: dto.status as 'ONLINE' | 'AWAY' | 'BUSY',
        deviceId,
      });
    }

    // Persist to database
    await this.prisma.userPresence.upsert({
      where: { userId_deviceId: { userId, deviceId } },
      update: {
        status: dto.status as PresenceStatus,
        lastSeenAt: new Date(),
      },
      create: {
        userId,
        deviceId,
        status: dto.status as PresenceStatus,
      },
    });
  }

  /**
   * Record a heartbeat from the user (updates lastSeenAt)
   * Updates Redis immediately, batches database updates
   */
  async heartbeat(userId: string, deviceId = DEFAULT_DEVICE_ID): Promise<void> {
    // Update Redis immediately for fast reads
    await this.redisService.heartbeat(userId);

    // Persist to database (could be batched in production)
    await this.prisma.userPresence.upsert({
      where: { userId_deviceId: { userId, deviceId } },
      update: {
        lastSeenAt: new Date(),
        status: 'ONLINE',
      },
      create: {
        userId,
        deviceId,
        status: 'ONLINE',
      },
    });
  }

  /**
   * Get presence for a single user (returns most recent presence record)
   */
  async getPresence(userId: string): Promise<PresenceResponse | null> {
    const presence = await this.prisma.userPresence.findFirst({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
    });

    if (!presence) {
      return null;
    }

    return this.mapToResponse(presence);
  }

  /**
   * Get presence for multiple users
   * Uses PostgreSQL DISTINCT ON for efficient single-query deduplication
   */
  async getMultiplePresence(userIds: string[]): Promise<PresenceResponse[]> {
    if (userIds.length === 0) {
      return [];
    }

    // Use PostgreSQL DISTINCT ON to get the most recent presence for each user
    // This is more efficient than fetching all records and deduplicating in memory
    const presences = await this.prisma.$queryRaw<
      Array<{
        userId: string;
        status: 'ONLINE' | 'AWAY' | 'BUSY' | 'OFFLINE';
        lastSeenAt: Date;
      }>
    >`
      SELECT DISTINCT ON ("userId") "userId", "status", "lastSeenAt"
      FROM "UserPresence"
      WHERE "userId" = ANY(${userIds}::uuid[])
      ORDER BY "userId", "lastSeenAt" DESC
    `;

    return presences.map((p) => this.mapToResponse(p));
  }

  /**
   * Get online users in a room
   * Uses Redis for fast lookups, falls back to database
   */
  async getRoomOnlineUsers(roomId: string): Promise<string[]> {
    // Try Redis first for fast lookup
    const redisOnlineUsers = await this.redisService.getOnlineUsersInRoom(roomId);
    if (redisOnlineUsers.length > 0) {
      return redisOnlineUsers;
    }

    // Fall back to database if Redis is empty or not available
    const thresholdTime = new Date(Date.now() - this.OFFLINE_THRESHOLD_MS);

    const members = await this.prisma.roomMember.findMany({
      where: { roomId },
      select: { userId: true },
    });

    const memberIds = members.map((m) => m.userId);

    const onlinePresences = await this.prisma.userPresence.findMany({
      where: {
        userId: { in: memberIds },
        status: { not: 'OFFLINE' },
        lastSeenAt: { gte: thresholdTime },
      },
      select: { userId: true },
      distinct: ['userId'],
    });

    return onlinePresences.map((p) => p.userId);
  }

  /**
   * Mark user as offline
   * Updates both Redis and database
   */
  async setOffline(userId: string, deviceId = DEFAULT_DEVICE_ID): Promise<void> {
    this.logger.debug(`Setting user ${userId} offline`);

    // Update Redis first
    await this.redisService.setUserOffline(userId);

    // Remove user from all room presence sorted sets
    const userRooms = await this.redisService.getUserRooms(userId);
    for (const roomId of userRooms) {
      await this.redisService.removeUserPresenceFromRoom(userId, roomId);
    }

    // Persist to database
    await this.prisma.userPresence.upsert({
      where: { userId_deviceId: { userId, deviceId } },
      update: {
        status: 'OFFLINE',
        lastSeenAt: new Date(),
      },
      create: {
        userId,
        deviceId,
        status: 'OFFLINE',
      },
    });
  }

  /**
   * Set user to idle status
   * Called after 5 minutes of inactivity
   *
   * @param userId - User ID
   * @param deviceId - Device ID (optional)
   */
  async setUserIdle(userId: string, deviceId = DEFAULT_DEVICE_ID): Promise<void> {
    this.logger.debug(`Setting user ${userId} to idle`);

    // Update Redis (handles room presence updates internally)
    await this.redisService.setUserIdle(userId);

    // Persist to database
    await this.prisma.userPresence.upsert({
      where: { userId_deviceId: { userId, deviceId } },
      update: {
        status: 'AWAY', // Using AWAY as IDLE equivalent in DB (Prisma doesn't have IDLE)
        lastSeenAt: new Date(),
      },
      create: {
        userId,
        deviceId,
        status: 'AWAY',
      },
    });
  }

  /**
   * Set user presence in a specific room
   * Updates both global presence and room-specific presence
   *
   * @param userId - User ID
   * @param roomId - Room ID
   * @param status - Presence status (ONLINE, IDLE, AWAY, BUSY)
   */
  async setUserPresenceInRoom(
    userId: string,
    roomId: string,
    status: Exclude<PresenceStatusType, 'OFFLINE'>
  ): Promise<void> {
    this.logger.debug(`Setting user ${userId} presence in room ${roomId}: ${status}`);

    // Update room-specific presence in Redis
    await this.redisService.setUserPresenceInRoom(userId, roomId, status);

    // Also update global presence if setting to ONLINE
    if (status === 'ONLINE') {
      await this.redisService.setUserOnline(userId, { status: 'ONLINE' });
    }
  }

  /**
   * Get presence of all users in a room
   * Returns detailed presence information for each member
   *
   * @param roomId - Room ID
   * @returns Room presence response with member statuses
   */
  async getRoomPresence(roomId: string): Promise<RoomPresenceResponse> {
    // Get presence from Redis (fast)
    const presenceEntries = await this.redisService.getRoomPresenceList(roomId);

    // Calculate totals for all presence statuses
    const totalOnline = presenceEntries.filter((e) => e.status === 'ONLINE').length;
    const totalIdle = presenceEntries.filter((e) => e.status === 'IDLE').length;
    const totalAway = presenceEntries.filter((e) => e.status === 'AWAY').length;
    const totalBusy = presenceEntries.filter((e) => e.status === 'BUSY').length;
    const totalOffline = presenceEntries.filter((e) => e.status === 'OFFLINE').length;

    return {
      roomId,
      members: presenceEntries,
      totalOnline,
      totalIdle,
      totalAway,
      totalBusy,
      totalOffline,
    };
  }

  /**
   * Start disconnect grace period for user
   * User will be marked offline after grace period if they don't reconnect
   *
   * @param userId - User ID
   * @returns true if grace period was started
   */
  async startDisconnectGracePeriod(userId: string): Promise<boolean> {
    this.logger.debug(`Starting disconnect grace period for user ${userId}`);
    await this.redisService.startDisconnectGracePeriod(userId, RECONNECT_GRACE_MS);
    return true;
  }

  /**
   * Cancel disconnect grace period (user reconnected)
   *
   * @param userId - User ID
   * @returns true if grace period was cancelled, false if none existed
   */
  async cancelDisconnectGracePeriod(userId: string): Promise<boolean> {
    try {
      const cancelled = await this.redisService.cancelDisconnectGracePeriod(userId);
      if (cancelled) {
        this.logger.debug(`Cancelled disconnect grace period for user ${userId}`);
      }
      return cancelled;
    } catch (error) {
      this.logger.error(`Failed to cancel disconnect grace period for user ${userId}`, error);
      return false;
    }
  }

  /**
   * Check if user is in disconnect grace period
   *
   * @param userId - User ID
   * @returns true if user is in grace period
   */
  async isInDisconnectGracePeriod(userId: string): Promise<boolean> {
    try {
      return await this.redisService.isInDisconnectGracePeriod(userId);
    } catch (error) {
      this.logger.error(`Failed to check disconnect grace period for user ${userId}`, error);
      return false;
    }
  }

  /**
   * Handle user reconnection
   * Cancels grace period and restores online status
   *
   * @param userId - User ID
   * @param deviceId - Device ID
   */
  async handleReconnection(userId: string, deviceId = DEFAULT_DEVICE_ID): Promise<void> {
    try {
      // Cancel any pending grace period
      const wasInGracePeriod = await this.cancelDisconnectGracePeriod(userId);

      if (wasInGracePeriod) {
        this.logger.debug(`User ${userId} reconnected within grace period`);
      }

      // Restore online status
      await this.updateStatus(userId, { status: 'ONLINE' }, deviceId);

      // Re-add to room presence for all rooms user was in
      const userRooms = await this.redisService.getUserRooms(userId);
      for (const roomId of userRooms) {
        try {
          await this.setUserPresenceInRoom(userId, roomId, 'ONLINE');
        } catch (roomError) {
          // Log but continue with other rooms
          this.logger.error(
            `Failed to restore presence in room ${roomId} for user ${userId}`,
            roomError
          );
        }
      }
    } catch (error) {
      this.logger.error(`Failed to handle reconnection for user ${userId}`, error);
      throw error;
    }
  }

  /**
   * Get last seen timestamp for a user
   *
   * @param userId - User ID
   * @returns Last seen timestamp or null if never seen
   */
  async getLastSeen(userId: string): Promise<Date | null> {
    const presence = await this.getPresence(userId);
    return presence?.lastSeenAt ?? null;
  }

  /**
   * Cleanup stale presences (mark inactive users as offline)
   * This should be called periodically by a cron job
   * Cleans up both Redis and database
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async cleanupStalePresences(): Promise<number> {
    // Clean up stale Redis entries
    const redisCleanedCount = await this.redisService.cleanupStalePresence(
      this.OFFLINE_THRESHOLD_MS
    );
    if (redisCleanedCount > 0) {
      this.logger.log(`Cleaned up ${redisCleanedCount} stale Redis presence entries`);
    }

    // Clean up database
    const thresholdTime = new Date(Date.now() - this.OFFLINE_THRESHOLD_MS);

    const result = await this.prisma.userPresence.updateMany({
      where: {
        status: { not: 'OFFLINE' },
        lastSeenAt: { lt: thresholdTime },
      },
      data: {
        status: 'OFFLINE',
      },
    });

    if (result.count > 0) {
      this.logger.log(`Marked ${result.count} stale users as offline in database`);
    }

    return result.count;
  }

  /**
   * Map database presence to response DTO
   * Calculates effective status based on lastSeenAt time
   */
  private mapToResponse(presence: {
    userId: string;
    status: PresenceStatus;
    lastSeenAt: Date;
  }): PresenceResponse {
    // Adjust status based on lastSeenAt
    const now = Date.now();
    const lastSeen = presence.lastSeenAt.getTime();
    const timeSinceLastSeen = now - lastSeen;

    let effectiveStatus: PresenceStatusType = presence.status;

    if (presence.status !== 'OFFLINE') {
      if (timeSinceLastSeen > this.OFFLINE_THRESHOLD_MS) {
        effectiveStatus = 'OFFLINE';
      } else if (timeSinceLastSeen > this.AWAY_THRESHOLD_MS && presence.status === 'ONLINE') {
        // Map to IDLE instead of AWAY for time-based inactivity
        effectiveStatus = 'IDLE';
      }
    }

    return {
      userId: presence.userId,
      status: effectiveStatus,
      lastSeenAt: presence.lastSeenAt,
    };
  }
}
