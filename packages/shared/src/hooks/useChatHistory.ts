import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useMemo, useCallback } from 'react';
import { api } from '../services/api';
import type { Message, CursorPaginatedResponse } from '@socio/types';

/**
 * Query key factory for chat messages
 */
export const chatQueryKeys = {
  all: ['messages'] as const,
  room: (roomId: string) => ['messages', roomId] as const,
};

/**
 * Default page size for message pagination
 */
const DEFAULT_PAGE_SIZE = 50;

/**
 * Stale time for messages (30 seconds)
 */
const MESSAGES_STALE_TIME = 30 * 1000;

/**
 * Hook for fetching paginated chat history with infinite scroll
 * Uses cursor-based pagination for efficient loading of older messages
 *
 * @param roomId - The room ID to fetch messages for
 * @param options - Optional configuration
 * @returns Infinite query result with messages and pagination controls
 */
export function useChatHistory(roomId: string, options?: { pageSize?: number }) {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const queryClient = useQueryClient();

  const query = useInfiniteQuery<
    CursorPaginatedResponse<Message>,
    Error,
    InfiniteData<CursorPaginatedResponse<Message>>,
    readonly string[],
    string | undefined
  >({
    queryKey: chatQueryKeys.room(roomId),
    queryFn: async ({ pageParam }) => {
      const response = await api.get<CursorPaginatedResponse<Message>>(
        `/rooms/${roomId}/messages`,
        {
          params: {
            cursor: pageParam,
            limit: pageSize,
          },
        }
      );
      return response;
    },
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.cursor : undefined),
    initialPageParam: undefined,
    enabled: !!roomId,
    staleTime: MESSAGES_STALE_TIME,
    refetchOnWindowFocus: false,
  });

  /**
   * Flatten all pages of messages into a single array
   * Messages are in reverse chronological order (newest first)
   */
  const messages = useMemo(() => {
    if (!query.data?.pages) return [];
    return query.data.pages.flatMap((page) => page.items);
  }, [query.data?.pages]);

  /**
   * Add a new message to the cache (for optimistic updates)
   */
  const addMessageToCache = useCallback(
    (message: Message) => {
      queryClient.setQueryData<InfiniteData<CursorPaginatedResponse<Message>>>(
        chatQueryKeys.room(roomId),
        (oldData) => {
          if (!oldData?.pages?.[0]) return oldData;

          // Add message to the first page (newest messages)
          const newFirstPage = {
            ...oldData.pages[0],
            items: [message, ...oldData.pages[0].items],
          };

          return {
            ...oldData,
            pages: [newFirstPage, ...oldData.pages.slice(1)],
          };
        }
      );
    },
    [queryClient, roomId]
  );

  /**
   * Update a message in the cache
   */
  const updateMessageInCache = useCallback(
    (messageId: string, updates: Partial<Message>) => {
      queryClient.setQueryData<InfiniteData<CursorPaginatedResponse<Message>>>(
        chatQueryKeys.room(roomId),
        (oldData) => {
          if (!oldData?.pages) return oldData;

          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              items: page.items.map((msg) =>
                msg.id === messageId ? { ...msg, ...updates } : msg
              ),
            })),
          };
        }
      );
    },
    [queryClient, roomId]
  );

  /**
   * Remove a message from the cache
   */
  const removeMessageFromCache = useCallback(
    (messageId: string) => {
      queryClient.setQueryData<InfiniteData<CursorPaginatedResponse<Message>>>(
        chatQueryKeys.room(roomId),
        (oldData) => {
          if (!oldData?.pages) return oldData;

          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              items: page.items.filter((msg) => msg.id !== messageId),
            })),
          };
        }
      );
    },
    [queryClient, roomId]
  );

  /**
   * Invalidate the messages cache to trigger a refetch
   */
  const invalidate = useCallback(() => {
    return queryClient.invalidateQueries({ queryKey: chatQueryKeys.room(roomId) });
  }, [queryClient, roomId]);

  return {
    ...query,
    messages,
    addMessageToCache,
    updateMessageInCache,
    removeMessageFromCache,
    invalidate,
  };
}
