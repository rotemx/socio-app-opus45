import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { z } from 'zod';
import { api } from '../services/api';
import type { RoomMember, PaginatedResponse } from '@socio/types';
import { roomQueryKeys } from './useRoomDetails';

/**
 * Stale time for room members (30 seconds)
 */
const ROOM_MEMBERS_STALE_TIME = 30 * 1000;

/**
 * Zod schema for RoomMember validation
 */
const RoomMemberSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  userId: z.string(),
  user: z.object({
    id: z.string(),
    username: z.string(),
    displayName: z.string().optional(),
    avatarUrl: z.string().optional(),
  }).optional(),
  joinLocation: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }).optional(),
  role: z.enum(['owner', 'admin', 'moderator', 'member']),
  activityWeight: z.number(),
  isMuted: z.boolean(),
  notificationsEnabled: z.boolean(),
  joinedAt: z.coerce.date(),
  lastReadAt: z.coerce.date(),
});

/**
 * Zod schema for paginated response
 */
const PaginatedRoomMembersSchema = z.object({
  items: z.array(RoomMemberSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  hasMore: z.boolean(),
});

/**
 * Hook for fetching room members via TanStack Query
 * Note: This is different from useRoomMembers in chatStore which is a Zustand selector
 *
 * @param roomId - The room ID to fetch members for
 * @returns Query result with room members
 *
 * @remarks
 * Currently fetches up to 100 members in a single request. For rooms with more members,
 * consider implementing infinite scroll or pagination if needed.
 */
export function useRoomMembersQuery(roomId: string) {
  const queryClient = useQueryClient();

  const query = useQuery<RoomMember[], Error>({
    queryKey: roomQueryKeys.members(roomId),
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<RoomMember>>(
        `/rooms/${roomId}/members`,
        {
          params: {
            pageSize: 100, // Get members for typical rooms (most rooms have < 100 members)
          },
        }
      );
      const validated = PaginatedRoomMembersSchema.safeParse(response);
      if (!validated.success) {
        throw new Error(`Invalid room members data: ${validated.error.message}`);
      }
      return validated.data.items as RoomMember[];
    },
    enabled: !!roomId,
    staleTime: ROOM_MEMBERS_STALE_TIME,
    refetchOnWindowFocus: false,
  });

  /**
   * Add a member to the cache
   */
  const addMemberToCache = useCallback(
    (member: RoomMember) => {
      queryClient.setQueryData<RoomMember[]>(
        roomQueryKeys.members(roomId),
        (oldData) => {
          if (!oldData) return [member];
          // Avoid duplicates
          const exists = oldData.some((m) => m.userId === member.userId);
          if (exists) return oldData;
          return [...oldData, member];
        }
      );
    },
    [queryClient, roomId]
  );

  /**
   * Remove a member from the cache
   */
  const removeMemberFromCache = useCallback(
    (userId: string) => {
      queryClient.setQueryData<RoomMember[]>(
        roomQueryKeys.members(roomId),
        (oldData) => {
          if (!oldData) return oldData;
          return oldData.filter((m) => m.userId !== userId);
        }
      );
    },
    [queryClient, roomId]
  );

  /**
   * Update a member in the cache
   */
  const updateMemberInCache = useCallback(
    (userId: string, updates: Partial<RoomMember>) => {
      queryClient.setQueryData<RoomMember[]>(
        roomQueryKeys.members(roomId),
        (oldData) => {
          if (!oldData) return oldData;
          return oldData.map((m) =>
            m.userId === userId ? { ...m, ...updates } : m
          );
        }
      );
    },
    [queryClient, roomId]
  );

  /**
   * Invalidate the room members cache to trigger a refetch
   */
  const invalidate = useCallback(() => {
    return queryClient.invalidateQueries({ queryKey: roomQueryKeys.members(roomId) });
  }, [queryClient, roomId]);

  return {
    ...query,
    members: query.data ?? [],
    addMemberToCache,
    removeMemberFromCache,
    updateMemberInCache,
    invalidate,
  };
}
