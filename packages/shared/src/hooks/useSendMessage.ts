import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { z } from 'zod';
import { api } from '../services/api';
import type { Message, CursorPaginatedResponse, MessageContentType } from '@socio/types';
import { chatQueryKeys } from './useChatHistory';

/**
 * Zod schema for send message input validation
 */
const sendMessageInputSchema = z.object({
  roomId: z.string().min(1, 'Room ID is required'),
  content: z.string().min(1, 'Message content cannot be empty').max(10000, 'Message content too long'),
  contentType: z.enum(['text', 'image', 'video', 'audio', 'file', 'location']).default('text'),
  replyToId: z.string().optional(),
});

/**
 * Input type for sending a message
 */
export type SendMessageInput = z.infer<typeof sendMessageInputSchema>;

/**
 * Generate a temporary ID for optimistic messages
 */
const generateTempId = (): string => `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

/**
 * Create an optimistic message for immediate display
 */
const createOptimisticMessage = (
  input: SendMessageInput,
  tempId: string,
  senderId: string
): Message => ({
  id: tempId,
  roomId: input.roomId,
  senderId,
  content: input.content,
  contentType: input.contentType as MessageContentType,
  replyToId: input.replyToId,
  isEdited: false,
  isDeleted: false,
  createdAt: new Date(),
  updatedAt: new Date(),
});

/**
 * Hook for sending messages with optimistic updates
 *
 * @param currentUserId - The current user's ID for optimistic message creation
 * @returns Mutation hook for sending messages
 */
export function useSendMessage(currentUserId: string) {
  const queryClient = useQueryClient();

  return useMutation<Message, Error, SendMessageInput, { previousData: InfiniteData<CursorPaginatedResponse<Message>> | undefined; tempId: string }>({
    mutationFn: async (input: SendMessageInput) => {
      // Validate input
      const validationResult = sendMessageInputSchema.safeParse(input);
      if (!validationResult.success) {
        throw new Error(validationResult.error.errors[0]?.message ?? 'Invalid input');
      }

      const response = await api.post<Message>(`/rooms/${input.roomId}/messages`, {
        content: validationResult.data.content,
        contentType: validationResult.data.contentType,
        replyToId: validationResult.data.replyToId,
      });
      return response;
    },

    onMutate: async (input) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: chatQueryKeys.room(input.roomId) });

      // Snapshot previous data for rollback
      const previousData = queryClient.getQueryData<InfiniteData<CursorPaginatedResponse<Message>>>(
        chatQueryKeys.room(input.roomId)
      );

      const tempId = generateTempId();
      const optimisticMessage = createOptimisticMessage(input, tempId, currentUserId);

      // Optimistically update the cache
      queryClient.setQueryData<InfiniteData<CursorPaginatedResponse<Message>>>(
        chatQueryKeys.room(input.roomId),
        (oldData) => {
          if (!oldData?.pages?.[0]) {
            // Create initial structure if no data exists
            return {
              pages: [{
                items: [optimisticMessage],
                hasMore: false,
                cursor: undefined,
              }],
              pageParams: [undefined],
            };
          }

          // Add message to the first page (newest messages)
          const newFirstPage = {
            ...oldData.pages[0],
            items: [optimisticMessage, ...oldData.pages[0].items],
          };

          return {
            ...oldData,
            pages: [newFirstPage, ...oldData.pages.slice(1)],
          };
        }
      );

      return { previousData, tempId };
    },

    onError: (_error, input, context) => {
      // Rollback to previous data on error
      if (context?.previousData) {
        queryClient.setQueryData(
          chatQueryKeys.room(input.roomId),
          context.previousData
        );
      }
    },

    onSuccess: (newMessage, input, context) => {
      // Replace optimistic message with the real one from the server
      queryClient.setQueryData<InfiniteData<CursorPaginatedResponse<Message>>>(
        chatQueryKeys.room(input.roomId),
        (oldData) => {
          if (!oldData?.pages) return oldData;

          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              items: page.items.map((msg) =>
                msg.id === context?.tempId ? newMessage : msg
              ),
            })),
          };
        }
      );
    },
  });
}

/**
 * Context type for edit/delete mutations
 */
type EditDeleteContext = {
  previousData: InfiniteData<CursorPaginatedResponse<Message>> | undefined;
  roomId: string;
};

/**
 * Hook for editing a message
 */
export function useEditMessage() {
  const queryClient = useQueryClient();

  return useMutation<Message, Error, { roomId: string; messageId: string; content: string }, EditDeleteContext>({
    mutationFn: async ({ roomId, messageId, content }) => {
      const response = await api.put<Message>(`/rooms/${roomId}/messages/${messageId}`, {
        content,
      });
      return response;
    },

    onMutate: async ({ roomId, messageId, content }) => {
      await queryClient.cancelQueries({ queryKey: chatQueryKeys.room(roomId) });

      const previousData = queryClient.getQueryData<InfiniteData<CursorPaginatedResponse<Message>>>(
        chatQueryKeys.room(roomId)
      );

      // Optimistically update the message
      queryClient.setQueryData<InfiniteData<CursorPaginatedResponse<Message>>>(
        chatQueryKeys.room(roomId),
        (oldData) => {
          if (!oldData?.pages) return oldData;

          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              items: page.items.map((msg) =>
                msg.id === messageId
                  ? { ...msg, content, isEdited: true, updatedAt: new Date() }
                  : msg
              ),
            })),
          };
        }
      );

      return { previousData, roomId };
    },

    onError: (_error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(chatQueryKeys.room(context.roomId), context.previousData);
      }
    },
  });
}

/**
 * Hook for deleting a message
 */
export function useDeleteMessage() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { roomId: string; messageId: string }, EditDeleteContext>({
    mutationFn: async ({ roomId, messageId }) => {
      await api.delete(`/rooms/${roomId}/messages/${messageId}`);
    },

    onMutate: async ({ roomId, messageId }) => {
      await queryClient.cancelQueries({ queryKey: chatQueryKeys.room(roomId) });

      const previousData = queryClient.getQueryData<InfiniteData<CursorPaginatedResponse<Message>>>(
        chatQueryKeys.room(roomId)
      );

      // Optimistically mark message as deleted
      queryClient.setQueryData<InfiniteData<CursorPaginatedResponse<Message>>>(
        chatQueryKeys.room(roomId),
        (oldData) => {
          if (!oldData?.pages) return oldData;

          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              items: page.items.map((msg) =>
                msg.id === messageId
                  ? { ...msg, isDeleted: true, content: '' }
                  : msg
              ),
            })),
          };
        }
      );

      return { previousData, roomId };
    },

    onError: (_error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(chatQueryKeys.room(context.roomId), context.previousData);
      }
    },
  });
}
