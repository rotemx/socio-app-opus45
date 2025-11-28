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

// Typing indicator
const typingSchema = z.object({
  roomId: z.string().uuid('Invalid room ID format'),
  isTyping: z.boolean(),
});

// DTO classes
export class JoinRoomDto extends createZodDto(joinRoomSchema) {}
export class LeaveRoomDto extends createZodDto(leaveRoomSchema) {}
export class SendMessageDto extends createZodDto(sendMessageSchema) {}
export class TypingDto extends createZodDto(typingSchema) {}

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

export interface WsErrorResponse {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
