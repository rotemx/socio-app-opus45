import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { type Prisma } from '@prisma/client';
import { type PrismaService } from '../../database';
import {
  type SendMessageDto,
  type EditMessageDto,
  type GetMessagesDto,
  type MarkReadDto,
} from './dto/messages.dto';

/**
 * Messages Service
 * Handles message CRUD operations and read receipts
 */
@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Send a message to a room
   */
  async sendMessage(senderId: string, dto: SendMessageDto) {
    this.logger.log(`User ${senderId} sending message to room ${dto.roomId}`);

    // Verify user is a member of the room
    const membership = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId: dto.roomId, userId: senderId } },
    });

    if (!membership) {
      throw new ForbiddenException('Not a member of this room');
    }

    // Create the message
    const message = await this.prisma.message.create({
      data: {
        roomId: dto.roomId,
        senderId,
        content: dto.content,
        contentType: dto.contentType,
        replyToId: dto.replyToId,
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
      },
      include: {
        sender: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            sender: {
              select: { id: true, username: true, displayName: true },
            },
          },
        },
      },
    });

    // Update room's last activity
    await this.prisma.chatRoom.update({
      where: { id: dto.roomId },
      data: { lastActivityAt: new Date() },
    });

    return message;
  }

  /**
   * Get messages from a room with pagination
   */
  async getMessages(dto: GetMessagesDto) {
    // Build createdAt filter - handle both before and after properly
    let createdAtFilter: { lt?: Date; gt?: Date } | undefined;
    if (dto.before || dto.after) {
      createdAtFilter = {};
      if (dto.before) createdAtFilter.lt = dto.before;
      if (dto.after) createdAtFilter.gt = dto.after;
    }

    const where = {
      roomId: dto.roomId,
      isDeleted: false,
      ...(createdAtFilter && { createdAt: createdAtFilter }),
    };

    const messages = await this.prisma.message.findMany({
      where,
      take: dto.limit,
      cursor: dto.cursor ? { id: dto.cursor } : undefined,
      skip: dto.cursor ? 1 : 0,
      include: {
        sender: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            sender: {
              select: { id: true, username: true, displayName: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      messages: messages.reverse(), // Return in chronological order
      cursor: messages.length === dto.limit ? messages[0]?.id : null,
    };
  }

  /**
   * Get a single message by ID
   */
  async findById(messageId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        sender: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            sender: {
              select: { id: true, username: true, displayName: true },
            },
          },
        },
      },
    });

    if (!message || message.isDeleted) {
      throw new NotFoundException('Message not found');
    }

    return message;
  }

  /**
   * Edit a message
   */
  async editMessage(messageId: string, userId: string, dto: EditMessageDto) {
    const message = await this.findById(messageId);

    if (message.senderId !== userId) {
      throw new ForbiddenException("Cannot edit another user's message");
    }

    return this.prisma.message.update({
      where: { id: messageId },
      data: {
        content: dto.content,
        isEdited: true,
      },
      include: {
        sender: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
      },
    });
  }

  /**
   * Delete a message (soft delete)
   */
  async deleteMessage(messageId: string, userId: string) {
    const message = await this.findById(messageId);

    // Check if user is the sender or a room admin/creator
    if (message.senderId !== userId) {
      const membership = await this.prisma.roomMember.findUnique({
        where: { roomId_userId: { roomId: message.roomId, userId } },
      });

      if (!membership || !['CREATOR', 'ADMIN', 'MODERATOR'].includes(membership.role)) {
        throw new ForbiddenException('Cannot delete this message');
      }
    }

    await this.prisma.message.update({
      where: { id: messageId },
      data: { isDeleted: true },
    });
  }

  /**
   * Mark messages as read
   */
  async markAsRead(userId: string, dto: MarkReadDto) {
    await this.prisma.readReceipt.upsert({
      where: {
        roomId_userId: { roomId: dto.roomId, userId },
      },
      update: {
        lastReadMessageId: dto.messageId,
        lastReadAt: new Date(),
      },
      create: {
        roomId: dto.roomId,
        userId,
        lastReadMessageId: dto.messageId,
      },
    });

    // Also update the member's lastReadAt
    await this.prisma.roomMember.update({
      where: { roomId_userId: { roomId: dto.roomId, userId } },
      data: { lastReadAt: new Date() },
    });
  }

  /**
   * Get unread count for a user in a room
   */
  async getUnreadCount(userId: string, roomId: string): Promise<number> {
    const receipt = await this.prisma.readReceipt.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });

    if (!receipt?.lastReadAt) {
      // User hasn't read any messages, return total count
      return this.prisma.message.count({
        where: { roomId, isDeleted: false },
      });
    }

    return this.prisma.message.count({
      where: {
        roomId,
        isDeleted: false,
        createdAt: { gt: receipt.lastReadAt },
        senderId: { not: userId }, // Don't count own messages
      },
    });
  }
}
