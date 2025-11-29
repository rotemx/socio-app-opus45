import { Injectable, Logger, NotFoundException } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { PrismaService } from '../../database';
import {
  type UpdateProfileDto,
  type UpdateSettingsDto,
  type UpdateLocationDto,
  type UserQueryDto,
} from './dto/users.dto';

/**
 * Users Service
 * Handles user profile and settings management
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get user by ID
   */
  async findById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        isVerified: true,
        createdAt: true,
        lastActiveAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Get user by username
   */
  async findByUsername(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        isVerified: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Search users by username or display name
   */
  async searchUsers(query: UserQueryDto) {
    const where = query.search
      ? {
          OR: [
            { username: { contains: query.search, mode: 'insensitive' as const } },
            { displayName: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const users = await this.prisma.user.findMany({
      where,
      take: query.limit,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      skip: query.cursor ? 1 : 0,
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        isVerified: true,
      },
      orderBy: { username: 'asc' },
    });

    return {
      users,
      cursor: users.length === query.limit ? users[users.length - 1]?.id : null,
    };
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    this.logger.log(`Updating profile for user: ${userId}`);

    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
      },
    });
  }

  /**
   * Update user settings
   */
  async updateSettings(userId: string, dto: UpdateSettingsDto) {
    this.logger.log(`Updating settings for user: ${userId}`);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const currentSettings =
      typeof user.settings === 'object' && user.settings !== null
        ? (user.settings as Record<string, unknown>)
        : {};

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        settings: { ...currentSettings, ...dto },
      },
      select: {
        id: true,
        settings: true,
      },
    });
  }

  /**
   * Update user location
   */
  async updateLocation(userId: string, dto: UpdateLocationDto) {
    this.logger.log(`Updating location for user: ${userId}`);

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        currentLocation: {
          type: 'Point',
          coordinates: [dto.longitude, dto.latitude],
        },
        locationUpdatedAt: new Date(),
        ...(dto.precision && { locationPrecision: dto.precision }),
      },
      select: {
        id: true,
        locationPrecision: true,
        locationUpdatedAt: true,
      },
    });
  }

  /**
   * Get user's current settings
   */
  async getSettings(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user.settings;
  }

  /**
   * Update last active timestamp
   */
  async updateLastActive(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastActiveAt: new Date() },
    });
  }
}
