import { io, type Socket } from 'socket.io-client';
import { z } from 'zod';
import type { Message, TypingIndicator, UserPresence } from '@socio/types';

type MessageHandler = (message: Message) => void;
type TypingHandler = (indicator: TypingIndicator) => void;
type PresenceHandler = (presence: UserPresence) => void;

/**
 * Zod schema for token refresh response from the server
 */
const tokenRefreshResultSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
});

/**
 * Zod schema for token refresh error response
 */
const tokenRefreshErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});

/**
 * Token refresh response from the server
 */
export type TokenRefreshResult = z.infer<typeof tokenRefreshResultSchema>;

/**
 * Token refresh error from the server
 */
export type TokenRefreshError = z.infer<typeof tokenRefreshErrorSchema>;

type TokenRefreshHandler = (tokens: TokenRefreshResult) => void;
type TokenRefreshErrorHandler = (error: TokenRefreshError) => void;

// Zod schema for process-like object
const ProcessEnvSchema = z.object({
  process: z.object({
    env: z.record(z.string(), z.string().optional()),
  }),
});

// Safe environment variable access for cross-platform compatibility
const getEnvVar = (key: string): string | undefined => {
  try {
    // Access process.env safely for both Node.js and bundled environments
    const result = ProcessEnvSchema.safeParse(globalThis);
    if (result.success) {
      return result.data.process.env[key];
    }
    return undefined;
  } catch {
    return undefined;
  }
};

const WS_URL = getEnvVar('WS_URL') || 'http://localhost:3000';

class WebSocketService {
  private socket: Socket | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private typingHandlers: Set<TypingHandler> = new Set();
  private presenceHandlers: Set<PresenceHandler> = new Set();
  private tokenRefreshHandlers: Set<TokenRefreshHandler> = new Set();
  private tokenRefreshErrorHandlers: Set<TokenRefreshErrorHandler> = new Set();

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

    // Listen for token refresh events (from server-initiated or callback responses)
    this.socket.on('auth:refreshed', (tokens: unknown) => {
      const validatedTokens = tokenRefreshResultSchema.safeParse(tokens);
      if (!validatedTokens.success) {
        console.error('Invalid token refresh response:', validatedTokens.error.message);
        return;
      }
      this.tokenRefreshHandlers.forEach((handler) => handler(validatedTokens.data));
    });

    // Listen for token refresh errors
    this.socket.on('error', (error: unknown) => {
      const validatedError = tokenRefreshErrorSchema.safeParse(error);
      if (!validatedError.success) {
        // Log non-token-refresh errors so they aren't silently dropped
        console.error('WebSocket error:', error);
        return;
      }
      if (validatedError.data.code === 'TOKEN_REFRESH_FAILED') {
        this.tokenRefreshErrorHandlers.forEach((handler) => handler(validatedError.data));
      }
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

  /**
   * Subscribe to token refresh events
   * Called when tokens are successfully refreshed over WebSocket
   */
  onTokenRefresh(handler: TokenRefreshHandler) {
    this.tokenRefreshHandlers.add(handler);
    return () => this.tokenRefreshHandlers.delete(handler);
  }

  /**
   * Subscribe to token refresh error events
   */
  onTokenRefreshError(handler: TokenRefreshErrorHandler) {
    this.tokenRefreshErrorHandlers.add(handler);
    return () => this.tokenRefreshErrorHandlers.delete(handler);
  }

  /**
   * Refresh tokens over an active WebSocket connection
   * This allows token refresh without disconnecting
   *
   * @param refreshToken - The refresh token to use
   * @param timeoutMs - Timeout in milliseconds (default: 10000ms)
   * @returns Promise that resolves with new tokens or rejects with error
   *
   * @example
   * ```typescript
   * try {
   *   const tokens = await websocket.refreshTokens(currentRefreshToken);
   *   // Store new tokens
   *   await secureStorage.saveTokens(tokens);
   * } catch (error) {
   *   // Handle refresh failure - may need to re-authenticate
   *   console.error('Token refresh failed:', error);
   * }
   * ```
   */
  refreshTokens(refreshToken: string, timeoutMs: number = 10000): Promise<TokenRefreshResult> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      let isResolved = false;
      const timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          reject(new Error('Token refresh timed out'));
        }
      }, timeoutMs);

      this.socket.emit(
        'auth:refresh',
        { refreshToken },
        (response: unknown) => {
          if (isResolved) return;
          isResolved = true;
          clearTimeout(timeoutId);

          const tokenResult = tokenRefreshResultSchema.safeParse(response);
          if (tokenResult.success) {
            resolve(tokenResult.data);
          } else {
            const errorResult = tokenRefreshErrorSchema.safeParse(response);
            const message = errorResult.success
              ? errorResult.data.message
              : 'Token refresh failed';
            reject(new Error(message));
          }
        }
      );
    });
  }

  /**
   * Check if the WebSocket is currently connected
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * Get the socket instance for advanced usage
   * Use with caution - prefer the provided methods
   */
  getSocket(): Socket | null {
    return this.socket;
  }
}

export const websocket = new WebSocketService();
