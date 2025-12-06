import type { InfiniteData } from '@tanstack/react-query';
import { z } from 'zod';
import type { Message, CursorPaginatedResponse, RoomMember } from '@socio/types';
import { websocket } from '../services/websocket';
import { chatQueryKeys } from '../hooks/useChatHistory';
import { roomQueryKeys } from '../hooks/useRoomDetails';
import { getQueryClient } from './QueryProvider';

/**
 * Zod schemas for WebSocket event validation
 */
const MessageDeletedEventSchema = z.object({
  roomId: z.string(),
  messageId: z.string(),
});

const MessageEditedEventSchema = z.object({
  roomId: z.string(),
  messageId: z.string(),
  content: z.string(),
  updatedAt: z.coerce.date(),
});

const RoomMemberSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  userId: z.string(),
  role: z.enum(['owner', 'admin', 'moderator', 'member']),
  activityWeight: z.number(),
  isMuted: z.boolean(),
  notificationsEnabled: z.boolean(),
  joinedAt: z.coerce.date(),
  lastReadAt: z.coerce.date(),
});

const MemberJoinedEventSchema = z.object({
  roomId: z.string(),
  member: RoomMemberSchema,
});

const MemberLeftEventSchema = z.object({
  roomId: z.string(),
  userId: z.string(),
});

/**
 * Derived types from Zod schemas
 */
type MessageDeletedEvent = z.infer<typeof MessageDeletedEventSchema>;
type MessageEditedEvent = z.infer<typeof MessageEditedEventSchema>;
type MemberJoinedEvent = z.infer<typeof MemberJoinedEventSchema>;
type MemberLeftEvent = z.infer<typeof MemberLeftEventSchema>;

/**
 * Initialize WebSocket handlers for TanStack Query cache invalidation
 * Call this once when the app starts after authentication
 *
 * @returns Cleanup function to unsubscribe all handlers
 */
export const initializeQueryCacheHandlers = (): (() => void) => {
  const queryClient = getQueryClient();

  /**
   * Handle new messages - add to cache instead of invalidating
   * This provides a smoother UX than refetching
   */
  const unsubMessage = websocket.onMessage((message: Message) => {
    queryClient.setQueryData<InfiniteData<CursorPaginatedResponse<Message>>>(
      chatQueryKeys.room(message.roomId),
      (oldData) => {
        if (!oldData?.pages?.[0]) {
          // No existing data, create initial structure
          return {
            pages: [{
              items: [message],
              hasMore: false,
              cursor: undefined,
            }],
            pageParams: [undefined],
          };
        }

        // Check if message already exists (avoid duplicates from optimistic updates)
        const messageExists = oldData.pages.some((page) =>
          page.items.some((m) => m.id === message.id)
        );
        if (messageExists) return oldData;

        // Add to first page (newest messages)
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
  });

  /**
   * Get raw socket for additional events not covered by websocket service
   */
  const socket = websocket.getSocket();

  /**
   * Handle message deleted events with validation
   */
  const handleMessageDeleted = (rawEvent: unknown) => {
    const result = MessageDeletedEventSchema.safeParse(rawEvent);
    if (!result.success) {
      console.error('Invalid message:deleted event:', result.error.message);
      return;
    }

    const event: MessageDeletedEvent = result.data;
    queryClient.setQueryData<InfiniteData<CursorPaginatedResponse<Message>>>(
      chatQueryKeys.room(event.roomId),
      (oldData) => {
        if (!oldData?.pages) return oldData;

        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            items: page.items.map((msg) =>
              msg.id === event.messageId
                ? { ...msg, isDeleted: true, content: '' }
                : msg
            ),
          })),
        };
      }
    );
  };

  /**
   * Handle message edited events with validation
   */
  const handleMessageEdited = (rawEvent: unknown) => {
    const result = MessageEditedEventSchema.safeParse(rawEvent);
    if (!result.success) {
      console.error('Invalid message:edited event:', result.error.message);
      return;
    }

    const event: MessageEditedEvent = result.data;
    queryClient.setQueryData<InfiniteData<CursorPaginatedResponse<Message>>>(
      chatQueryKeys.room(event.roomId),
      (oldData) => {
        if (!oldData?.pages) return oldData;

        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            items: page.items.map((msg) =>
              msg.id === event.messageId
                ? { ...msg, content: event.content, isEdited: true, updatedAt: event.updatedAt }
                : msg
            ),
          })),
        };
      }
    );
  };

  /**
   * Handle member joined events with validation
   */
  const handleMemberJoined = (rawEvent: unknown) => {
    const result = MemberJoinedEventSchema.safeParse(rawEvent);
    if (!result.success) {
      console.error('Invalid member:joined event:', result.error.message);
      return;
    }

    const event: MemberJoinedEvent = result.data;
    queryClient.setQueryData<RoomMember[]>(
      roomQueryKeys.members(event.roomId),
      (oldData) => {
        if (!oldData) return [event.member as RoomMember];
        // Avoid duplicates
        const exists = oldData.some((m) => m.userId === event.member.userId);
        if (exists) return oldData;
        return [...oldData, event.member as RoomMember];
      }
    );
  };

  /**
   * Handle member left events with validation
   */
  const handleMemberLeft = (rawEvent: unknown) => {
    const result = MemberLeftEventSchema.safeParse(rawEvent);
    if (!result.success) {
      console.error('Invalid member:left event:', result.error.message);
      return;
    }

    const event: MemberLeftEvent = result.data;
    queryClient.setQueryData<RoomMember[]>(
      roomQueryKeys.members(event.roomId),
      (oldData) => {
        if (!oldData) return oldData;
        return oldData.filter((m) => m.userId !== event.userId);
      }
    );
  };

  // Subscribe to additional socket events if socket is available
  if (!socket) {
    console.warn('WebSocket not connected - cache invalidation handlers for message:deleted, message:edited, member:joined, member:left not registered');
    // Return cleanup that only handles the message subscription
    return () => {
      unsubMessage();
    };
  }

  socket.on('message:deleted', handleMessageDeleted);
  socket.on('message:edited', handleMessageEdited);
  socket.on('member:joined', handleMemberJoined);
  socket.on('member:left', handleMemberLeft);

  // Return cleanup function
  return () => {
    unsubMessage();
    socket.off('message:deleted', handleMessageDeleted);
    socket.off('message:edited', handleMessageEdited);
    socket.off('member:joined', handleMemberJoined);
    socket.off('member:left', handleMemberLeft);
  };
};

/**
 * Invalidate all chat-related queries
 * Useful when connection is restored after a disconnect
 */
export const invalidateAllChatQueries = async (): Promise<void> => {
  const queryClient = getQueryClient();
  await queryClient.invalidateQueries({ queryKey: chatQueryKeys.all });
};

/**
 * Invalidate all room-related queries
 */
export const invalidateAllRoomQueries = async (): Promise<void> => {
  const queryClient = getQueryClient();
  await queryClient.invalidateQueries({ queryKey: roomQueryKeys.all });
};

/**
 * Invalidate queries for a specific room
 */
export const invalidateRoomQueries = async (roomId: string): Promise<void> => {
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: chatQueryKeys.room(roomId) }),
    queryClient.invalidateQueries({ queryKey: roomQueryKeys.details(roomId) }),
    queryClient.invalidateQueries({ queryKey: roomQueryKeys.members(roomId) }),
  ]);
};
