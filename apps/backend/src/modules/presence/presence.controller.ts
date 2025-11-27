import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { type PresenceService } from './presence.service';
import { type UpdatePresenceDto, type GetUsersPresenceDto } from './dto/presence.dto';
import { CurrentUser } from '../../common/decorators';
import { type JwtPayload } from '../auth/dto/auth.dto';

/**
 * Presence Controller
 * Handles user online status endpoints
 */
@Controller('presence')
export class PresenceController {
  constructor(private readonly presenceService: PresenceService) {}

  /**
   * Get current user's presence
   * GET /presence/me
   */
  @Get('me')
  async getMyPresence(@CurrentUser() user: JwtPayload) {
    return this.presenceService.getPresence(user.sub);
  }

  /**
   * Update current user's presence status
   * PUT /presence/status
   */
  @Put('status')
  async updateStatus(@CurrentUser() user: JwtPayload, @Body() dto: UpdatePresenceDto) {
    await this.presenceService.updateStatus(user.sub, dto);
    return { success: true };
  }

  /**
   * Send heartbeat to maintain online status
   * POST /presence/heartbeat
   */
  @Post('heartbeat')
  async heartbeat(@CurrentUser() user: JwtPayload) {
    await this.presenceService.heartbeat(user.sub);
    return { success: true };
  }

  /**
   * Get presence for a specific user
   * GET /presence/:userId
   */
  @Get(':userId')
  async getUserPresence(@Param('userId') userId: string) {
    const presence = await this.presenceService.getPresence(userId);
    return presence ?? { userId, status: 'OFFLINE', lastSeenAt: null };
  }

  /**
   * Get presence for multiple users
   * POST /presence/batch
   */
  @Post('batch')
  async getBatchPresence(@Body() dto: GetUsersPresenceDto) {
    return this.presenceService.getMultiplePresence(dto.userIds);
  }

  /**
   * Get online users in a room
   * GET /presence/room/:roomId
   */
  @Get('room/:roomId')
  async getRoomOnlineUsers(@Param('roomId') roomId: string) {
    const userIds = await this.presenceService.getRoomOnlineUsers(roomId);
    return { roomId, onlineUserIds: userIds, count: userIds.length };
  }
}
