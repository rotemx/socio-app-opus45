import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { z } from 'zod';
import { api } from '../services/api';
import type { ChatRoom } from '@socio/types';

/**
 * Query key factory for room details
 */
export const roomQueryKeys = {
  all: ['rooms'] as const,
  details: (roomId: string) => ['rooms', roomId, 'details'] as const,
  members: (roomId: string) => ['rooms', roomId, 'members'] as const,
};

/**
 * Stale time for room details (1 minute)
 */
const ROOM_DETAILS_STALE_TIME = 60 * 1000;

/**
 * Zod schema for ChatRoom validation
 */
const ChatRoomSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  avatarUrl: z.string().optional(),
  creatorId: z.string(),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
  radiusMeters: z.number(),
  isPublic: z.boolean(),
  isActive: z.boolean(),
  maxMembers: z.number(),
  tags: z.array(z.string()),
  settings: z.object({
    allowMedia: z.boolean(),
    requireLocationCheck: z.boolean(),
    voiceEnabled: z.boolean(),
    videoEnabled: z.boolean(),
  }),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  lastActivityAt: z.coerce.date(),
});

/**
 * Hook for fetching room details
 *
 * @param roomId - The room ID to fetch details for
 * @returns Query result with room details
 */
export function useRoomDetails(roomId: string) {
  const queryClient = useQueryClient();

  const query = useQuery<ChatRoom, Error>({
    queryKey: roomQueryKeys.details(roomId),
    queryFn: async () => {
      const response = await api.get<ChatRoom>(`/rooms/${roomId}`);
      const validated = ChatRoomSchema.safeParse(response);
      if (!validated.success) {
        throw new Error(`Invalid room data: ${validated.error.message}`);
      }
      return validated.data as ChatRoom;
    },
    enabled: !!roomId,
    staleTime: ROOM_DETAILS_STALE_TIME,
    refetchOnWindowFocus: false,
  });

  /**
   * Update room details in the cache
   */
  const updateRoomInCache = useCallback(
    (updates: Partial<ChatRoom>) => {
      queryClient.setQueryData<ChatRoom>(
        roomQueryKeys.details(roomId),
        (oldData) => {
          if (!oldData) return oldData;
          return { ...oldData, ...updates };
        }
      );
    },
    [queryClient, roomId]
  );

  /**
   * Invalidate the room details cache to trigger a refetch
   */
  const invalidate = useCallback(() => {
    return queryClient.invalidateQueries({ queryKey: roomQueryKeys.details(roomId) });
  }, [queryClient, roomId]);

  /**
   * Prefetch room details
   */
  const prefetch = useCallback(
    (targetRoomId: string) => {
      return queryClient.prefetchQuery({
        queryKey: roomQueryKeys.details(targetRoomId),
        queryFn: async () => {
          const response = await api.get<ChatRoom>(`/rooms/${targetRoomId}`);
          const validated = ChatRoomSchema.safeParse(response);
          if (!validated.success) {
            throw new Error(`Invalid room data: ${validated.error.message}`);
          }
          return validated.data as ChatRoom;
        },
        staleTime: ROOM_DETAILS_STALE_TIME,
      });
    },
    [queryClient]
  );

  return {
    ...query,
    room: query.data,
    updateRoomInCache,
    invalidate,
    prefetch,
  };
}
