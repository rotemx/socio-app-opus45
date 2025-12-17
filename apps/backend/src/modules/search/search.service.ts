import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { PrismaService } from '../../database';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { RedisService } from '../../redis';
import {
  type SearchRoomsDto,
  type SearchMessagesDto,
  type SearchUsersDto,
  type RoomSearchResult,
  type MessageSearchResult,
  type UserSearchResult,
  type SearchResponse,
} from './dto/search.dto';

/** Cache TTL for search results (5 minutes) */
const SEARCH_CACHE_TTL = 300;

/** Minimum similarity threshold for pg_trgm (0.0 - 1.0) */
const SIMILARITY_THRESHOLD = 0.1;

/**
 * Search Service
 * Provides full-text search using PostgreSQL pg_trgm extension
 */
@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService
  ) {}

  /**
   * Search rooms by name, description, or tags
   * Uses pg_trgm for fuzzy text matching with ts_headline for highlighting
   */
  async searchRooms(dto: SearchRoomsDto): Promise<SearchResponse<RoomSearchResult>> {
    const cacheKey = `search:rooms:${this.hashQuery(dto)}`;

    // Check cache first
    const cached = await this.redis.getJson<SearchResponse<RoomSearchResult>>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for room search: ${dto.q}`);
      return cached;
    }

    // Log with reduced query info for privacy
    this.logger.log(`Searching rooms: query length=${dto.q.length}, limit=${dto.limit}`);

    type RoomQueryResult = {
      id: string;
      name: string;
      description: string | null;
      avatar_url: string | null;
      tags: string[];
      is_public: boolean;
      created_at: Date;
      last_activity_at: Date;
      member_count: bigint;
      creator_id: string | null;
      creator_username: string | null;
      creator_display_name: string | null;
      creator_avatar_url: string | null;
      name_highlight: string | null;
      description_highlight: string | null;
      similarity: number;
    };

    // Build cursor condition for pagination
    let cursorCondition = Prisma.empty;
    if (dto.cursor) {
      const [cursorSimilarity, cursorId] = dto.cursor.split('_');
      if (cursorSimilarity && cursorId) {
        cursorCondition = Prisma.sql`
          AND (similarity < ${parseFloat(cursorSimilarity)}
               OR (similarity = ${parseFloat(cursorSimilarity)} AND r.id > ${cursorId}::uuid))
        `;
      }
    }

    // Build tags filter
    const tagsFilter =
      dto.tags && dto.tags.length > 0
        ? Prisma.sql`AND r.tags && ${dto.tags}::text[]`
        : Prisma.empty;

    const results = await this.prisma.$queryRaw<RoomQueryResult[]>`
      WITH search_results AS (
        SELECT
          r.id,
          r.name,
          r.description,
          r.avatar_url,
          r.tags,
          r.is_public,
          r.created_at,
          r.last_activity_at,
          r.creator_id,
          GREATEST(
            similarity(r.name, ${dto.q}),
            similarity(COALESCE(r.description, ''), ${dto.q})
          ) AS similarity
        FROM chat_rooms r
        WHERE r.is_active = true
          AND r.is_public = true
          AND (
            similarity(r.name, ${dto.q}) > ${SIMILARITY_THRESHOLD}
            OR similarity(COALESCE(r.description, ''), ${dto.q}) > ${SIMILARITY_THRESHOLD}
            OR r.name ILIKE '%' || ${dto.q} || '%'
            OR r.description ILIKE '%' || ${dto.q} || '%'
            OR ${dto.q} = ANY(r.tags)
          )
          ${tagsFilter}
          ${cursorCondition}
      )
      SELECT
        sr.id,
        sr.name,
        sr.description,
        sr.avatar_url,
        sr.tags,
        sr.is_public,
        sr.created_at,
        sr.last_activity_at,
        sr.creator_id,
        sr.similarity,
        u.username AS creator_username,
        u.display_name AS creator_display_name,
        u.avatar_url AS creator_avatar_url,
        (SELECT COUNT(*) FROM room_members rm WHERE rm.room_id = sr.id) AS member_count,
        ts_headline('english', sr.name, plainto_tsquery('english', ${dto.q}),
          'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=10') AS name_highlight,
        ts_headline('english', COALESCE(sr.description, ''), plainto_tsquery('english', ${dto.q}),
          'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=10') AS description_highlight
      FROM search_results sr
      LEFT JOIN users u ON sr.creator_id = u.id
      ORDER BY sr.similarity DESC, sr.id ASC
      LIMIT ${dto.limit + 1}
    `;

    // Check if there are more results
    const hasMore = results.length > dto.limit;
    const rooms = hasMore ? results.slice(0, dto.limit) : results;

    // Transform results
    const transformedRooms: RoomSearchResult[] = rooms.map((room) => ({
      id: room.id,
      name: room.name,
      description: room.description,
      avatarUrl: room.avatar_url,
      tags: room.tags,
      memberCount: Number(room.member_count),
      isPublic: room.is_public,
      createdAt: room.created_at,
      lastActivityAt: room.last_activity_at,
      highlight: {
        name: room.name_highlight ?? undefined,
        description: room.description_highlight ?? undefined,
      },
      creator: room.creator_id
        ? {
            id: room.creator_id,
            username: room.creator_username ?? 'unknown',
            displayName: room.creator_display_name,
            avatarUrl: room.creator_avatar_url,
          }
        : null,
    }));

    // Generate cursor for pagination
    const lastRoom = rooms[rooms.length - 1];
    const nextCursor = hasMore && lastRoom ? `${lastRoom.similarity}_${lastRoom.id}` : null;

    // Get total count (for UI purposes)
    const totalResult = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count
      FROM chat_rooms r
      WHERE r.is_active = true
        AND r.is_public = true
        AND (
          similarity(r.name, ${dto.q}) > ${SIMILARITY_THRESHOLD}
          OR similarity(COALESCE(r.description, ''), ${dto.q}) > ${SIMILARITY_THRESHOLD}
          OR r.name ILIKE '%' || ${dto.q} || '%'
          OR r.description ILIKE '%' || ${dto.q} || '%'
          OR ${dto.q} = ANY(r.tags)
        )
        ${tagsFilter}
    `;

    const response: SearchResponse<RoomSearchResult> = {
      results: transformedRooms,
      cursor: nextCursor,
      total: Number(totalResult[0]?.count ?? 0),
    };

    // Cache results
    await this.redis.setJson(cacheKey, response, SEARCH_CACHE_TTL);

    this.logger.debug(`Room search completed: ${transformedRooms.length} results`);
    return response;
  }

  /**
   * Search messages within a specific room
   * Requires user to be a member of the room
   */
  async searchMessages(
    dto: SearchMessagesDto,
    userId: string
  ): Promise<SearchResponse<MessageSearchResult>> {
    // Verify user is a member of the room
    const membership = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId: dto.roomId, userId } },
    });

    if (!membership) {
      throw new ForbiddenException('You must be a member of this room to search messages');
    }

    const cacheKey = `search:messages:${dto.roomId}:${this.hashQuery(dto)}`;

    // Check cache first
    const cached = await this.redis.getJson<SearchResponse<MessageSearchResult>>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for message search in room ${dto.roomId}`);
      return cached;
    }

    this.logger.log(`Searching messages in room: query length=${dto.q.length}`);

    type MessageQueryResult = {
      id: string;
      content: string;
      content_type: string;
      created_at: Date;
      is_edited: boolean;
      sender_id: string;
      sender_username: string;
      sender_display_name: string | null;
      sender_avatar_url: string | null;
      content_highlight: string;
      similarity: number;
    };

    // Build cursor condition
    let cursorCondition = Prisma.empty;
    if (dto.cursor) {
      const [cursorSimilarity, cursorId] = dto.cursor.split('_');
      if (cursorSimilarity && cursorId) {
        cursorCondition = Prisma.sql`
          AND (similarity < ${parseFloat(cursorSimilarity)}
               OR (similarity = ${parseFloat(cursorSimilarity)} AND m.id > ${cursorId}::uuid))
        `;
      }
    }

    const results = await this.prisma.$queryRaw<MessageQueryResult[]>`
      WITH search_results AS (
        SELECT
          m.id,
          m.content,
          m.content_type,
          m.created_at,
          m.is_edited,
          m.sender_id,
          similarity(m.content, ${dto.q}) AS similarity
        FROM messages m
        WHERE m.room_id = ${dto.roomId}::uuid
          AND m.is_deleted = false
          AND m.content_type = 'TEXT'
          AND (
            similarity(m.content, ${dto.q}) > ${SIMILARITY_THRESHOLD}
            OR m.content ILIKE '%' || ${dto.q} || '%'
          )
          ${cursorCondition}
      )
      SELECT
        sr.id,
        sr.content,
        sr.content_type,
        sr.created_at,
        sr.is_edited,
        sr.sender_id,
        sr.similarity,
        u.username AS sender_username,
        u.display_name AS sender_display_name,
        u.avatar_url AS sender_avatar_url,
        ts_headline('english', sr.content, plainto_tsquery('english', ${dto.q}),
          'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=10') AS content_highlight
      FROM search_results sr
      JOIN users u ON sr.sender_id = u.id
      ORDER BY sr.similarity DESC, sr.created_at DESC, sr.id ASC
      LIMIT ${dto.limit + 1}
    `;

    const hasMore = results.length > dto.limit;
    const messages = hasMore ? results.slice(0, dto.limit) : results;

    const transformedMessages: MessageSearchResult[] = messages.map((msg) => ({
      id: msg.id,
      content: msg.content,
      contentType: msg.content_type,
      createdAt: msg.created_at,
      isEdited: msg.is_edited,
      highlight: {
        content: msg.content_highlight,
      },
      sender: {
        id: msg.sender_id,
        username: msg.sender_username,
        displayName: msg.sender_display_name,
        avatarUrl: msg.sender_avatar_url,
      },
    }));

    const lastMsg = messages[messages.length - 1];
    const nextCursor = hasMore && lastMsg ? `${lastMsg.similarity}_${lastMsg.id}` : null;

    // Get total count
    const totalResult = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count
      FROM messages m
      WHERE m.room_id = ${dto.roomId}::uuid
        AND m.is_deleted = false
        AND m.content_type = 'TEXT'
        AND (
          similarity(m.content, ${dto.q}) > ${SIMILARITY_THRESHOLD}
          OR m.content ILIKE '%' || ${dto.q} || '%'
        )
    `;

    const response: SearchResponse<MessageSearchResult> = {
      results: transformedMessages,
      cursor: nextCursor,
      total: Number(totalResult[0]?.count ?? 0),
    };

    // Cache results (shorter TTL for messages as they change frequently)
    await this.redis.setJson(cacheKey, response, SEARCH_CACHE_TTL / 2);

    this.logger.debug(`Message search completed: ${transformedMessages.length} results`);
    return response;
  }

  /**
   * Search users by username or display name
   * Only returns active, discoverable users
   */
  async searchUsers(dto: SearchUsersDto): Promise<SearchResponse<UserSearchResult>> {
    const cacheKey = `search:users:${this.hashQuery(dto)}`;

    // Check cache first
    const cached = await this.redis.getJson<SearchResponse<UserSearchResult>>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for user search: ${dto.q}`);
      return cached;
    }

    this.logger.log(`Searching users: query length=${dto.q.length}`);

    type UserQueryResult = {
      id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
      bio: string | null;
      is_verified: boolean;
      username_highlight: string | null;
      display_name_highlight: string | null;
      similarity: number;
    };

    // Build cursor condition
    let cursorCondition = Prisma.empty;
    if (dto.cursor) {
      const [cursorSimilarity, cursorId] = dto.cursor.split('_');
      if (cursorSimilarity && cursorId) {
        cursorCondition = Prisma.sql`
          AND (similarity < ${parseFloat(cursorSimilarity)}
               OR (similarity = ${parseFloat(cursorSimilarity)} AND u.id > ${cursorId}::uuid))
        `;
      }
    }

    const results = await this.prisma.$queryRaw<UserQueryResult[]>`
      WITH search_results AS (
        SELECT
          u.id,
          u.username,
          u.display_name,
          u.avatar_url,
          u.bio,
          u.is_verified,
          GREATEST(
            similarity(u.username, ${dto.q}),
            similarity(COALESCE(u.display_name, ''), ${dto.q})
          ) AS similarity
        FROM users u
        WHERE u.is_active = true
          AND u.shadow_banned = false
          AND u.is_guest = false
          AND (u.settings->>'discoverable')::boolean IS NOT FALSE
          AND (
            similarity(u.username, ${dto.q}) > ${SIMILARITY_THRESHOLD}
            OR similarity(COALESCE(u.display_name, ''), ${dto.q}) > ${SIMILARITY_THRESHOLD}
            OR u.username ILIKE '%' || ${dto.q} || '%'
            OR u.display_name ILIKE '%' || ${dto.q} || '%'
          )
          ${cursorCondition}
      )
      SELECT
        sr.id,
        sr.username,
        sr.display_name,
        sr.avatar_url,
        sr.bio,
        sr.is_verified,
        sr.similarity,
        ts_headline('english', sr.username, plainto_tsquery('english', ${dto.q}),
          'StartSel=<mark>, StopSel=</mark>') AS username_highlight,
        ts_headline('english', COALESCE(sr.display_name, ''), plainto_tsquery('english', ${dto.q}),
          'StartSel=<mark>, StopSel=</mark>') AS display_name_highlight
      FROM search_results sr
      ORDER BY sr.similarity DESC, sr.id ASC
      LIMIT ${dto.limit + 1}
    `;

    const hasMore = results.length > dto.limit;
    const users = hasMore ? results.slice(0, dto.limit) : results;

    const transformedUsers: UserSearchResult[] = users.map((user) => ({
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      bio: user.bio,
      isVerified: user.is_verified,
      highlight: {
        username: user.username_highlight ?? undefined,
        displayName: user.display_name_highlight ?? undefined,
      },
    }));

    const lastUser = users[users.length - 1];
    const nextCursor = hasMore && lastUser ? `${lastUser.similarity}_${lastUser.id}` : null;

    // Get total count
    const totalResult = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count
      FROM users u
      WHERE u.is_active = true
        AND u.shadow_banned = false
        AND u.is_guest = false
        AND (u.settings->>'discoverable')::boolean IS NOT FALSE
        AND (
          similarity(u.username, ${dto.q}) > ${SIMILARITY_THRESHOLD}
          OR similarity(COALESCE(u.display_name, ''), ${dto.q}) > ${SIMILARITY_THRESHOLD}
          OR u.username ILIKE '%' || ${dto.q} || '%'
          OR u.display_name ILIKE '%' || ${dto.q} || '%'
        )
    `;

    const response: SearchResponse<UserSearchResult> = {
      results: transformedUsers,
      cursor: nextCursor,
      total: Number(totalResult[0]?.count ?? 0),
    };

    // Cache results
    await this.redis.setJson(cacheKey, response, SEARCH_CACHE_TTL);

    this.logger.debug(`User search completed: ${transformedUsers.length} results`);
    return response;
  }

  /**
   * Generate a hash key for caching search queries
   */
  private hashQuery(dto: object): string {
    const normalized = JSON.stringify(dto, Object.keys(dto).sort());
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}
