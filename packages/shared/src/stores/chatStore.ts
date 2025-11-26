import { create } from 'zustand';
import type { Message, TypingIndicator, UserPresence } from '@socio/types';

interface ChatState {
  messages: Record<string, Message[]>;
  typingUsers: Record<string, TypingIndicator[]>;
  presence: Record<string, UserPresence>;
  addMessage: (roomId: string, message: Message) => void;
  setMessages: (roomId: string, messages: Message[]) => void;
  setTyping: (roomId: string, indicator: TypingIndicator) => void;
  setPresence: (userId: string, presence: UserPresence) => void;
  clearRoom: (roomId: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: {},
  typingUsers: {},
  presence: {},

  addMessage: (roomId, message) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [roomId]: [...(state.messages[roomId] || []), message],
      },
    })),

  setMessages: (roomId, messages) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [roomId]: messages,
      },
    })),

  setTyping: (roomId, indicator) =>
    set((state) => {
      const roomTyping = state.typingUsers[roomId] || [];
      const filtered = roomTyping.filter((t) => t.userId !== indicator.userId);
      return {
        typingUsers: {
          ...state.typingUsers,
          [roomId]: indicator.isTyping ? [...filtered, indicator] : filtered,
        },
      };
    }),

  setPresence: (userId, presence) =>
    set((state) => ({
      presence: {
        ...state.presence,
        [userId]: presence,
      },
    })),

  clearRoom: (roomId) =>
    set((state) => {
      const { [roomId]: _, ...messages } = state.messages;
      const { [roomId]: __, ...typingUsers } = state.typingUsers;
      return { messages, typingUsers };
    }),
}));
