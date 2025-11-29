import { Injectable, Logger, ForbiddenException, NotFoundException } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { PrismaService } from '../../database';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs runtime import
import { PresenceService } from '../presence/presence.service';

/**
 * Room info returned by validateRoomAccess
 */
export interface RoomAccessInfo {
  id: string;
  name: string;
  memberCount: number;
  isMember: boolean;
}

/**
 * Message returned by sendMessage
 */
export interface SavedMessage {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  replyToId: string | null;
  createdAt: Date;
}

/**
 * Chat Service
 * Handles chat room access validation and message persistence
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly presenceService: PresenceService
  ) {}

  /**
   * Validate that a user can access a room
   * User must be a member of the room or the room must be public
   *
   * @param userId - User ID
   * @param roomId - Room ID
   * @returns Room info if access is granted
   * @throws NotFoundException if room doesn't exist
   * @throws ForbiddenException if user is not a member
   */
  async validateRoomAccess(userId: string, roomId: string): Promise<RoomAccessInfo> {
    // Find the room
    const room = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: {
        _count: { select: { members: true } },
      },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (!room.isActive) {
      throw new ForbiddenException('Room is no longer active');
    }

    // Check if user is a member
    const membership = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });

    // If room is private and user is not a member, deny access
    if (!room.isPublic && !membership) {
      throw new ForbiddenException('Not a member of this private room');
    }

    // If room is public but user is not a member, auto-join them
    if (room.isPublic && !membership) {
      // Check max members
      const memberCount = room._count.members;
      if (memberCount >= room.maxMembers) {
        throw new ForbiddenException('Room is full');
      }

      // Auto-join public room
      await this.prisma.roomMember.create({
        data: {
          roomId,
          userId,
          role: 'MEMBER',
        },
      });

      this.logger.debug(`User ${userId} auto-joined public room ${roomId}`);
    }

    return {
      id: room.id,
      name: room.name,
      memberCount: room._count.members,
      isMember: !!membership,
    };
  }

  /**
   * Get list of online user IDs in a room
   *
   * @param roomId - Room ID
   * @returns Array of online user IDs
   */
  async getOnlineUsersInRoom(roomId: string): Promise<string[]> {
    return this.presenceService.getRoomOnlineUsers(roomId);
  }

  /**
   * Send a message to a room
   * Validates membership and persists the message
   *
   * @param senderId - Sender's user ID
   * @param roomId - Target room ID
   * @param content - Message content
   * @param replyToId - Optional ID of message being replied to
   * @returns Saved message
   * @throws ForbiddenException if user is not a member
   */
  async sendMessage(
    senderId: string,
    roomId: string,
    content: string,
    replyToId?: string
  ): Promise<SavedMessage> {
    // Verify membership
    const membership = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId: senderId } },
    });

    if (!membership) {
      throw new ForbiddenException('Must be a member to send messages');
    }

    if (membership.isMuted) {
      throw new ForbiddenException('You are muted in this room');
    }

    // Validate reply target if provided
    if (replyToId) {
      const replyTarget = await this.prisma.message.findUnique({
        where: { id: replyToId },
        select: { roomId: true },
      });

      if (!replyTarget || replyTarget.roomId !== roomId) {
        throw new ForbiddenException('Invalid reply target');
      }
    }

    // Create message
    const message = await this.prisma.message.create({
      data: {
        roomId,
        senderId,
        content,
        replyToId,
      },
    });

    // Update room's last activity
    await this.prisma.chatRoom.update({
      where: { id: roomId },
      data: { lastActivityAt: new Date() },
    });

    // Update member's last read
    await this.prisma.roomMember.update({
      where: { roomId_userId: { roomId, userId: senderId } },
      data: { lastReadAt: new Date() },
    });

    this.logger.debug(`Message saved: ${message.id} in room ${roomId}`);

    return {
      id: message.id,
      roomId: message.roomId,
      senderId: message.senderId,
      content: message.content,
      replyToId: message.replyToId,
      createdAt: message.createdAt,
    };
  }

  /**
   * Mark a user as offline
   *
   * @param userId - User ID
   */
  async setUserOffline(userId: string): Promise<void> {
    await this.presenceService.setOffline(userId);
  }

  /**
   * Get recent messages for a room
   *
   * @param roomId - Room ID
   * @param limit - Max messages to return
   * @param before - Cursor for pagination (message ID)
   * @returns Messages with sender info
   */
  async getRoomMessages(
    roomId: string,
    limit = 50,
    before?: string
  ): Promise<{
    messages: Array<SavedMessage & { sender: { username: string; avatarUrl: string | null } }>;
    cursor: string | null;
  }> {
    // Build the where clause - fetch cursor timestamp separately to avoid N+1
    let cursorDate: Date | undefined;
    if (before) {
      const cursorMessage = await this.prisma.message.findUnique({
        where: { id: before },
        select: { createdAt: true },
      });
      cursorDate = cursorMessage?.createdAt;
    }

    const messages = await this.prisma.message.findMany({
      where: {
        roomId,
        isDeleted: false,
        ...(cursorDate && {
          createdAt: { lt: cursorDate },
        }),
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: { username: true, avatarUrl: true },
        },
      },
    });

    return {
      messages: messages.map((m) => ({
        id: m.id,
        roomId: m.roomId,
        senderId: m.senderId,
        content: m.content,
        replyToId: m.replyToId,
        createdAt: m.createdAt,
        sender: m.sender,
      })),
      cursor: messages.length === limit ? (messages[messages.length - 1]?.id ?? null) : null,
    };
  }

  /**
   * Mark messages as read for a user in a room
   *
   * @param userId - User ID
   * @param roomId - Room ID
   */
  async markAsRead(userId: string, roomId: string): Promise<void> {
    await this.prisma.roomMember.update({
      where: { roomId_userId: { roomId, userId } },
      data: { lastReadAt: new Date() },
    });
  }

  /**
   * Delete a message (soft delete)
   *
   * @param messageId - Message ID
   * @param userId - User requesting deletion
   * @throws ForbiddenException if user is not the sender or a moderator
   */
  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        room: {
          include: {
            members: {
              where: { userId },
              select: { role: true },
            },
          },
        },
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const membership = message.room.members[0];
    const canDelete =
      message.senderId === userId ||
      ['CREATOR', 'ADMIN', 'MODERATOR'].includes(membership?.role ?? '');

    if (!canDelete) {
      throw new ForbiddenException('Not authorized to delete this message');
    }

    await this.prisma.message.update({
      where: { id: messageId },
      data: { isDeleted: true },
    });

    this.logger.debug(`Message deleted: ${messageId} by ${userId}`);
  }
}
