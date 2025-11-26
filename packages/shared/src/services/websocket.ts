import { io, Socket } from 'socket.io-client';
import type { Message, TypingIndicator, UserPresence } from '@socio/types';

type MessageHandler = (message: Message) => void;
type TypingHandler = (indicator: TypingIndicator) => void;
type PresenceHandler = (presence: UserPresence) => void;

// Safe environment variable access
const getEnvVar = (key: string): string | undefined => {
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      return import.meta.env[`VITE_${key}`] || import.meta.env[key];
    }
  } catch (e) {}
  try {
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key];
    }
  } catch (e) {}
  return undefined;
};

const WS_URL = getEnvVar('WS_URL') || 'http://localhost:3000';

class WebSocketService {
  private socket: Socket | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private typingHandlers: Set<TypingHandler> = new Set();
  private presenceHandlers: Set<PresenceHandler> = new Set();

  connect(token: string) {
    if (this.socket?.connected) {
      // If already connected with the same token, do nothing (simplification)
      // In a real app, we might check if the token changed.
      // For now, force reconnect if called again to ensure new token is used.
      this.disconnect();
    }

    this.socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
    });

    this.socket.on('message', (message: Message) => {
      this.messageHandlers.forEach((handler) => handler(message));
    });

    this.socket.on('typing', (indicator: TypingIndicator) => {
      this.typingHandlers.forEach((handler) => handler(indicator));
    });

    this.socket.on('presence', (presence: UserPresence) => {
      this.presenceHandlers.forEach((handler) => handler(presence));
    });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  joinRoom(roomId: string) {
    this.socket?.emit('join_room', { roomId });
  }

  leaveRoom(roomId: string) {
    this.socket?.emit('leave_room', { roomId });
  }

  sendMessage(roomId: string, content: string, contentType: string = 'text') {
    this.socket?.emit('send_message', {
      roomId,
      content,
      contentType,
    });
  }

  sendTyping(roomId: string, isTyping: boolean) {
    this.socket?.emit('typing', { roomId, isTyping });
  }

  onMessage(handler: MessageHandler) {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onTyping(handler: TypingHandler) {
    this.typingHandlers.add(handler);
    return () => this.typingHandlers.delete(handler);
  }

  onPresence(handler: PresenceHandler) {
    this.presenceHandlers.add(handler);
    return () => this.presenceHandlers.delete(handler);
  }
}

export const websocket = new WebSocketService();
