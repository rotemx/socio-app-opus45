import { Injectable, Logger } from '@nestjs/common';
import { type PrismaService } from '../../database';
import { type UpdatePresenceDto, type PresenceResponse } from './dto/presence.dto';
import { type PresenceStatus } from '@prisma/client';

// Default device ID for web clients
const DEFAULT_DEVICE_ID = 'default';

/**
 * Presence Service
 * Handles user online status tracking
 */
@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);

  // Consider users away after 5 minutes of inactivity
  private readonly AWAY_THRESHOLD_MS = 5 * 60 * 1000;
  // Consider users offline after 15 minutes of inactivity
  private readonly OFFLINE_THRESHOLD_MS = 15 * 60 * 1000;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Update user's presence status
   */
  async updateStatus(
    userId: string,
    dto: UpdatePresenceDto,
    deviceId = DEFAULT_DEVICE_ID
  ): Promise<void> {
    this.logger.debug(`Updating presence for user ${userId}: ${dto.status}`);

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
   */
  async heartbeat(userId: string, deviceId = DEFAULT_DEVICE_ID): Promise<void> {
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
   */
  async getRoomOnlineUsers(roomId: string): Promise<string[]> {
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
   */
  async setOffline(userId: string, deviceId = DEFAULT_DEVICE_ID): Promise<void> {
    this.logger.debug(`Setting user ${userId} offline`);

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
   */
  async cleanupStalePresences(): Promise<number> {
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
      this.logger.log(`Marked ${result.count} stale users as offline`);
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
      } else if (
        timeSinceLastSeen > this.AWAY_THRESHOLD_MS &&
        presence.status === 'ONLINE'
      ) {
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
