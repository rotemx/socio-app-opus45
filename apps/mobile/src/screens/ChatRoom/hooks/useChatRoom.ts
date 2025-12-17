import { useEffect, useCallback, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useChatHistory, useChat, websocket, useAuthStore, type TypingUser } from '@socio/shared';
import type { Message, CursorPaginatedResponse } from '@socio/types';
import { useOptimisticMessages, type OptimisticMessage } from './useOptimisticMessages';

/** Timeout for optimistic messages before auto-removal (30 seconds) */
const OPTIMISTIC_MESSAGE_TIMEOUT_MS = 30000;

/** Maximum allowed message content length */
const MAX_MESSAGE_LENGTH = 10000;

export interface UseChatRoomResult {
  /** All messages for the room (flattened from paginated results) */
  messages: Message[];
  /** Optimistic messages pending confirmation */
  optimisticMessages: Message[];
  /** Whether initial data is loading */
  isLoading: boolean;
  /** Whether we're fetching the next page */
  isFetchingNextPage: boolean;
  /** Whether there are more messages to load */
  hasNextPage: boolean;
  /** Load older messages */
  loadMore: () => void;
  /** Send a new message */
  sendMessage: (content: string) => void;
  /** Current user ID */
  currentUserId: string;
  /** Room typing indicators */
  typingUsers: TypingUser[];
  /** Send typing indicator */
  sendTyping: (isTyping: boolean) => void;
}

/**
 * Comprehensive hook for chat room functionality.
 * Combines message history, real-time updates, and optimistic UI.
 */
