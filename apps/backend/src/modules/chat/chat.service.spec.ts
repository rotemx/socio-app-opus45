import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ChatService } from './chat.service';
import type { PrismaService } from '../../database';
import type { PresenceService } from '../presence/presence.service';

describe('ChatService', () => {
  let service: ChatService;
  let mockPrismaService: jest.Mocked<
    Pick<PrismaService, 'chatRoom' | 'roomMember' | 'message' | 'readReceipt' | 'user'>
  >;
  let mockPresenceService: jest.Mocked<Pick<PresenceService, 'getRoomOnlineUsers' | 'setOffline'>>;

  const mockRoom = {
    id: 'room-1',
    name: 'Test Room',
    isActive: true,
    isPublic: true,
    maxMembers: 100,
    _count: { members: 5 },
  };

  const mockMembership = {
    roomId: 'room-1',
    userId: 'user-1',
    role: 'MEMBER',
    isMuted: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockPrismaService = {
      chatRoom: {
        findUnique: jest.fn(),
        update: jest.fn(),
      } as unknown as jest.Mocked<PrismaService['chatRoom']>,
      roomMember: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      } as unknown as jest.Mocked<PrismaService['roomMember']>,
      message: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      } as unknown as jest.Mocked<PrismaService['message']>,
      readReceipt: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      } as unknown as jest.Mocked<PrismaService['readReceipt']>,
      user: {
        findUnique: jest.fn(),
      } as unknown as jest.Mocked<PrismaService['user']>,
    };

    mockPresenceService = {
      getRoomOnlineUsers: jest.fn(),
      setOffline: jest.fn(),
    };

    service = new ChatService(
      mockPrismaService as unknown as PrismaService,
      mockPresenceService as unknown as PresenceService
    );
  });

  describe('validateRoomAccess', () => {
    it('should return room info for existing member', async () => {
      (mockPrismaService.chatRoom.findUnique as jest.Mock).mockResolvedValue(mockRoom);
      (mockPrismaService.roomMember.findUnique as jest.Mock).mockResolvedValue(mockMembership);

      const result = await service.validateRoomAccess('user-1', 'room-1');

      expect(result).toEqual({
        id: 'room-1',
        name: 'Test Room',
        memberCount: 5,
        isMember: true,
      });
    });

    it('should auto-join public room for non-member', async () => {
      (mockPrismaService.chatRoom.findUnique as jest.Mock).mockResolvedValue(mockRoom);
      (mockPrismaService.roomMember.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrismaService.roomMember.create as jest.Mock).mockResolvedValue({});

      const result = await service.validateRoomAccess('user-2', 'room-1');

      expect(mockPrismaService.roomMember.create).toHaveBeenCalled();
      expect(result.isMember).toBe(false);
    });

    it('should throw NotFoundException for non-existent room', async () => {
      (mockPrismaService.chatRoom.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.validateRoomAccess('user-1', 'invalid-room')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw ForbiddenException for inactive room', async () => {
      (mockPrismaService.chatRoom.findUnique as jest.Mock).mockResolvedValue({
        ...mockRoom,
        isActive: false,
      });

      await expect(service.validateRoomAccess('user-1', 'room-1')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should throw ForbiddenException for private room non-member', async () => {
      (mockPrismaService.chatRoom.findUnique as jest.Mock).mockResolvedValue({
        ...mockRoom,
        isPublic: false,
      });
      (mockPrismaService.roomMember.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.validateRoomAccess('user-2', 'room-1')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should throw ForbiddenException when room is full', async () => {
      (mockPrismaService.chatRoom.findUnique as jest.Mock).mockResolvedValue({
        ...mockRoom,
        maxMembers: 5,
      });
      (mockPrismaService.roomMember.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.validateRoomAccess('user-2', 'room-1')).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  describe('getOnlineUsersInRoom', () => {
    it('should return online user IDs', async () => {
      mockPresenceService.getRoomOnlineUsers.mockResolvedValue(['user-1', 'user-2']);

      const result = await service.getOnlineUsersInRoom('room-1');

      expect(result).toEqual(['user-1', 'user-2']);
      expect(mockPresenceService.getRoomOnlineUsers).toHaveBeenCalledWith('room-1');
    });
  });

  describe('sendMessage', () => {
    const savedMessage = {
      id: 'msg-1',
      roomId: 'room-1',
      senderId: 'user-1',
      content: 'Hello!',
      replyToId: null,
      createdAt: new Date(),
    };

    it('should save and return message', async () => {
      (mockPrismaService.roomMember.findUnique as jest.Mock).mockResolvedValue(mockMembership);
      (mockPrismaService.message.create as jest.Mock).mockResolvedValue(savedMessage);
      (mockPrismaService.chatRoom.update as jest.Mock).mockResolvedValue({});
      (mockPrismaService.roomMember.update as jest.Mock).mockResolvedValue({});

      const result = await service.sendMessage('user-1', 'room-1', 'Hello!');

      expect(result).toEqual(savedMessage);
      expect(mockPrismaService.message.create).toHaveBeenCalledWith({
        data: {
          roomId: 'room-1',
          senderId: 'user-1',
          content: 'Hello!',
          replyToId: undefined,
        },
      });
    });

    it('should throw ForbiddenException for non-member', async () => {
      (mockPrismaService.roomMember.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.sendMessage('user-2', 'room-1', 'Hello!')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should throw ForbiddenException for muted user', async () => {
      (mockPrismaService.roomMember.findUnique as jest.Mock).mockResolvedValue({
        ...mockMembership,
        isMuted: true,
      });

      await expect(service.sendMessage('user-1', 'room-1', 'Hello!')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should validate reply target', async () => {
      (mockPrismaService.roomMember.findUnique as jest.Mock).mockResolvedValue(mockMembership);
      (mockPrismaService.message.findUnique as jest.Mock).mockResolvedValue({
        roomId: 'other-room',
      });

      await expect(service.sendMessage('user-1', 'room-1', 'Reply', 'msg-other')).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  describe('setUserOffline', () => {
    it('should call presence service', async () => {
      mockPresenceService.setOffline.mockResolvedValue();

      await service.setUserOffline('user-1');

      expect(mockPresenceService.setOffline).toHaveBeenCalledWith('user-1');
    });
  });

  describe('markAsRead', () => {
    it('should update lastReadAt', async () => {
      (mockPrismaService.roomMember.update as jest.Mock).mockResolvedValue({});

      await service.markAsRead('user-1', 'room-1');

      expect(mockPrismaService.roomMember.update).toHaveBeenCalledWith({
        where: { roomId_userId: { roomId: 'room-1', userId: 'user-1' } },
        data: { lastReadAt: expect.any(Date) },
      });
    });
  });

  describe('deleteMessage', () => {
    it('should soft delete message by sender', async () => {
      (mockPrismaService.message.findUnique as jest.Mock).mockResolvedValue({
        id: 'msg-1',
        senderId: 'user-1',
        room: { members: [] },
      });
      (mockPrismaService.message.update as jest.Mock).mockResolvedValue({});

      await service.deleteMessage('msg-1', 'user-1');

      expect(mockPrismaService.message.update).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
        data: { isDeleted: true },
      });
    });

    it('should allow moderator to delete', async () => {
      (mockPrismaService.message.findUnique as jest.Mock).mockResolvedValue({
        id: 'msg-1',
        senderId: 'user-2',
        room: { members: [{ role: 'MODERATOR' }] },
      });
      (mockPrismaService.message.update as jest.Mock).mockResolvedValue({});

      await service.deleteMessage('msg-1', 'user-1');

      expect(mockPrismaService.message.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent message', async () => {
      (mockPrismaService.message.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.deleteMessage('invalid-msg', 'user-1')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw ForbiddenException for unauthorized user', async () => {
      (mockPrismaService.message.findUnique as jest.Mock).mockResolvedValue({
        id: 'msg-1',
        senderId: 'user-2',
        room: { members: [{ role: 'MEMBER' }] },
      });

      await expect(service.deleteMessage('msg-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('markMessageAsRead', () => {
    it('should mark message as read and return sender info', async () => {
      (mockPrismaService.roomMember.findUnique as jest.Mock).mockResolvedValue(mockMembership);
      (mockPrismaService.message.findUnique as jest.Mock).mockResolvedValue({
        id: 'msg-1',
        roomId: 'room-1',
        senderId: 'user-2',
      });
      (mockPrismaService.readReceipt.upsert as jest.Mock).mockResolvedValue({});
      (mockPrismaService.roomMember.update as jest.Mock).mockResolvedValue({});

      const result = await service.markMessageAsRead('user-1', 'room-1', 'msg-1');

      expect(mockPrismaService.readReceipt.upsert).toHaveBeenCalled();
      expect(mockPrismaService.roomMember.update).toHaveBeenCalled();
      expect(result.senderId).toBe('user-2');
      expect(result.readAt).toBeInstanceOf(Date);
    });

    it('should not create read receipt for own message', async () => {
      (mockPrismaService.roomMember.findUnique as jest.Mock).mockResolvedValue(mockMembership);
      (mockPrismaService.message.findUnique as jest.Mock).mockResolvedValue({
        id: 'msg-1',
        roomId: 'room-1',
        senderId: 'user-1', // Same as reader
      });

      const result = await service.markMessageAsRead('user-1', 'room-1', 'msg-1');

      expect(mockPrismaService.readReceipt.upsert).not.toHaveBeenCalled();
      expect(result.senderId).toBe('user-1');
    });

    it('should throw ForbiddenException for non-member', async () => {
      (mockPrismaService.roomMember.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.markMessageAsRead('user-1', 'room-1', 'msg-1')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should throw NotFoundException for non-existent message', async () => {
      (mockPrismaService.roomMember.findUnique as jest.Mock).mockResolvedValue(mockMembership);
      (mockPrismaService.message.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.markMessageAsRead('user-1', 'room-1', 'msg-1')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw ForbiddenException when message is in different room', async () => {
      (mockPrismaService.roomMember.findUnique as jest.Mock).mockResolvedValue(mockMembership);
      (mockPrismaService.message.findUnique as jest.Mock).mockResolvedValue({
        id: 'msg-1',
        roomId: 'room-2', // Different room
        senderId: 'user-2',
      });

      await expect(service.markMessageAsRead('user-1', 'room-1', 'msg-1')).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  describe('getReadReceipts', () => {
    const mockMessage = {
      id: 'msg-1',
      roomId: 'room-1',
      createdAt: new Date('2025-01-01'),
      senderId: 'user-1',
    };

    it('should return list of readers with read receipts enabled', async () => {
      (mockPrismaService.roomMember.findUnique as jest.Mock).mockResolvedValue(mockMembership);
      (mockPrismaService.message.findUnique as jest.Mock).mockResolvedValue(mockMessage);
      (mockPrismaService.readReceipt.findMany as jest.Mock).mockResolvedValue([
        {
          userId: 'user-2',
          lastReadAt: new Date('2025-01-02'),
          user: { id: 'user-2', username: 'reader1', settings: { readReceiptsEnabled: true } },
        },
      ]);

      const result = await service.getReadReceipts('user-1', 'room-1', 'msg-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        userId: 'user-2',
        username: 'reader1',
        readAt: expect.any(Date),
      });
    });

    it('should include users with missing readReceiptsEnabled setting (defaults to true)', async () => {
      (mockPrismaService.roomMember.findUnique as jest.Mock).mockResolvedValue(mockMembership);
      (mockPrismaService.message.findUnique as jest.Mock).mockResolvedValue(mockMessage);
      (mockPrismaService.readReceipt.findMany as jest.Mock).mockResolvedValue([
        {
          userId: 'user-2',
          lastReadAt: new Date('2025-01-02'),
          // Simulates existing user without readReceiptsEnabled in their settings
          user: { id: 'user-2', username: 'reader1', settings: {} },
        },
      ]);

      const result = await service.getReadReceipts('user-1', 'room-1', 'msg-1');

      expect(result).toHaveLength(1);
      expect(result[0]?.userId).toBe('user-2');
    });

    it('should filter out users with read receipts disabled', async () => {
      (mockPrismaService.roomMember.findUnique as jest.Mock).mockResolvedValue(mockMembership);
      (mockPrismaService.message.findUnique as jest.Mock).mockResolvedValue(mockMessage);
      (mockPrismaService.readReceipt.findMany as jest.Mock).mockResolvedValue([
        {
          userId: 'user-2',
          lastReadAt: new Date('2025-01-02'),
          user: { id: 'user-2', username: 'reader1', settings: { readReceiptsEnabled: false } },
        },
      ]);

      const result = await service.getReadReceipts('user-1', 'room-1', 'msg-1');

      expect(result).toHaveLength(0);
    });

    it('should throw ForbiddenException for non-member', async () => {
      (mockPrismaService.roomMember.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getReadReceipts('user-1', 'room-1', 'msg-1')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should throw NotFoundException for non-existent message', async () => {
      (mockPrismaService.roomMember.findUnique as jest.Mock).mockResolvedValue(mockMembership);
      (mockPrismaService.message.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getReadReceipts('user-1', 'room-1', 'msg-1')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw ForbiddenException when message is in different room', async () => {
      (mockPrismaService.roomMember.findUnique as jest.Mock).mockResolvedValue(mockMembership);
      (mockPrismaService.message.findUnique as jest.Mock).mockResolvedValue({
        ...mockMessage,
        roomId: 'room-2',
      });

      await expect(service.getReadReceipts('user-1', 'room-1', 'msg-1')).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  describe('checkUserReadReceiptsEnabled', () => {
    it('should return true when read receipts are enabled', async () => {
      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue({
        settings: { readReceiptsEnabled: true },
      });

      const result = await service.checkUserReadReceiptsEnabled('user-1');

      expect(result).toBe(true);
    });

    it('should return true when setting is not set (default)', async () => {
      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue({
        settings: {},
      });

      const result = await service.checkUserReadReceiptsEnabled('user-1');

      expect(result).toBe(true);
    });

    it('should return false when read receipts are disabled', async () => {
      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue({
        settings: { readReceiptsEnabled: false },
      });

      const result = await service.checkUserReadReceiptsEnabled('user-1');

      expect(result).toBe(false);
    });

    it('should return false for non-existent user', async () => {
      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.checkUserReadReceiptsEnabled('user-1');

      expect(result).toBe(false);
    });
  });
});
