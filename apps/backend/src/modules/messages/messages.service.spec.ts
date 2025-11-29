import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MessagesService } from './messages.service';
import type { PrismaService } from '../../database';
import { ContentType, MemberRole } from '@prisma/client';

describe('MessagesService', () => {
  let service: MessagesService;
  let mockPrisma: jest.Mocked<
    Pick<PrismaService, 'roomMember' | 'message' | 'chatRoom' | 'readReceipt'>
  >;

  const mockUser = {
    id: 'user-123',
    username: 'testuser',
    displayName: 'Test User',
    avatarUrl: null,
  };

  const mockRoom = {
    id: 'room-456',
    name: 'Test Room',
  };

  const mockMessage = {
    id: 'msg-789',
    roomId: mockRoom.id,
    senderId: mockUser.id,
    content: 'Hello, world!',
    contentType: ContentType.TEXT,
    metadata: {},
    replyToId: null,
    replyTo: null,
    isEdited: false,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    sender: mockUser,
  };

  const mockMembership = {
    roomId: mockRoom.id,
    userId: mockUser.id,
    role: MemberRole.MEMBER,
    lastReadAt: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockPrisma = {
      roomMember: {
        findUnique: jest.fn(),
        update: jest.fn(),
      } as unknown as jest.Mocked<PrismaService['roomMember']>,
      message: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      } as unknown as jest.Mocked<PrismaService['message']>,
      chatRoom: {
        update: jest.fn(),
      } as unknown as jest.Mocked<PrismaService['chatRoom']>,
      readReceipt: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
      } as unknown as jest.Mocked<PrismaService['readReceipt']>,
    };

    service = new MessagesService(mockPrisma as unknown as PrismaService);
  });

  describe('sendMessage', () => {
    it('should create a message successfully', async () => {
      (mockPrisma.roomMember.findUnique as jest.Mock).mockResolvedValue(mockMembership);
      (mockPrisma.message.create as jest.Mock).mockResolvedValue(mockMessage);
      (mockPrisma.chatRoom.update as jest.Mock).mockResolvedValue({
        ...mockRoom,
        lastActivityAt: new Date(),
      });

      const dto = {
        roomId: mockRoom.id,
        content: 'Hello, world!',
        contentType: ContentType.TEXT,
      };

      const result = await service.sendMessage(mockUser.id, dto);

      expect(result).toEqual(mockMessage);
      expect(mockPrisma.roomMember.findUnique).toHaveBeenCalledWith({
        where: { roomId_userId: { roomId: mockRoom.id, userId: mockUser.id } },
      });
      expect(mockPrisma.message.create).toHaveBeenCalled();
      expect(mockPrisma.chatRoom.update).toHaveBeenCalledWith({
        where: { id: mockRoom.id },
        data: { lastActivityAt: expect.any(Date) },
      });
    });

    it('should throw ForbiddenException if user is not a member', async () => {
      (mockPrisma.roomMember.findUnique as jest.Mock).mockResolvedValue(null);

      const dto = {
        roomId: mockRoom.id,
        content: 'Hello!',
        contentType: ContentType.TEXT,
      };

      await expect(service.sendMessage(mockUser.id, dto)).rejects.toThrow(ForbiddenException);
    });

    it('should create a message with reply', async () => {
      const replyMessage = { ...mockMessage, replyToId: 'reply-msg-123' };
      (mockPrisma.roomMember.findUnique as jest.Mock).mockResolvedValue(mockMembership);
      (mockPrisma.message.create as jest.Mock).mockResolvedValue(replyMessage);
      (mockPrisma.chatRoom.update as jest.Mock).mockResolvedValue({
        ...mockRoom,
        lastActivityAt: new Date(),
      });

      const dto = {
        roomId: mockRoom.id,
        content: 'This is a reply',
        contentType: ContentType.TEXT,
        replyToId: 'reply-msg-123',
      };

      const result = await service.sendMessage(mockUser.id, dto);

      expect(result.replyToId).toBe('reply-msg-123');
    });

    it('should create a message with metadata', async () => {
      const metadata = { attachmentUrl: 'https://example.com/file.png' };
      const messageWithMetadata = { ...mockMessage, metadata };
      (mockPrisma.roomMember.findUnique as jest.Mock).mockResolvedValue(mockMembership);
      (mockPrisma.message.create as jest.Mock).mockResolvedValue(messageWithMetadata);
      (mockPrisma.chatRoom.update as jest.Mock).mockResolvedValue({
        ...mockRoom,
        lastActivityAt: new Date(),
      });

      const dto = {
        roomId: mockRoom.id,
        content: 'Check this out!',
        contentType: ContentType.IMAGE,
        metadata,
      };

      const result = await service.sendMessage(mockUser.id, dto);

      expect(result.metadata).toEqual(metadata);
    });
  });

  describe('getMessages', () => {
    it('should return paginated messages in chronological order', async () => {
      const messages = [
        { ...mockMessage, id: 'msg-1', createdAt: new Date('2025-01-01') },
        { ...mockMessage, id: 'msg-2', createdAt: new Date('2025-01-02') },
        { ...mockMessage, id: 'msg-3', createdAt: new Date('2025-01-03') },
      ];
      (mockPrisma.message.findMany as jest.Mock).mockResolvedValue(messages);

      const dto = { roomId: mockRoom.id, limit: 50 };

      const result = await service.getMessages(dto);

      expect(result.messages).toHaveLength(3);
      expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { roomId: mockRoom.id, isDeleted: false },
          take: 50,
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('should return cursor when there are more messages', async () => {
      // Messages returned from DB in descending order (newest first)
      const messages = Array.from({ length: 50 }, (_, i) => ({
        ...mockMessage,
        id: `msg-${49 - i}`, // msg-49, msg-48, ..., msg-0
      }));
      (mockPrisma.message.findMany as jest.Mock).mockResolvedValue(messages);

      const dto = { roomId: mockRoom.id, limit: 50 };

      const result = await service.getMessages(dto);

      // After reverse, messages[0] is the oldest message (msg-0)
      expect(result.cursor).toBe('msg-0');
    });

    it('should return null cursor when no more messages', async () => {
      const messages = [mockMessage];
      (mockPrisma.message.findMany as jest.Mock).mockResolvedValue(messages);

      const dto = { roomId: mockRoom.id, limit: 50 };

      const result = await service.getMessages(dto);

      expect(result.cursor).toBeNull();
    });

    it('should support cursor pagination', async () => {
      (mockPrisma.message.findMany as jest.Mock).mockResolvedValue([mockMessage]);

      const dto = { roomId: mockRoom.id, limit: 50, cursor: 'prev-msg-id' };

      await service.getMessages(dto);

      expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'prev-msg-id' },
          skip: 1,
        })
      );
    });

    it('should filter by before date', async () => {
      (mockPrisma.message.findMany as jest.Mock).mockResolvedValue([]);

      const before = new Date('2025-01-15');
      const dto = { roomId: mockRoom.id, limit: 50, before };

      await service.getMessages(dto);

      expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { lt: before },
          }),
        })
      );
    });

    it('should filter by after date', async () => {
      (mockPrisma.message.findMany as jest.Mock).mockResolvedValue([]);

      const after = new Date('2025-01-01');
      const dto = { roomId: mockRoom.id, limit: 50, after };

      await service.getMessages(dto);

      expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gt: after },
          }),
        })
      );
    });

    it('should filter by both before and after dates', async () => {
      (mockPrisma.message.findMany as jest.Mock).mockResolvedValue([]);

      const before = new Date('2025-01-15');
      const after = new Date('2025-01-01');
      const dto = { roomId: mockRoom.id, limit: 50, before, after };

      await service.getMessages(dto);

      expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { lt: before, gt: after },
          }),
        })
      );
    });
  });

  describe('findById', () => {
    it('should return a message by ID', async () => {
      (mockPrisma.message.findUnique as jest.Mock).mockResolvedValue(mockMessage);

      const result = await service.findById(mockMessage.id);

      expect(result).toEqual(mockMessage);
      expect(mockPrisma.message.findUnique).toHaveBeenCalledWith({
        where: { id: mockMessage.id },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if message not found', async () => {
      (mockPrisma.message.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if message is deleted', async () => {
      (mockPrisma.message.findUnique as jest.Mock).mockResolvedValue({
        ...mockMessage,
        isDeleted: true,
      });

      await expect(service.findById(mockMessage.id)).rejects.toThrow(NotFoundException);
    });
  });

  describe('editMessage', () => {
    it('should edit a message successfully', async () => {
      (mockPrisma.message.findUnique as jest.Mock).mockResolvedValue(mockMessage);
      (mockPrisma.message.update as jest.Mock).mockResolvedValue({
        ...mockMessage,
        content: 'Updated content',
        isEdited: true,
      });

      const result = await service.editMessage(mockMessage.id, mockUser.id, {
        content: 'Updated content',
      });

      expect(result.content).toBe('Updated content');
      expect(result.isEdited).toBe(true);
      expect(mockPrisma.message.update).toHaveBeenCalledWith({
        where: { id: mockMessage.id },
        data: { content: 'Updated content', isEdited: true },
        include: expect.any(Object),
      });
    });

    it('should throw ForbiddenException if user is not the sender', async () => {
      (mockPrisma.message.findUnique as jest.Mock).mockResolvedValue(mockMessage);

      await expect(
        service.editMessage(mockMessage.id, 'other-user', { content: 'Updated' })
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if message not found', async () => {
      (mockPrisma.message.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.editMessage('nonexistent', mockUser.id, { content: 'Updated' })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteMessage', () => {
    it('should soft delete a message by sender', async () => {
      (mockPrisma.message.findUnique as jest.Mock).mockResolvedValue(mockMessage);
      (mockPrisma.message.update as jest.Mock).mockResolvedValue({
        ...mockMessage,
        isDeleted: true,
      });

      await service.deleteMessage(mockMessage.id, mockUser.id);

      expect(mockPrisma.message.update).toHaveBeenCalledWith({
        where: { id: mockMessage.id },
        data: { isDeleted: true },
      });
    });

    it('should allow moderator to delete any message', async () => {
      const otherUser = 'moderator-user';
      (mockPrisma.message.findUnique as jest.Mock).mockResolvedValue(mockMessage);
      (mockPrisma.roomMember.findUnique as jest.Mock).mockResolvedValue({
        ...mockMembership,
        userId: otherUser,
        role: MemberRole.MODERATOR,
      });
      (mockPrisma.message.update as jest.Mock).mockResolvedValue({
        ...mockMessage,
        isDeleted: true,
      });

      await service.deleteMessage(mockMessage.id, otherUser);

      expect(mockPrisma.message.update).toHaveBeenCalled();
    });

    it('should allow admin to delete any message', async () => {
      const adminUser = 'admin-user';
      (mockPrisma.message.findUnique as jest.Mock).mockResolvedValue(mockMessage);
      (mockPrisma.roomMember.findUnique as jest.Mock).mockResolvedValue({
        ...mockMembership,
        userId: adminUser,
        role: MemberRole.ADMIN,
      });
      (mockPrisma.message.update as jest.Mock).mockResolvedValue({
        ...mockMessage,
        isDeleted: true,
      });

      await service.deleteMessage(mockMessage.id, adminUser);

      expect(mockPrisma.message.update).toHaveBeenCalled();
    });

    it('should allow creator to delete any message', async () => {
      const creatorUser = 'creator-user';
      (mockPrisma.message.findUnique as jest.Mock).mockResolvedValue(mockMessage);
      (mockPrisma.roomMember.findUnique as jest.Mock).mockResolvedValue({
        ...mockMembership,
        userId: creatorUser,
        role: MemberRole.CREATOR,
      });
      (mockPrisma.message.update as jest.Mock).mockResolvedValue({
        ...mockMessage,
        isDeleted: true,
      });

      await service.deleteMessage(mockMessage.id, creatorUser);

      expect(mockPrisma.message.update).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if regular member tries to delete others message', async () => {
      (mockPrisma.message.findUnique as jest.Mock).mockResolvedValue(mockMessage);
      (mockPrisma.roomMember.findUnique as jest.Mock).mockResolvedValue({
        ...mockMembership,
        userId: 'regular-user',
        role: MemberRole.MEMBER,
      });

      await expect(service.deleteMessage(mockMessage.id, 'regular-user')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should throw ForbiddenException if non-member tries to delete', async () => {
      (mockPrisma.message.findUnique as jest.Mock).mockResolvedValue(mockMessage);
      (mockPrisma.roomMember.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.deleteMessage(mockMessage.id, 'non-member')).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  describe('markAsRead', () => {
    it('should mark messages as read', async () => {
      (mockPrisma.readReceipt.upsert as jest.Mock).mockResolvedValue({
        id: 'receipt-1',
        roomId: mockRoom.id,
        userId: mockUser.id,
        lastReadMessageId: mockMessage.id,
        lastReadAt: new Date(),
      });
      (mockPrisma.roomMember.update as jest.Mock).mockResolvedValue({
        ...mockMembership,
        lastReadAt: new Date(),
      });

      await service.markAsRead(mockUser.id, {
        roomId: mockRoom.id,
        messageId: mockMessage.id,
      });

      expect(mockPrisma.readReceipt.upsert).toHaveBeenCalledWith({
        where: { roomId_userId: { roomId: mockRoom.id, userId: mockUser.id } },
        update: {
          lastReadMessageId: mockMessage.id,
          lastReadAt: expect.any(Date),
        },
        create: {
          roomId: mockRoom.id,
          userId: mockUser.id,
          lastReadMessageId: mockMessage.id,
        },
      });
      expect(mockPrisma.roomMember.update).toHaveBeenCalledWith({
        where: { roomId_userId: { roomId: mockRoom.id, userId: mockUser.id } },
        data: { lastReadAt: expect.any(Date) },
      });
    });
  });

  describe('getUnreadCount', () => {
    it('should return total count when user has not read any messages', async () => {
      (mockPrisma.readReceipt.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.message.count as jest.Mock).mockResolvedValue(25);

      const result = await service.getUnreadCount(mockUser.id, mockRoom.id);

      expect(result).toBe(25);
      expect(mockPrisma.message.count).toHaveBeenCalledWith({
        where: { roomId: mockRoom.id, isDeleted: false },
      });
    });

    it('should return unread count since last read', async () => {
      const lastReadAt = new Date('2025-01-10');
      (mockPrisma.readReceipt.findUnique as jest.Mock).mockResolvedValue({
        id: 'receipt-1',
        roomId: mockRoom.id,
        userId: mockUser.id,
        lastReadMessageId: 'last-msg',
        lastReadAt,
      });
      (mockPrisma.message.count as jest.Mock).mockResolvedValue(5);

      const result = await service.getUnreadCount(mockUser.id, mockRoom.id);

      expect(result).toBe(5);
      expect(mockPrisma.message.count).toHaveBeenCalledWith({
        where: {
          roomId: mockRoom.id,
          isDeleted: false,
          createdAt: { gt: lastReadAt },
          senderId: { not: mockUser.id },
        },
      });
    });

    it('should return 0 when no unread messages', async () => {
      (mockPrisma.readReceipt.findUnique as jest.Mock).mockResolvedValue({
        id: 'receipt-1',
        roomId: mockRoom.id,
        userId: mockUser.id,
        lastReadMessageId: 'last-msg',
        lastReadAt: new Date(),
      });
      (mockPrisma.message.count as jest.Mock).mockResolvedValue(0);

      const result = await service.getUnreadCount(mockUser.id, mockRoom.id);

      expect(result).toBe(0);
    });

    it('should exclude own messages from unread count', async () => {
      (mockPrisma.readReceipt.findUnique as jest.Mock).mockResolvedValue({
        id: 'receipt-1',
        roomId: mockRoom.id,
        userId: mockUser.id,
        lastReadMessageId: 'last-msg',
        lastReadAt: new Date('2025-01-01'),
      });
      (mockPrisma.message.count as jest.Mock).mockResolvedValue(3);

      await service.getUnreadCount(mockUser.id, mockRoom.id);

      expect(mockPrisma.message.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            senderId: { not: mockUser.id },
          }),
        })
      );
    });
  });

  describe('error handling', () => {
    it('should propagate database errors on sendMessage', async () => {
      (mockPrisma.roomMember.findUnique as jest.Mock).mockResolvedValue(mockMembership);
      (mockPrisma.message.create as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(
        service.sendMessage(mockUser.id, {
          roomId: mockRoom.id,
          content: 'Hello',
          contentType: ContentType.TEXT,
        })
      ).rejects.toThrow('Database error');
    });

    it('should propagate database errors on getMessages', async () => {
      (mockPrisma.message.findMany as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(service.getMessages({ roomId: mockRoom.id, limit: 50 })).rejects.toThrow(
        'Database error'
      );
    });

    it('should propagate database errors on editMessage', async () => {
      (mockPrisma.message.findUnique as jest.Mock).mockResolvedValue(mockMessage);
      (mockPrisma.message.update as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(
        service.editMessage(mockMessage.id, mockUser.id, { content: 'Updated' })
      ).rejects.toThrow('Database error');
    });
  });
});
