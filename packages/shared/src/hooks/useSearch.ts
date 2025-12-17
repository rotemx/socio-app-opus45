import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../services/api';

/**
 * Search result interfaces matching backend DTOs
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

export interface SearchResponse<T> {
  results: T[];
  cursor: string | null;
  total: number;
}

interface SearchParams {
  q: string;
  limit?: number;
}

interface RoomSearchParams extends SearchParams {
  tags?: string[];
}

interface MessageSearchParams extends SearchParams {
  roomId: string;
}

/**
 * Hook for searching rooms with infinite scroll pagination
 */
export function useSearchRooms(params: RoomSearchParams) {
  return useInfiniteQuery<SearchResponse<RoomSearchResult>>({
    queryKey: ['search', 'rooms', params.q, params.tags, params.limit],
    queryFn: async ({ pageParam }) => {
      return api.get<SearchResponse<RoomSearchResult>>('/search/rooms', {
        params: {
          q: params.q,
          limit: params.limit ?? 20,
          cursor: pageParam as string | undefined,
          tags: params.tags?.join(','),
        },
      });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.cursor,
    enabled: params.q.length >= 3,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook for searching messages within a room with infinite scroll pagination
 */
export function useSearchMessages(params: MessageSearchParams) {
  return useInfiniteQuery<SearchResponse<MessageSearchResult>>({
    queryKey: ['search', 'messages', params.roomId, params.q, params.limit],
    queryFn: async ({ pageParam }) => {
      return api.get<SearchResponse<MessageSearchResult>>('/search/messages', {
        params: {
          q: params.q,
          roomId: params.roomId,
          limit: params.limit ?? 20,
          cursor: pageParam as string | undefined,
        },
      });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.cursor,
    enabled: params.q.length >= 3 && !!params.roomId,
    staleTime: 2.5 * 60 * 1000, // 2.5 minutes
  });
}

/**
 * Hook for searching users with infinite scroll pagination
 */
export function useSearchUsers(params: SearchParams) {
  return useInfiniteQuery<SearchResponse<UserSearchResult>>({
    queryKey: ['search', 'users', params.q, params.limit],
    queryFn: async ({ pageParam }) => {
      return api.get<SearchResponse<UserSearchResult>>('/search/users', {
        params: {
          q: params.q,
          limit: params.limit ?? 20,
          cursor: pageParam as string | undefined,
        },
      });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.cursor,
    enabled: params.q.length >= 3,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
