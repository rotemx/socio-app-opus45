import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { PrismaService } from '../../database';
import {
  type CreateRoomDto,
  type UpdateRoomDto,
  type RoomDiscoveryDto,
  type UpdateMemberRoleDto,
} from './dto/rooms.dto';

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

    return this.prisma.roomMember.create({
      data: {
        roomId,
        userId,
        joinLocation: location
          ? { type: 'Point', coordinates: [location.lng, location.lat] }
          : undefined,
      },
    });
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
}
