import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * WebSocket event DTOs for chat gateway
 */

// Join room request
const joinRoomSchema = z.object({
  roomId: z.string().uuid('Invalid room ID format'),
});

// Leave room request
const leaveRoomSchema = z.object({
  roomId: z.string().uuid('Invalid room ID format'),
});

// Send message request
const sendMessageSchema = z.object({
  roomId: z.string().uuid('Invalid room ID format'),
  content: z.string().min(1, 'Message content is required').max(4000, 'Message too long'),
  replyToId: z.string().uuid().optional(),
});

// Typing indicator (legacy - kept for backwards compatibility)
const typingSchema = z.object({
  roomId: z.string().uuid('Invalid room ID format'),
  isTyping: z.boolean(),
});

// Typing start/stop (new - separate events)
const typingStartSchema = z.object({
  roomId: z.string().uuid('Invalid room ID format'),
});

const typingStopSchema = z.object({
  roomId: z.string().uuid('Invalid room ID format'),
});

// DTO classes
export class JoinRoomDto extends createZodDto(joinRoomSchema) {}
export class LeaveRoomDto extends createZodDto(leaveRoomSchema) {}
export class SendMessageDto extends createZodDto(sendMessageSchema) {}
export class TypingDto extends createZodDto(typingSchema) {}
export class TypingStartDto extends createZodDto(typingStartSchema) {}
export class TypingStopDto extends createZodDto(typingStopSchema) {}

// Response types
export interface RoomJoinedResponse {
  roomId: string;
  roomName: string;
  memberCount: number;
  onlineUsers: string[];
}

export interface MessageResponse {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  content: string;
  replyToId?: string;
  createdAt: Date;
}

export interface UserPresenceEvent {
  userId: string;
  username: string;
  roomId: string;
  action: 'joined' | 'left';
}

export interface TypingEvent {
  userId: string;
  username: string;
  roomId: string;
  isTyping: boolean;
}

/**
 * Typing update event - sent when typing users list changes
 * Contains the list of all currently typing users in a room
 */
export interface TypingUpdateEvent {
  roomId: string;
  typingUsers: Array<{ userId: string; username: string }>;
}

export interface WsErrorResponse {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// Token refresh request (for WebSocket auth refresh)
const tokenRefreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export class WsTokenRefreshDto extends createZodDto(tokenRefreshSchema) {}

// Token refresh response
export interface TokenRefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// Presence WebSocket DTOs
const PRESENCE_STATUSES = ['ONLINE', 'IDLE', 'AWAY', 'BUSY'] as const;

// Get room presence request
const getRoomPresenceSchema = z.object({
  roomId: z.string().uuid('Invalid room ID format'),
});

// Set presence status request
const setPresenceStatusSchema = z.object({
  status: z.enum(PRESENCE_STATUSES, {
    errorMap: () => ({ message: 'Invalid status. Must be one of: ONLINE, IDLE, AWAY, BUSY' }),
  }),
});

export class WsGetRoomPresenceDto extends createZodDto(getRoomPresenceSchema) {}
export class WsSetPresenceStatusDto extends createZodDto(setPresenceStatusSchema) {}

// Read receipt request - mark a message as read
const markMessageReadSchema = z.object({
  roomId: z.string().uuid('Invalid room ID format'),
  messageId: z.string().uuid('Invalid message ID format'),
});

// Get read receipts for a message
const getReadReceiptsSchema = z.object({
  roomId: z.string().uuid('Invalid room ID format'),
  messageId: z.string().uuid('Invalid message ID format'),
});

export class WsMarkMessageReadDto extends createZodDto(markMessageReadSchema) {}
export class WsGetReadReceiptsDto extends createZodDto(getReadReceiptsSchema) {}

/**
 * Read receipt event - sent when a user reads messages
 * Broadcast to message senders to show "seen" status
 */
export interface ReadReceiptEvent {
  roomId: string;
  messageId: string;
  userId: string;
  username: string;
  readAt: Date;
}

/**
 * Read receipt response - who has read a specific message
 */
export interface ReadReceiptsResponse {
  roomId: string;
  messageId: string;
  readers: Array<{
    userId: string;
    username: string;
    readAt: Date;
  }>;
}
