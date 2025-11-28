import { Injectable, Logger } from '@nestjs/common';
import { type PrismaService } from '../../database';
import { type UpdatePresenceDto, type PresenceResponse } from './dto/presence.dto';
import { type PresenceStatus } from '@prisma/client';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { RedisService } from '../../redis';

// Default device ID for web clients
const DEFAULT_DEVICE_ID = 'default';

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
   */
  async getMultiplePresence(userIds: string[]): Promise<PresenceResponse[]> {
    // Get most recent presence for each user using a subquery approach
    const presences = await this.prisma.userPresence.findMany({
      where: { userId: { in: userIds } },
      orderBy: { lastSeenAt: 'desc' },
    });

    // Deduplicate by userId (keeping most recent)
    const uniquePresences = new Map<string, (typeof presences)[0]>();
    for (const p of presences) {
      if (!uniquePresences.has(p.userId)) {
        uniquePresences.set(p.userId, p);
      }
    }

    return Array.from(uniquePresences.values()).map((p) => this.mapToResponse(p));
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
   * Cleanup stale presences (mark inactive users as offline)
   * This should be called periodically by a cron job
   * Cleans up both Redis and database
   */
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

    let effectiveStatus = presence.status;

    if (presence.status !== 'OFFLINE') {
      if (timeSinceLastSeen > this.OFFLINE_THRESHOLD_MS) {
        effectiveStatus = 'OFFLINE';
      } else if (timeSinceLastSeen > this.AWAY_THRESHOLD_MS && presence.status === 'ONLINE') {
        effectiveStatus = 'AWAY';
      }
    }

    return {
      userId: presence.userId,
      status: effectiveStatus,
      lastSeenAt: presence.lastSeenAt,
    };
  }
}
