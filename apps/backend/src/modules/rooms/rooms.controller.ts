import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { RoomsService } from './rooms.service';
import {
  type CreateRoomDto,
  type UpdateRoomDto,
  type RoomDiscoveryDto,
  type JoinRoomDto,
  type UpdateMemberRoleDto,
  type NearbyRoomsDto,
} from './dto/rooms.dto';
import { CurrentUser, RateLimit, ParseUuidPipe } from '../../common';
import { type JwtPayload } from '../auth/dto/auth.dto';

/**
 * Rooms Controller
 * Handles room CRUD and discovery endpoints
 */
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  /**
   * Discover nearby rooms (legacy endpoint without PostGIS)
   * GET /rooms/discover
   *
   * @deprecated Use GET /rooms/nearby for better performance with PostGIS spatial queries
   */
  @Get('discover')
  @RateLimit({ limit: 100, windowSeconds: 60, keyPrefix: 'rooms:discovery' })
  async discoverRooms(@Query() query: RoomDiscoveryDto) {
    return this.roomsService.findNearbyRooms(query);
  }

  /**
   * Find nearby rooms using PostGIS spatial queries
   * GET /rooms/nearby
   * Returns rooms within specified radius, sorted by distance
   *
   * Note: Shares rate limit with /discover endpoint (100 req/min total)
   */
  @Get('nearby')
  @RateLimit({ limit: 100, windowSeconds: 60, keyPrefix: 'rooms:discovery' })
  async findNearbyRooms(@Query() query: NearbyRoomsDto) {
    return this.roomsService.findNearbyRoomsPostGIS(query);
  }

  /**
   * Get current user's rooms
   * GET /rooms/my
   */
  @Get('my')
  async getMyRooms(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: number,
    @Query('cursor') cursor?: string
  ) {
    return this.roomsService.getUserRooms(user.sub, limit, cursor);
  }

  /**
   * Create a new room
   * POST /rooms
   */
  @Post()
  async createRoom(@CurrentUser() user: JwtPayload, @Body() dto: CreateRoomDto) {
    return this.roomsService.createRoom(user.sub, dto);
  }

  /**
   * Get room by ID
   * GET /rooms/:id
   */
  @Get(':id')
  async getRoom(@Param('id', ParseUuidPipe) id: string) {
    return this.roomsService.findById(id);
  }

  /**
   * Update room
   * PATCH /rooms/:id
   */
  @Patch(':id')
  async updateRoom(
    @Param('id', ParseUuidPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateRoomDto
  ) {
    return this.roomsService.updateRoom(id, user.sub, dto);
  }

  /**
   * Join a room
   * POST /rooms/:id/join
   */
  @Post(':id/join')
  async joinRoom(
    @Param('id', ParseUuidPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: JoinRoomDto
  ) {
    const location =
      dto.latitude && dto.longitude ? { lat: dto.latitude, lng: dto.longitude } : undefined;
    return this.roomsService.joinRoom(id, user.sub, location);
  }

  /**
   * Leave a room
   * DELETE /rooms/:id/leave
   */
  @Delete(':id/leave')
  async leaveRoom(@Param('id', ParseUuidPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.roomsService.leaveRoom(id, user.sub);
  }

  /**
   * Get room members
   * GET /rooms/:id/members
   */
  @Get(':id/members')
  async getMembers(
    @Param('id', ParseUuidPipe) id: string,
    @Query('limit') limit?: number,
    @Query('cursor') cursor?: string
  ) {
    return this.roomsService.getMembers(id, limit, cursor);
  }

  /**
   * Update member role
   * PATCH /rooms/:id/members/:userId/role
   */
  @Patch(':id/members/:userId/role')
  async updateMemberRole(
    @Param('id', ParseUuidPipe) roomId: string,
    @Param('userId', ParseUuidPipe) targetUserId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateMemberRoleDto
  ) {
    return this.roomsService.updateMemberRole(roomId, targetUserId, user.sub, dto);
  }
}
