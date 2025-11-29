import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { UsersService } from './users.service';
import {
  type UpdateProfileDto,
  type UpdateSettingsDto,
  type UpdateLocationDto,
  type UserQueryDto,
} from './dto/users.dto';
import { CurrentUser } from '../../common/decorators';
import { type JwtPayload } from '../auth/dto/auth.dto';

/**
 * Users Controller
 * Handles user profile and settings endpoints
 */
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Get current user's profile
   * GET /users/me
   */
  @Get('me')
  async getMe(@CurrentUser() user: JwtPayload) {
    return this.usersService.findById(user.sub);
  }

  /**
   * Update current user's profile
   * PATCH /users/me
   */
  @Patch('me')
  async updateMe(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.sub, dto);
  }

  /**
   * Get current user's settings
   * GET /users/me/settings
   */
  @Get('me/settings')
  async getSettings(@CurrentUser() user: JwtPayload) {
    return this.usersService.getSettings(user.sub);
  }

  /**
   * Update current user's settings
   * PATCH /users/me/settings
   */
  @Patch('me/settings')
  async updateSettings(@CurrentUser() user: JwtPayload, @Body() dto: UpdateSettingsDto) {
    return this.usersService.updateSettings(user.sub, dto);
  }

  /**
   * Update current user's location
   * PATCH /users/me/location
   */
  @Patch('me/location')
  async updateLocation(@CurrentUser() user: JwtPayload, @Body() dto: UpdateLocationDto) {
    return this.usersService.updateLocation(user.sub, dto);
  }

  /**
   * Search users
   * GET /users
   */
  @Get()
  async searchUsers(@Query() query: UserQueryDto) {
    return this.usersService.searchUsers(query);
  }

  /**
   * Get user by ID
   * GET /users/:id
   */
  @Get(':id')
  async getUser(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  /**
   * Get user by username
   * GET /users/username/:username
   */
  @Get('username/:username')
  async getUserByUsername(@Param('username') username: string) {
    return this.usersService.findByUsername(username);
  }
}
