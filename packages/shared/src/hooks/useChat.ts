import { useCallback, useMemo } from 'react';
import { z } from 'zod';
import {
  useChatStore,
  useRoomMessages,
  useTypingUsers,
  useRoomDraft,
  useUnreadCount,
  type OptimisticMessage,
  type MessageStatus,
} from '../stores/chatStore';
import type { Message, TypingIndicator } from '@socio/types';
import { websocket } from '../services/websocket';

/**
 * Zod schema for sendMessage input validation
 */
const sendMessageInputSchema = z.object({
  content: z.string().min(1, 'Message content cannot be empty').max(10000, 'Message content too long'),
  contentType: z.enum(['text', 'image', 'video', 'audio', 'file', 'location']),
});

/**
 * Generate a unique temporary ID for optimistic messages
 */
const generateTempId = (): string => `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

/**
 * Hook for chat room functionality
 * Provides messages, typing indicators, drafts, and actions
 */
export function useChat(roomId: string) {
  // Selectors for room-specific state
  const messages = useRoomMessages(roomId);
  const typingUsers = useTypingUsers(roomId);
  const draft = useRoomDraft(roomId);
  const unreadCount = useUnreadCount(roomId);

  // Store actions
  const {
    addMessage,
    addOptimisticMessage,
    updateMessageStatus,
    setMessages,
    prependMessages,
    deleteMessage,
    editMessage,
    setTyping,
    startTyping,
    stopTyping,
    setDraft,
    clearDraft,
    markAsRead,
    clearRoom,
    joinRoom,
    leaveRoom,
  } = useChatStore();

  /**
   * Send a message with optimistic update
   * Returns tempId on success, throws on validation error
   */
  const sendMessage = useCallback((content: string, contentType: 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' = 'text') => {
    // Validate input
    const validationResult = sendMessageInputSchema.safeParse({ content, contentType });
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors[0]?.message ?? 'Invalid message';
      console.error('Message validation failed:', errorMessage);
      throw new Error(errorMessage);
    }

    const { content: validatedContent, contentType: validatedContentType } = validationResult.data;
    const tempId = generateTempId();

    // Create optimistic message
    const optimisticMessage: OptimisticMessage = {
      id: tempId,
      roomId,
      senderId: '', // Will be set by backend
      content: validatedContent,
      contentType: validatedContentType,
      isEdited: false,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'pending',
      tempId,
    };

    // Add to store immediately
    addOptimisticMessage(roomId, optimisticMessage);

    // Send via WebSocket with error handling
    try {
      websocket.sendMessage(roomId, validatedContent, validatedContentType);
      // Clear draft after successful send
      clearDraft(roomId);
    } catch (error) {
      console.error('Failed to send message:', error);
      // Mark optimistic message as failed
      updateMessageStatus(roomId, tempId, 'failed');
    }

    return tempId;
  }, [roomId, addOptimisticMessage, clearDraft, updateMessageStatus]);

  /**
   * Handle incoming message from WebSocket
   */
  const handleIncomingMessage = useCallback((message: Message) => {
    addMessage(roomId, message);
  }, [roomId, addMessage]);

  /**
   * Handle typing indicator
   */
  const handleTyping = useCallback((indicator: TypingIndicator) => {
    setTyping(roomId, indicator);
  }, [roomId, setTyping]);

  /**
   * Start typing indicator (debounce on client side)
   */
  const sendTypingStart = useCallback(() => {
    startTyping(roomId);
  }, [roomId, startTyping]);

  /**
   * Stop typing indicator
   */
  const sendTypingStop = useCallback(() => {
    stopTyping(roomId);
  }, [roomId, stopTyping]);

  /**
   * Load initial messages
   */
  const loadMessages = useCallback((msgs: Message[]) => {
    setMessages(roomId, msgs);
  }, [roomId, setMessages]);

  /**
   * Load older messages (prepend)
   */
  const loadOlderMessages = useCallback((msgs: Message[]) => {
    prependMessages(roomId, msgs);
  }, [roomId, prependMessages]);

  /**
   * Update message status (for optimistic updates)
   */
  const updateStatus = useCallback((tempId: string, status: MessageStatus, realMessage?: Message) => {
    updateMessageStatus(roomId, tempId, status, realMessage);
  }, [roomId, updateMessageStatus]);

  /**
   * Delete a message
   */
  const removeMessage = useCallback((messageId: string) => {
    deleteMessage(roomId, messageId);
  }, [roomId, deleteMessage]);

  /**
   * Edit a message
   */
  const updateMessage = useCallback((messageId: string, content: string) => {
    editMessage(roomId, messageId, content);
  }, [roomId, editMessage]);

  /**
   * Update draft text
   */
  const updateDraft = useCallback((content: string) => {
    setDraft(roomId, content);
  }, [roomId, setDraft]);

  /**
   * Mark messages as read
   */
  const markRead = useCallback((messageId: string) => {
    markAsRead(roomId, messageId);
  }, [roomId, markAsRead]);

  /**
   * Clear room data
   */
  const clear = useCallback(() => {
    clearRoom(roomId);
  }, [roomId, clearRoom]);

  /**
   * Join the room
   */
  const join = useCallback(() => {
    joinRoom(roomId);
  }, [roomId, joinRoom]);

  /**
   * Leave the room
   */
  const leave = useCallback(() => {
    leaveRoom(roomId);
  }, [roomId, leaveRoom]);

  return useMemo(() => ({
    // State
    messages,
    typingUsers,
    draft,
    unreadCount,

    // Message actions
    sendMessage,
    handleIncomingMessage,
    loadMessages,
    loadOlderMessages,
    updateStatus,
    removeMessage,
    updateMessage,

    // Typing actions
    handleTyping,
    sendTypingStart,
    sendTypingStop,

    // Draft actions
    updateDraft,

    // Read receipt actions
    markRead,

    // Room actions
    join,
    leave,
    clear,
  }), [
    messages,
    typingUsers,
    draft,
    unreadCount,
    sendMessage,
    handleIncomingMessage,
    loadMessages,
    loadOlderMessages,
    updateStatus,
    removeMessage,
    updateMessage,
    handleTyping,
    sendTypingStart,
    sendTypingStop,
    updateDraft,
    markRead,
    join,
    leave,
    clear,
  ]);
}
