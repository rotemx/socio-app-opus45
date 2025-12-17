import { Controller, Get, Query } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { SearchService } from './search.service';
import {
  type SearchRoomsDto,
  type SearchMessagesDto,
  type SearchUsersDto,
} from './dto/search.dto';
import { CurrentUser, RateLimit } from '../../common/decorators';
import { type JwtPayload } from '../auth/dto/auth.dto';

/**
 * Search Controller
 * Provides search endpoints for rooms, messages, and users
 */
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  /**
   * Search rooms by name, description, or tags
   * GET /search/rooms
   *
   * Rate limited to 60 requests per minute to prevent abuse
   */
  @Get('rooms')
  @RateLimit({ limit: 60, windowSeconds: 60, keyPrefix: 'search:rooms' })
  async searchRooms(@Query() query: SearchRoomsDto) {
    return this.searchService.searchRooms(query);
  }

  /**
   * Search messages within a specific room
   * GET /search/messages
   *
   * Requires authentication and room membership
   * Rate limited to 30 requests per minute
   */
  @Get('messages')
  @RateLimit({ limit: 30, windowSeconds: 60, keyPrefix: 'search:messages' })
  async searchMessages(
    @Query() query: SearchMessagesDto,
    @CurrentUser() user: JwtPayload
  ) {
    return this.searchService.searchMessages(query, user.sub);
  }

  /**
   * Search users by username or display name
   * GET /search/users
   *
   * Only returns active, discoverable users
   * Rate limited to 60 requests per minute
   */
  @Get('users')
  @RateLimit({ limit: 60, windowSeconds: 60, keyPrefix: 'search:users' })
  async searchUsers(@Query() query: SearchUsersDto) {
    return this.searchService.searchUsers(query);
  }
}
