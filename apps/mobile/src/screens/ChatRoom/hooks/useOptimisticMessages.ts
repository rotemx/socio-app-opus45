import { useState, useCallback } from 'react';
import type { Message, MessageContentType } from '@socio/types';

export interface OptimisticMessage extends Message {
  /** Indicates this is an optimistic (pending) message */
  isOptimistic: true;
}

export interface UseOptimisticMessagesResult {
  optimisticMessages: OptimisticMessage[];
  addOptimisticMessage: (
    content: string,
    senderId: string,
    roomId: string,
    contentType?: MessageContentType
  ) => OptimisticMessage;
  removeOptimisticMessage: (temporaryId: string) => void;
  confirmOptimisticMessage: (temporaryId: string, confirmedMessage: Message) => void;
}

/**
 * Hook for managing optimistic updates in chat messages.
 * Allows showing messages immediately while waiting for server confirmation.
 */
export function useOptimisticMessages(): UseOptimisticMessagesResult {
  const [optimisticMessages, setOptimisticMessages] = useState<OptimisticMessage[]>([]);

  /**
   * Create and add an optimistic message
   * Returns the created message for reference
   */
  const addOptimisticMessage = useCallback(
    (
      content: string,
      senderId: string,
      roomId: string,
      contentType: MessageContentType = 'text'
    ): OptimisticMessage => {
      const temporaryId = `optimistic-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      const now = new Date();

      const optimisticMessage: OptimisticMessage = {
        id: temporaryId,
        roomId,
        senderId,
        content,
        contentType,
        isEdited: false,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
        isOptimistic: true,
      };

      setOptimisticMessages((prev) => [optimisticMessage, ...prev]);
      return optimisticMessage;
    },
    []
  );

  /**
   * Remove an optimistic message (e.g., when send fails)
   */
  const removeOptimisticMessage = useCallback((temporaryId: string) => {
    setOptimisticMessages((prev) => prev.filter((m) => m.id !== temporaryId));
  }, []);

  /**
   * Replace an optimistic message with the confirmed server message
   * This removes the optimistic message since the real one should now be in the list
   */
  const confirmOptimisticMessage = useCallback(
    (temporaryId: string, _confirmedMessage: Message) => {
      // Simply remove the optimistic message - the real message
      // should be added via the normal message flow (WebSocket or query refetch)
      setOptimisticMessages((prev) => prev.filter((m) => m.id !== temporaryId));
    },
    []
  );

  return {
    optimisticMessages,
    addOptimisticMessage,
    removeOptimisticMessage,
    confirmOptimisticMessage,
  };
}

export default useOptimisticMessages;
