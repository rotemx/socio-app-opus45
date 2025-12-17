import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Base search query schema with pagination
 * Requires minimum 3 characters for search
 */
const baseSearchSchema = z.object({
  q: z.string().min(3, 'Search query must be at least 3 characters').max(100),
  limit: z.coerce.number().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

/**
 * Room search query
 * Search rooms by name, description, or tags
 */
const searchRoomsSchema = baseSearchSchema.extend({
  tags: z
    .string()
    .transform((val) =>
      val
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t)
    )
    .pipe(z.array(z.string()).max(10))
    .optional(),
});

/**
 * Message search query
 * Search messages within a specific room
 */
const searchMessagesSchema = baseSearchSchema.extend({
  roomId: z.string().uuid('Invalid room ID'),
});

/**
 * User search query
 * Search users by username or display name
 */
const searchUsersSchema = baseSearchSchema;

// DTO Classes
export class SearchRoomsDto extends createZodDto(searchRoomsSchema) {}
export class SearchMessagesDto extends createZodDto(searchMessagesSchema) {}
export class SearchUsersDto extends createZodDto(searchUsersSchema) {}

/**
 * Highlighted text segment
 */
export interface HighlightSegment {
  text: string;
  isMatch: boolean;
}

/**
 * Room search result with highlighting
 */
export interface RoomSearchResult {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  tags: string[];
  memberCount: number;
  isPublic: boolean;
  createdAt: Date;
  lastActivityAt: Date;
  highlight: {
    name?: string;
    description?: string;
  };
  creator: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
}

/**
 * Message search result with highlighting
 */
export interface MessageSearchResult {
  id: string;
  content: string;
  contentType: string;
  createdAt: Date;
  isEdited: boolean;
  highlight: {
    content: string;
  };
  sender: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

/**
 * User search result with highlighting
 */
export interface UserSearchResult {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  isVerified: boolean;
  highlight: {
    username?: string;
    displayName?: string;
  };
}

/**
 * Paginated search response
 */
export interface SearchResponse<T> {
  results: T[];
  cursor: string | null;
  total: number;
}