export function useChatRoom(roomId: string): UseChatRoomResult {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const currentUserId = user?.id ?? '';

  // Paginated message history
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage = false,
    fetchNextPage,
  } = useChatHistory(roomId);

  // Local chat state
  const { typingUsers, handleTyping } = useChat(roomId);

  // Optimistic updates
  const {
    optimisticMessages,
    addOptimisticMessage,
    removeOptimisticMessage,
    confirmOptimisticMessage,
  } = useOptimisticMessages();

  // Use refs to avoid re-running effect when these change
  const optimisticMessagesRef = useRef<OptimisticMessage[]>(optimisticMessages);
  const confirmOptimisticMessageRef = useRef(confirmOptimisticMessage);
  const removeOptimisticMessageRef = useRef(removeOptimisticMessage);
  const optimisticTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Keep refs updated
  useEffect(() => {
    optimisticMessagesRef.current = optimisticMessages;
    confirmOptimisticMessageRef.current = confirmOptimisticMessage;
    removeOptimisticMessageRef.current = removeOptimisticMessage;
  }, [optimisticMessages, confirmOptimisticMessage, removeOptimisticMessage]);

  // Cleanup optimistic message timeouts on unmount
  useEffect(() => {
    const timeouts = optimisticTimeoutsRef.current;
    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout));
      timeouts.clear();
    };
  }, []);

  // Flatten paginated messages (newest first for inverted list)
  const messages = useMemo(() => {
    if (!data?.pages) {
      return [];
    }
    return data.pages.flatMap((page) => page.items);
  }, [data?.pages]);

  // Join room and set up WebSocket listeners
  useEffect(() => {
    if (!roomId) {
      return;
    }

    // Join the room with error handling
    try {
      websocket.joinRoom(roomId);
    } catch (error) {
      console.error('[useChatRoom] Failed to join room:', error);
    }

    // Handle incoming messages
    const unsubMessage = websocket.onMessage((message: Message) => {
      if (message.roomId !== roomId) {
        return;
      }

      // Check if this confirms an optimistic message
      const matchingOptimistic = optimisticMessagesRef.current.find(
        (om) =>
          om.senderId === message.senderId &&
          om.content === message.content &&
          Math.abs(new Date(om.createdAt).getTime() - new Date(message.createdAt).getTime()) < 5000
      );

      if (matchingOptimistic) {
        // Clear the timeout for this optimistic message
        const timeoutId = optimisticTimeoutsRef.current.get(matchingOptimistic.id);
        if (timeoutId) {
          clearTimeout(timeoutId);
          optimisticTimeoutsRef.current.delete(matchingOptimistic.id);
        }
        confirmOptimisticMessageRef.current(matchingOptimistic.id, message);
      }

      // Update query cache with new message
      queryClient.setQueryData<{
        pages: CursorPaginatedResponse<Message>[];
        pageParams: (string | undefined)[];
      }>(['messages', roomId], (oldData) => {
        // If no cache exists, create initial structure
        if (!oldData) {
          return {
            pages: [{ items: [message], hasMore: false }],
            pageParams: [undefined],
          };
        }

        // Add message to the first page (newest messages)
        const newPages = [...oldData.pages];
        if (newPages[0]) {
          // Check if message already exists
          const exists = newPages[0].items.some((m) => m.id === message.id);
          if (!exists) {
            newPages[0] = {
              ...newPages[0],
              items: [message, ...newPages[0].items],
            };
          }
        } else {
          // First page doesn't exist, create it
          newPages.unshift({ items: [message], hasMore: false });
        }

        return {
          ...oldData,
          pages: newPages,
        };
      });
    });

    // Handle typing indicators
    const unsubTyping = websocket.onTyping((indicator) => {
      if (indicator.roomId === roomId) {
        handleTyping(indicator);
      }
    });

    return () => {
      try {
        websocket.leaveRoom(roomId);
      } catch (error) {
        console.error('[useChatRoom] Failed to leave room:', error);
      }
      unsubMessage();
      unsubTyping();
    };
  }, [roomId, queryClient, handleTyping]);

  // Load more messages
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Send message with optimistic update
  const sendMessage = useCallback(
    (content: string) => {
      if (!content.trim() || !currentUserId) {
        return;
      }

      // Validate roomId format (basic sanity check)
      if (!roomId || typeof roomId !== 'string' || roomId.length > 100) {
        console.error('Invalid roomId');
        return;
      }

      // Sanitize content (trim leading/trailing whitespace, limit consecutive newlines)
      const sanitizedContent = content
        .trim()
        .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines to 2
        .replace(/[ \t]+/g, ' '); // Collapse horizontal whitespace only
      if (!sanitizedContent) {
        return;
      }

      // Enforce maximum content length to prevent DoS
      if (sanitizedContent.length > MAX_MESSAGE_LENGTH) {
        console.error('[useChatRoom] Message exceeds maximum length');
        return;
      }

      // Add optimistic message
      const optimistic = addOptimisticMessage(sanitizedContent, currentUserId, roomId);

      // Send via WebSocket with error handling
      try {
        websocket.sendMessage(roomId, sanitizedContent);
      } catch (error) {
        console.error('[useChatRoom] Failed to send message:', error);
        // Remove optimistic message immediately on error
        removeOptimisticMessageRef.current(optimistic.id);
        return;
      }

      // Set timeout to remove if not confirmed (with cleanup)
      const timeoutId = setTimeout(() => {
        removeOptimisticMessageRef.current(optimistic.id);
        optimisticTimeoutsRef.current.delete(optimistic.id);
      }, OPTIMISTIC_MESSAGE_TIMEOUT_MS);

      optimisticTimeoutsRef.current.set(optimistic.id, timeoutId);
    },
    [roomId, currentUserId, addOptimisticMessage]
  );

  // Send typing indicator
  const sendTyping = useCallback(
    (isTyping: boolean) => {
      // Validate roomId before sending
      if (!roomId || typeof roomId !== 'string') {
        return;
      }
      try {
        websocket.sendTyping(roomId, isTyping);
      } catch (error) {
        console.error('[useChatRoom] Failed to send typing indicator:', error);
      }
    },
    [roomId]
  );

  return {
    messages,
    optimisticMessages,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    loadMore,
    sendMessage,
    currentUserId,
    typingUsers,
    sendTyping,
  };
}

export default useChatRoom;
