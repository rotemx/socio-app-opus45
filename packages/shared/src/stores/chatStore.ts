import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { z } from 'zod';
import type { Message, TypingIndicator, UserPresence, RoomMember } from '@socio/types';
import { websocket } from '../services/websocket';

/**
 * Zod schemas for runtime validation of WebSocket events
 */
const MessageSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  senderId: z.string(),
  content: z.string(),
  contentType: z.enum(['text', 'image', 'video', 'audio', 'file', 'location']),
  metadata: z.record(z.unknown()).optional(),
  replyToId: z.string().optional(),
  isEdited: z.boolean(),
  isDeleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

const TypingIndicatorSchema = z.object({
  roomId: z.string(),
  userId: z.string(),
  isTyping: z.boolean(),
});

const UserPresenceSchema = z.object({
  userId: z.string(),
  status: z.enum(['online', 'idle', 'offline']),
  lastSeenAt: z.coerce.date(),
});

/**
 * Status for optimistic messages
 */
export type MessageStatus = 'pending' | 'sent' | 'failed';

/**
 * Extended message with optimistic update status
 */
export interface OptimisticMessage extends Message {
  status: MessageStatus;
  tempId?: string;
}

/**
 * Room-specific state
 */
export interface RoomState {
  messages: OptimisticMessage[];
  members: RoomMember[];
  unreadCount: number;
  lastReadMessageId?: string;
}

/**
 * Typing user info
 */
export interface TypingUser {
  userId: string;
  userName?: string;
  timestamp: number;
}

/**
 * Chat store state interface
 */
export interface ChatState {
  // State
  activeRoomId: string | null;
  rooms: Record<string, RoomState>;
  typingUsers: Record<string, TypingUser[]>;
  presence: Record<string, UserPresence>;
  drafts: Record<string, string>;
  isConnected: boolean;

  // Room actions
  setActiveRoom: (roomId: string | null) => void;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;

  // Message actions
  addMessage: (roomId: string, message: Message) => void;
  addOptimisticMessage: (roomId: string, message: OptimisticMessage) => void;
  updateMessageStatus: (roomId: string, tempId: string, status: MessageStatus, realMessage?: Message) => void;
  setMessages: (roomId: string, messages: Message[]) => void;
  prependMessages: (roomId: string, messages: Message[]) => void;
  deleteMessage: (roomId: string, messageId: string) => void;
  editMessage: (roomId: string, messageId: string, content: string) => void;

  // Typing actions
  setTyping: (roomId: string, indicator: TypingIndicator) => void;
  startTyping: (roomId: string) => void;
  stopTyping: (roomId: string) => void;
  clearStaleTypingIndicators: (roomId: string) => void;

  // Presence actions
  setPresence: (userId: string, presence: UserPresence) => void;
  setConnectionStatus: (connected: boolean) => void;

  // Member actions
  setMembers: (roomId: string, members: RoomMember[]) => void;
  addMember: (roomId: string, member: RoomMember) => void;
  removeMember: (roomId: string, userId: string) => void;

  // Draft actions
  setDraft: (roomId: string, content: string) => void;
  clearDraft: (roomId: string) => void;
  getDraft: (roomId: string) => string;

  // Read receipt actions
  markAsRead: (roomId: string, messageId: string) => void;
  setUnreadCount: (roomId: string, count: number) => void;

  // Cleanup
  clearRoom: (roomId: string) => void;
  reset: () => void;
}

/**
 * Default room state
 */
const createDefaultRoomState = (): RoomState => ({
  messages: [],
  members: [],
  unreadCount: 0,
  lastReadMessageId: undefined,
});

/**
 * Ensure room state exists and return it
 * This helps with TypeScript narrowing
 */
const getOrCreateRoomState = (state: ChatState, roomId: string): RoomState => {
  if (!state.rooms[roomId]) {
    state.rooms[roomId] = createDefaultRoomState();
  }
  return state.rooms[roomId];
};

/**
 * Typing indicator timeout (5 seconds)
 */
const TYPING_TIMEOUT_MS = 5000;

/**
 * Storage for drafts persistence
 * This will be configured at the platform level
 */
let customStorage: StateStorage | undefined;

/**
 * Set custom storage for drafts (call this in platform-specific setup)
 */
export const setChatStorageEngine = (storage: StateStorage): void => {
  customStorage = storage;
};

/**
 * Get storage engine (falls back to in-memory for SSR)
 */
const getStorage = (): StateStorage => {
  if (customStorage) {
    return customStorage;
  }
  // Fallback for environments without localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    return {
      getItem: (name) => {
        try {
          return window.localStorage.getItem(name);
        } catch {
          return null;
        }
      },
      setItem: (name, value) => {
        try {
          window.localStorage.setItem(name, value);
        } catch {
          // Silently fail if localStorage is unavailable (private browsing, quota exceeded)
        }
      },
      removeItem: (name) => {
        try {
          window.localStorage.removeItem(name);
        } catch {
          // Silently fail if localStorage is unavailable
        }
      },
    };
  }
  // In-memory fallback for SSR
  const store: Record<string, string> = {};
  return {
    getItem: (name) => store[name] ?? null,
    setItem: (name, value) => { store[name] = value; },
    removeItem: (name) => { delete store[name]; },
  };
};

