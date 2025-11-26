export interface Message {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  contentType: MessageContentType;
  metadata?: MessageMetadata;
  replyToId?: string;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type MessageContentType = 'text' | 'image' | 'video' | 'audio' | 'file' | 'location';

export interface MessageMetadata {
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  thumbnailUrl?: string;
  duration?: number;
  width?: number;
  height?: number;
}

export interface ReadReceipt {
  roomId: string;
  userId: string;
  lastReadMessageId?: string;
  lastReadAt: Date;
}

export interface TypingIndicator {
  roomId: string;
  userId: string;
  isTyping: boolean;
}

export type PresenceStatus = 'online' | 'idle' | 'offline';

export interface UserPresence {
  userId: string;
  status: PresenceStatus;
  lastSeenAt: Date;
}
