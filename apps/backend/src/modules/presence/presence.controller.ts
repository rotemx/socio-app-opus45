import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  ParseUUIDPipe,
  ForbiddenException,
} from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { PresenceService } from './presence.service';
import {
  type UpdatePresenceDto,
  type GetUsersPresenceDto,
  type UpdateRoomPresenceDto,
} from './dto/presence.dto';
import { CurrentUser, RateLimit } from '../../common/decorators';
import { type JwtPayload } from '../auth/dto/auth.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { PrismaService } from '../../database';

/**
 * Presence Controller
 * Handles user online status endpoints
 */
@Controller('presence')
export class PresenceController {
  constructor(
    private readonly presenceService: PresenceService,
    private readonly prisma: PrismaService
  ) {}

  /**
   * Check if user is a member of a room
   * Throws ForbiddenException if not authorized
   */
  private async verifyRoomMembership(userId: string, roomId: string): Promise<void> {
    const membership = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });

    if (!membership) {
      throw new ForbiddenException('Not a member of this room');
    }
  }

  // ============================================
  // SPECIFIC ROUTES (must come before parameterized routes)
  // ============================================

  /**
   * Get current user's presence
   * GET /presence/me
   */
  @Get('me')
  @RateLimit({ limit: 60, windowSeconds: 60, perUser: true })
  async getMyPresence(@CurrentUser() user: JwtPayload) {
    return this.presenceService.getPresence(user.sub);
  }

  /**
   * Update current user's presence status
   * PUT /presence/status
   */
  @Put('status')
  @RateLimit({ limit: 30, windowSeconds: 60, perUser: true })
  async updateStatus(@CurrentUser() user: JwtPayload, @Body() dto: UpdatePresenceDto) {
    await this.presenceService.updateStatus(user.sub, dto);
    return { success: true };
  }

  /**
   * Send heartbeat to maintain online status
   * POST /presence/heartbeat
   * Rate limited to 2 per second (120 per minute) to prevent abuse
   */
  @Post('heartbeat')
  @RateLimit({ limit: 120, windowSeconds: 60, perUser: true })
  async heartbeat(@CurrentUser() user: JwtPayload) {
    await this.presenceService.heartbeat(user.sub);
    return { success: true };
  }

  /**
   * Get presence for multiple users
   * POST /presence/batch
   */
  @Post('batch')
  @RateLimit({ limit: 30, windowSeconds: 60, perUser: true })
  async getBatchPresence(@Body() dto: GetUsersPresenceDto) {
    return this.presenceService.getMultiplePresence(dto.userIds);
  }

  /**
   * Set user to idle status
   * POST /presence/idle
   */
  @Post('idle')
  @RateLimit({ limit: 30, windowSeconds: 60, perUser: true })
  async setIdle(@CurrentUser() user: JwtPayload) {
    await this.presenceService.setUserIdle(user.sub);
    return { success: true };
  }

  // ============================================
  // ROOM ROUTES (must come before :userId routes)
  // ============================================

  /**
   * Get online users in a room
   * GET /presence/room/:roomId/online
   * Requires user to be a member of the room
   */
  @Get('room/:roomId/online')
  @RateLimit({ limit: 60, windowSeconds: 60, perUser: true })
  async getRoomOnlineUsers(
    @CurrentUser() user: JwtPayload,
    @Param('roomId', ParseUUIDPipe) roomId: string
  ) {
    await this.verifyRoomMembership(user.sub, roomId);
    const userIds = await this.presenceService.getRoomOnlineUsers(roomId);
    return { roomId, onlineUserIds: userIds, count: userIds.length };
  }

  /**
   * Get detailed presence for all users in a room
   * GET /presence/room/:roomId
   * Requires user to be a member of the room
   */
  @Get('room/:roomId')
  @RateLimit({ limit: 60, windowSeconds: 60, perUser: true })
  async getRoomPresence(
    @CurrentUser() user: JwtPayload,
    @Param('roomId', ParseUUIDPipe) roomId: string
  ) {
    await this.verifyRoomMembership(user.sub, roomId);
    return this.presenceService.getRoomPresence(roomId);
  }

  /**
   * Update user's presence in a specific room
   * PUT /presence/room
   * Requires user to be a member of the room
   */
  @Put('room')
  @RateLimit({ limit: 30, windowSeconds: 60, perUser: true })
  async updateRoomPresence(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateRoomPresenceDto
  ) {
    await this.verifyRoomMembership(user.sub, dto.roomId);
    await this.presenceService.setUserPresenceInRoom(user.sub, dto.roomId, dto.status);
    return { success: true };
  }

  // ============================================
  // PARAMETERIZED ROUTES (must come last)
  // ============================================

  /**
   * Get last seen timestamp for a user
   * GET /presence/:userId/last-seen
   */
  @Get(':userId/last-seen')
  @RateLimit({ limit: 60, windowSeconds: 60, perUser: true })
  async getLastSeen(@Param('userId', ParseUUIDPipe) userId: string) {
    const lastSeen = await this.presenceService.getLastSeen(userId);
    return { userId, lastSeenAt: lastSeen };
  }

  /**
   * Get presence for a specific user
   * GET /presence/:userId
   */
  @Get(':userId')
  @RateLimit({ limit: 60, windowSeconds: 60, perUser: true })
  async getUserPresence(@Param('userId', ParseUUIDPipe) userId: string) {
    const presence = await this.presenceService.getPresence(userId);
    return presence ?? { userId, status: 'OFFLINE', lastSeenAt: null };
  }
}