/**
 * Initial state for reset
 */
const initialState = {
  activeRoomId: null,
  rooms: {},
  typingUsers: {},
  presence: {},
  drafts: {},
  isConnected: false,
};

/**
 * Chat store with immer for immutable updates and persist for drafts
 */
export const useChatStore = create<ChatState>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      // Room actions
      setActiveRoom: (roomId) => set((state) => {
        state.activeRoomId = roomId;
      }),

      joinRoom: (roomId) => {
        const state = get();
        if (!state.rooms[roomId]) {
          set((s) => {
            s.rooms[roomId] = createDefaultRoomState();
          });
        }
        try {
          websocket.joinRoom(roomId);
          set((s) => {
            s.activeRoomId = roomId;
          });
        } catch (error) {
          console.error('Failed to join room:', error);
          // Clean up the created room state on failure
          set((s) => {
            delete s.rooms[roomId];
          });
        }
      },

      leaveRoom: (roomId) => {
        try {
          websocket.leaveRoom(roomId);
          set((state) => {
            if (state.activeRoomId === roomId) {
              state.activeRoomId = null;
            }
          });
        } catch (error) {
          console.error('Failed to leave room:', error);
        }
      },

      // Message actions
      addMessage: (roomId, message) => set((state) => {
        const room = getOrCreateRoomState(state, roomId);
        const optimisticMessage: OptimisticMessage = {
          ...message,
          status: 'sent',
        };
        // Avoid duplicates
        const existingIndex = room.messages.findIndex(m => m.id === message.id);
        if (existingIndex === -1) {
          room.messages.push(optimisticMessage);
        }
      }),

      addOptimisticMessage: (roomId, message) => set((state) => {
        const room = getOrCreateRoomState(state, roomId);
        room.messages.push(message);
      }),

      updateMessageStatus: (roomId, tempId, status, realMessage) => set((state) => {
        const room = state.rooms[roomId];
        if (!room) return;
        const index = room.messages.findIndex(m => m.tempId === tempId);
        if (index !== -1) {
          const message = room.messages[index];
          if (message) {
            if (realMessage && status === 'sent') {
              // Replace optimistic message with real message
              room.messages[index] = { ...realMessage, status: 'sent' };
            } else {
              message.status = status;
            }
          }
        }
      }),

      setMessages: (roomId, messages) => set((state) => {
        const room = getOrCreateRoomState(state, roomId);
        room.messages = messages.map(m => ({ ...m, status: 'sent' as MessageStatus }));
      }),

      prependMessages: (roomId, messages) => set((state) => {
        const room = getOrCreateRoomState(state, roomId);
        const optimisticMessages = messages.map(m => ({ ...m, status: 'sent' as MessageStatus }));
        room.messages = [...optimisticMessages, ...room.messages];
      }),

      deleteMessage: (roomId, messageId) => set((state) => {
        const room = state.rooms[roomId];
        if (!room) return;
        room.messages = room.messages.filter(m => m.id !== messageId);
      }),

      editMessage: (roomId, messageId, content) => set((state) => {
        const room = state.rooms[roomId];
        if (!room) return;
        const message = room.messages.find(m => m.id === messageId);
        if (message) {
          message.content = content;
          message.isEdited = true;
          message.updatedAt = new Date();
        }
      }),

      // Typing actions
      setTyping: (roomId, indicator) => set((state) => {
        if (!state.typingUsers[roomId]) {
          state.typingUsers[roomId] = [];
        }
        const users = state.typingUsers[roomId];
        const existingIndex = users.findIndex(u => u.userId === indicator.userId);

        if (indicator.isTyping) {
          const typingUser: TypingUser = {
            userId: indicator.userId,
            timestamp: Date.now(),
          };
          if (existingIndex !== -1) {
            users[existingIndex] = typingUser;
          } else {
            users.push(typingUser);
          }
        } else {
          if (existingIndex !== -1) {
            users.splice(existingIndex, 1);
          }
        }
      }),

      startTyping: (roomId) => {
        try {
          websocket.sendTyping(roomId, true);
        } catch (error) {
          console.error('Failed to send typing indicator:', error);
        }
      },

      stopTyping: (roomId) => {
        try {
          websocket.sendTyping(roomId, false);
        } catch (error) {
          console.error('Failed to stop typing indicator:', error);
        }
      },

      clearStaleTypingIndicators: (roomId) => set((state) => {
        if (!state.typingUsers[roomId]) return;
        const now = Date.now();
        state.typingUsers[roomId] = state.typingUsers[roomId].filter(
          u => now - u.timestamp < TYPING_TIMEOUT_MS
        );
      }),

      // Presence actions
      setPresence: (userId, presence) => set((state) => {
        state.presence[userId] = presence;
      }),

      setConnectionStatus: (connected) => set((state) => {
        state.isConnected = connected;
      }),

      // Member actions
      setMembers: (roomId, members) => set((state) => {
        const room = getOrCreateRoomState(state, roomId);
        room.members = members;
      }),

      addMember: (roomId, member) => set((state) => {
        const room = getOrCreateRoomState(state, roomId);
        // Avoid duplicates
        const existingIndex = room.members.findIndex(m => m.userId === member.userId);
        if (existingIndex === -1) {
          room.members.push(member);
        }
      }),

      removeMember: (roomId, userId) => set((state) => {
        const room = state.rooms[roomId];
        if (!room) return;
        room.members = room.members.filter(m => m.userId !== userId);
      }),

      // Draft actions
      setDraft: (roomId, content) => set((state) => {
        if (content.trim()) {
          state.drafts[roomId] = content;
        } else {
          delete state.drafts[roomId];
        }
      }),

      clearDraft: (roomId) => set((state) => {
        delete state.drafts[roomId];
      }),

      getDraft: (roomId) => {
        const state = get();
        return state.drafts[roomId] ?? '';
      },

      // Read receipt actions
      markAsRead: (roomId, messageId) => set((state) => {
        const room = getOrCreateRoomState(state, roomId);
        room.lastReadMessageId = messageId;
        room.unreadCount = 0;
      }),

      setUnreadCount: (roomId, count) => set((state) => {
        const room = getOrCreateRoomState(state, roomId);
        room.unreadCount = count;
      }),

      // Cleanup
      clearRoom: (roomId) => set((state) => {
        delete state.rooms[roomId];
        delete state.typingUsers[roomId];
        delete state.drafts[roomId];
      }),

      reset: () => set(initialState),
    })),
    {
      name: 'socio-chat-drafts',
      storage: createJSONStorage(() => getStorage()),
      // Only persist drafts
      partialize: (state) => ({ drafts: state.drafts }),
    }
  )
);

