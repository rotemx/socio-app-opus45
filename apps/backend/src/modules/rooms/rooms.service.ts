import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { PrismaService } from '../../database';
import {
  type CreateRoomDto,
  type UpdateRoomDto,
  type RoomDiscoveryDto,
  type UpdateMemberRoleDto,
} from './dto/rooms.dto';

/**
 * GeoJSON Point structure for location data
 * Index signature required for Prisma JSON compatibility
 */
interface GeoJsonPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
  [key: string]: unknown; // Required for Prisma JSON type compatibility
}

/**
 * Weighted location for centroid calculation
 */
interface WeightedLocation {
  lat: number;
  lng: number;
  weight: number;
}

/** Creator weight in location calculation (40%) */
const CREATOR_WEIGHT = 0.4;
/** Total members weight in location calculation (60%) */
const MEMBERS_WEIGHT = 0.6;

/**
 * Rooms Service
 * Handles room CRUD operations and discovery
 */
@Injectable()
export class RoomsService {
  private readonly logger = new Logger(RoomsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new chat room
   */
  async createRoom(creatorId: string, dto: CreateRoomDto) {
    this.logger.log(`Creating room: ${dto.name} by user: ${creatorId}`);

    const room = await this.prisma.chatRoom.create({
      data: {
        name: dto.name,
        description: dto.description,
        creatorId,
        location: {
          type: 'Point',
          coordinates: [dto.longitude, dto.latitude],
        },
        radiusMeters: dto.radiusMeters,
        isPublic: dto.isPublic,
        maxMembers: dto.maxMembers,
        tags: dto.tags,
      },
      include: {
        creator: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        _count: { select: { members: true } },
      },
    });

    // Add creator as a member with CREATOR role
    await this.prisma.roomMember.create({
      data: {
        roomId: room.id,
        userId: creatorId,
        role: 'CREATOR',
        joinLocation: room.location ?? undefined,
      },
    });

    // Calculate initial room location (async, non-blocking)
    this.calculateRoomLocation(room.id).catch((error) => {
      this.logger.error(
        `Failed to calculate initial location for room ${room.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    });

    return room;
  }

  /**
   * Find nearby rooms using PostGIS
   * Uses raw SQL for spatial queries
   */
  async findNearbyRooms(dto: RoomDiscoveryDto) {
    this.logger.log(`Finding rooms near: ${dto.latitude}, ${dto.longitude}`);

    // TODO: Implement PostGIS spatial query
    // For now, return basic query without spatial filtering
    const rooms = await this.prisma.chatRoom.findMany({
      where: {
        isActive: true,
        isPublic: true,
        ...(dto.tags && { tags: { hasSome: dto.tags } }),
      },
      take: dto.limit,
      cursor: dto.cursor ? { id: dto.cursor } : undefined,
      skip: dto.cursor ? 1 : 0,
      include: {
        creator: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        _count: { select: { members: true } },
      },
      orderBy: { lastActivityAt: 'desc' },
    });

    return {
      rooms,
      cursor: rooms.length === dto.limit ? rooms[rooms.length - 1]?.id : null,
    };
  }

  /**
   * Get room by ID
   */
  async findById(roomId: string) {
    const room = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: {
        creator: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        _count: { select: { members: true, messages: true } },
      },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return room;
  }

  /**
   * Update room details
   */
  async updateRoom(roomId: string, userId: string, dto: UpdateRoomDto) {
    const room = await this.findById(roomId);

    // Check if user is creator or admin
    const member = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });

    if (!member || !['CREATOR', 'ADMIN'].includes(member.role)) {
      throw new ForbiddenException('Not authorized to update this room');
    }

    return this.prisma.chatRoom.update({
      where: { id: roomId },
      data: {
        ...dto,
        ...(dto.settings && {
          settings: {
            ...(typeof room.settings === 'object' && room.settings !== null
              ? (room.settings as Record<string, unknown>)
              : {}),
            ...dto.settings,
          },
        }),
      },
    });
  }

  /**
   * Join a room
   */
  async joinRoom(roomId: string, userId: string, location?: { lat: number; lng: number }) {
    const room = await this.findById(roomId);

    // Check if user is already a member
    const existingMember = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });

    if (existingMember) {
      throw new ConflictException('Already a member of this room');
    }

    // Check max members
    const memberCount = await this.prisma.roomMember.count({ where: { roomId } });
    if (memberCount >= room.maxMembers) {
      throw new ForbiddenException('Room is full');
    }

    const member = await this.prisma.roomMember.create({
      data: {
        roomId,
        userId,
        joinLocation: location
          ? { type: 'Point', coordinates: [location.lng, location.lat] }
          : undefined,
      },
    });

    // Recalculate room location after member joins (async, non-blocking)
    this.calculateRoomLocation(roomId).catch((error) => {
      this.logger.error(
        `Failed to recalculate location after join for room ${roomId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    });

    return member;
  }

  /**
   * Leave a room
   */
  async leaveRoom(roomId: string, userId: string) {
    const member = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });

    if (!member) {
      throw new NotFoundException('Not a member of this room');
    }

    if (member.role === 'CREATOR') {
      throw new ForbiddenException('Creator cannot leave the room');
    }

    await this.prisma.roomMember.delete({
      where: { roomId_userId: { roomId, userId } },
    });

    // Recalculate room location after member leaves (async, non-blocking)
    this.calculateRoomLocation(roomId).catch((error) => {
      this.logger.error(
        `Failed to recalculate location after leave for room ${roomId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    });
  }

  /**
   * Get room members
   */
  async getMembers(roomId: string, limit = 50, cursor?: string) {
    const members = await this.prisma.roomMember.findMany({
      where: { roomId },
      take: limit,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      include: {
        user: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return {
      members,
      cursor: members.length === limit ? members[members.length - 1]?.id : null,
    };
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    roomId: string,
    targetUserId: string,
    actorUserId: string,
    dto: UpdateMemberRoleDto
  ) {
    // Check if actor has permission
    const actorMember = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId: actorUserId } },
    });

    if (!actorMember || !['CREATOR', 'ADMIN'].includes(actorMember.role)) {
      throw new ForbiddenException('Not authorized to update roles');
    }

    // Cannot change creator role
    const targetMember = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId: targetUserId } },
    });

    if (!targetMember) {
      throw new NotFoundException('Member not found');
    }

    if (targetMember.role === 'CREATOR') {
      throw new ForbiddenException('Cannot change creator role');
    }

    return this.prisma.roomMember.update({
      where: { roomId_userId: { roomId, userId: targetUserId } },
      data: { role: dto.role },
    });
  }

  /**
   * Get rooms user is a member of
   */
  async getUserRooms(userId: string, limit = 50, cursor?: string) {
    const memberships = await this.prisma.roomMember.findMany({
      where: { userId },
      take: limit,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      include: {
        room: {
          include: {
            creator: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { lastReadAt: 'desc' },
    });

    return {
      rooms: memberships.map((m) => ({
        ...m.room,
        membership: { role: m.role, isMuted: m.isMuted },
      })),
      cursor: memberships.length === limit ? memberships[memberships.length - 1]?.id : null,
    };
  }

  // =====================================================
  // DYNAMIC ROOM LOCATION CALCULATION
  // =====================================================

  /**
   * Calculate dynamic room location based on weighted member positions
   *
   * Formula:
   * - 40% weight: Creator's current location
   * - 60% weight: Distributed among members based on their activity weights
   *
   * @param roomId - Room ID to calculate location for
   * @returns Updated room with computed location, or null if calculation not possible
   */
  async calculateRoomLocation(roomId: string): Promise<GeoJsonPoint | null> {
    const room = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: {
        creator: {
          select: { id: true, currentLocation: true },
        },
        members: {
          select: {
            userId: true,
            joinLocation: true,
            activityWeight: true,
            user: {
              select: { currentLocation: true },
            },
          },
        },
      },
    });

    if (!room) {
      this.logger.warn(`Room not found for location calculation: ${roomId}`);
      return null;
    }

    const weightedLocations: WeightedLocation[] = [];
    let totalWeight = 0;

    // Add creator location (40% weight)
    const creatorLocation = this.extractLocation(room.creator?.currentLocation);
    if (creatorLocation) {
      weightedLocations.push({
        lat: creatorLocation.lat,
        lng: creatorLocation.lng,
        weight: CREATOR_WEIGHT,
      });
      totalWeight += CREATOR_WEIGHT;
    }

    // Calculate total activity weight of all members for normalization
    const totalActivityWeight = room.members.reduce(
      (sum, m) => sum + Number(m.activityWeight),
      0
    );

    // Add member locations (60% weight distributed by activity)
    if (totalActivityWeight > 0) {
      for (const member of room.members) {
        // Prefer current location, fall back to join location
        const memberLocation =
          this.extractLocation(member.user.currentLocation) ||
          this.extractLocation(member.joinLocation);

        if (memberLocation) {
          // Normalize activity weight and apply to 60% member allocation
          const normalizedWeight =
            (Number(member.activityWeight) / totalActivityWeight) * MEMBERS_WEIGHT;

          weightedLocations.push({
            lat: memberLocation.lat,
            lng: memberLocation.lng,
            weight: normalizedWeight,
          });
          totalWeight += normalizedWeight;
        }
      }
    }

    // If no valid locations, use room's original location
    if (weightedLocations.length === 0) {
      this.logger.debug(`No member locations for room ${roomId}, keeping original location`);
      return null;
    }

    // Calculate weighted centroid
    const computedLocation = this.calculateWeightedCentroid(weightedLocations, totalWeight);

    // Update room with computed location
    await this.prisma.chatRoom.update({
      where: { id: roomId },
      data: {
        computedLocation: {
          type: computedLocation.type,
          coordinates: computedLocation.coordinates,
        },
      },
    });

    this.logger.debug(
      `Computed location for room ${roomId}: [${computedLocation.coordinates[0]}, ${computedLocation.coordinates[1]}]`
    );

    return computedLocation;
  }

  /**
   * Extract lat/lng from various location JSON formats
   */
  private extractLocation(location: unknown): { lat: number; lng: number } | null {
    if (!location || typeof location !== 'object') {
      return null;
    }

    const loc = location as Record<string, unknown>;

    // GeoJSON Point format: { type: 'Point', coordinates: [lng, lat] }
    if (loc.type === 'Point' && Array.isArray(loc.coordinates)) {
      const coords = loc.coordinates as number[];
      const lng = coords[0];
      const lat = coords[1];
      if (
        lng !== undefined &&
        lat !== undefined &&
        this.isValidCoordinate(lat, lng)
      ) {
        return { lat, lng };
      }
    }

    // Simple format: { lat, lng } or { latitude, longitude }
    const lat = loc.lat ?? loc.latitude;
    const lng = loc.lng ?? loc.longitude;

    if (
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      this.isValidCoordinate(lat, lng)
    ) {
      return { lat, lng };
    }

    return null;
  }

  /**
   * Validate that coordinates are within valid ranges
   */
  private isValidCoordinate(lat: number, lng: number): boolean {
    return (
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      !isNaN(lat) &&
      !isNaN(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    );
  }

  /**
   * Calculate weighted centroid from multiple locations
   */
  private calculateWeightedCentroid(
    locations: WeightedLocation[],
    totalWeight: number
  ): GeoJsonPoint {
    let sumLat = 0;
    let sumLng = 0;

    for (const loc of locations) {
      sumLat += loc.lat * loc.weight;
      sumLng += loc.lng * loc.weight;
    }

    // Normalize by total weight
    const centroidLat = totalWeight > 0 ? sumLat / totalWeight : sumLat;
    const centroidLng = totalWeight > 0 ? sumLng / totalWeight : sumLng;

    return {
      type: 'Point',
      coordinates: [centroidLng, centroidLat],
    };
  }

  /**
   * Recalculate location for all active rooms
   * Runs hourly via cron job
   */
  @Cron(CronExpression.EVERY_HOUR)
  async recalculateAllRoomLocations(): Promise<void> {
    this.logger.log('Starting hourly room location recalculation');

    const activeRooms = await this.prisma.chatRoom.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    let successCount = 0;
    let errorCount = 0;

    for (const room of activeRooms) {
      try {
        await this.calculateRoomLocation(room.id);
        successCount++;
      } catch (error) {
        errorCount++;
        this.logger.error(
          `Failed to recalculate location for room ${room.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    this.logger.log(
      `Room location recalculation complete: ${successCount} success, ${errorCount} errors`
    );
  }
}