/**
 * Selector hook for active room state
 * Uses a single selector to prevent unnecessary re-renders
 */
export const useActiveRoom = () => {
  return useChatStore((state) => ({
    activeRoomId: state.activeRoomId,
    activeRoom: state.activeRoomId ? state.rooms[state.activeRoomId] ?? null : null,
  }));
};

/**
 * Selector hook for typing users in a room
 */
export const useTypingUsers = (roomId: string) => {
  return useChatStore((state) => state.typingUsers[roomId] ?? []);
};

/**
 * Selector hook for room messages
 */
export const useRoomMessages = (roomId: string) => {
  return useChatStore((state) => state.rooms[roomId]?.messages ?? []);
};

/**
 * Selector hook for room members
 */
export const useRoomMembers = (roomId: string) => {
  return useChatStore((state) => state.rooms[roomId]?.members ?? []);
};

/**
 * Selector hook for user presence
 */
export const useUserPresence = (userId: string) => {
  return useChatStore((state) => state.presence[userId]);
};

/**
 * Selector hook for room draft
 */
export const useRoomDraft = (roomId: string) => {
  return useChatStore((state) => state.drafts[roomId] ?? '');
};

/**
 * Selector hook for connection status
 */
export const useConnectionStatus = () => {
  return useChatStore((state) => state.isConnected);
};

/**
 * Selector hook for unread count
 */
export const useUnreadCount = (roomId: string) => {
  return useChatStore((state) => state.rooms[roomId]?.unreadCount ?? 0);
};

/**
 * Initialize WebSocket event handlers
 * Call this once when the app starts after authentication
 */
export const initializeChatWebSocketHandlers = (): (() => void) => {
  const store = useChatStore.getState();

  // Handle incoming messages with validation
  const unsubMessage = websocket.onMessage((rawMessage) => {
    try {
      const message = MessageSchema.parse(rawMessage);

      // Get state once before any mutations to avoid race conditions
      const currentState = useChatStore.getState();
      const isActiveRoom = currentState.activeRoomId === message.roomId;
      const currentUnreadCount = currentState.rooms[message.roomId]?.unreadCount ?? 0;

      // Add message to store
      store.addMessage(message.roomId, message as Message);

      // Increment unread count if not the active room
      if (!isActiveRoom) {
        store.setUnreadCount(message.roomId, currentUnreadCount + 1);
      }
    } catch (error) {
      console.error('Failed to handle incoming message:', error);
    }
  });

  // Handle typing indicators with validation
  const unsubTyping = websocket.onTyping((rawIndicator) => {
    try {
      const indicator = TypingIndicatorSchema.parse(rawIndicator);
      store.setTyping(indicator.roomId, indicator as TypingIndicator);
    } catch (error) {
      console.error('Failed to handle typing indicator:', error);
    }
  });

  // Handle presence updates with validation
  const unsubPresence = websocket.onPresence((rawPresence) => {
    try {
      const presence = UserPresenceSchema.parse(rawPresence);
      store.setPresence(presence.userId, presence as UserPresence);
    } catch (error) {
      console.error('Failed to handle presence update:', error);
    }
  });

  // Return cleanup function
  return () => {
    unsubMessage();
    unsubTyping();
    unsubPresence();
  };
};
