import { Test, type TestingModule } from '@nestjs/testing';
import { PresenceService } from './presence.service';
import { PrismaService } from '../../database';
import { RedisService } from '../../redis';

// Mock types for Prisma methods - extends PrismaService interface for type safety
type MockPrismaUserPresence = {
  upsert: jest.Mock;
  findFirst: jest.Mock;
  findMany: jest.Mock;
  updateMany: jest.Mock;
};

type MockPrismaRoomMember = {
  findMany: jest.Mock;
};

// Use Pick to ensure type compatibility with PrismaService
type MockPrismaService = Pick<PrismaService, '$queryRaw'> & {
  userPresence: MockPrismaUserPresence;
  roomMember: MockPrismaRoomMember;
  $queryRaw: jest.Mock;
};

describe('PresenceService', () => {
  let service: PresenceService;
  let mockPrismaService: MockPrismaService;
  let mockRedisService: jest.Mocked<
    Pick<
      RedisService,
      | 'setUserOnline'
      | 'setUserOffline'
      | 'setUserIdle'
      | 'heartbeat'
      | 'getUserPresence'
      | 'getOnlineUsers'
      | 'getOnlineUsersInRoom'
      | 'cleanupStalePresence'
      | 'getUserRooms'
      | 'setUserPresenceInRoom'
      | 'removeUserPresenceFromRoom'
      | 'getRoomPresenceList'
      | 'startDisconnectGracePeriod'
      | 'cancelDisconnectGracePeriod'
      | 'isInDisconnectGracePeriod'
    >
  >;

  const mockUserId = 'user-123';
  const mockRoomId = 'room-456';
  const mockDeviceId = 'device-789';

  beforeEach(async () => {
    mockPrismaService = {
      userPresence: {
        upsert: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      roomMember: {
        findMany: jest.fn(),
      },
      $queryRaw: jest.fn(),
    };

    mockRedisService = {
      setUserOnline: jest.fn().mockResolvedValue(undefined),
      setUserOffline: jest.fn().mockResolvedValue(undefined),
      setUserIdle: jest.fn().mockResolvedValue(undefined),
      heartbeat: jest.fn().mockResolvedValue(undefined),
      getUserPresence: jest.fn(),
      getOnlineUsers: jest.fn().mockResolvedValue([]),
      getOnlineUsersInRoom: jest.fn().mockResolvedValue([]),
      cleanupStalePresence: jest.fn().mockResolvedValue(0),
      getUserRooms: jest.fn().mockResolvedValue([]),
      setUserPresenceInRoom: jest.fn().mockResolvedValue(undefined),
      removeUserPresenceFromRoom: jest.fn().mockResolvedValue(undefined),
      getRoomPresenceList: jest.fn().mockResolvedValue([]),
      startDisconnectGracePeriod: jest.fn().mockResolvedValue(undefined),
      cancelDisconnectGracePeriod: jest.fn().mockResolvedValue(true),
      isInDisconnectGracePeriod: jest.fn().mockResolvedValue(false),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PresenceService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<PresenceService>(PresenceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('updateStatus', () => {
    it('should update user status to ONLINE in Redis and database', async () => {
      mockPrismaService.userPresence.upsert.mockResolvedValue({
        id: '1',
        userId: mockUserId,
        deviceId: 'default',
        status: 'ONLINE',
        lastSeenAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.updateStatus(mockUserId, { status: 'ONLINE' });

      expect(mockRedisService.setUserOnline).toHaveBeenCalledWith(mockUserId, {
        status: 'ONLINE',
        deviceId: 'default',
      });
      expect(mockPrismaService.userPresence.upsert).toHaveBeenCalled();
    });

    it('should update user status to OFFLINE in Redis and database', async () => {
      mockPrismaService.userPresence.upsert.mockResolvedValue({
        id: '1',
        userId: mockUserId,
        deviceId: 'default',
        status: 'OFFLINE',
        lastSeenAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.updateStatus(mockUserId, { status: 'OFFLINE' });

      expect(mockRedisService.setUserOffline).toHaveBeenCalledWith(mockUserId);
      expect(mockPrismaService.userPresence.upsert).toHaveBeenCalled();
    });

    it('should use custom deviceId when provided', async () => {
      mockPrismaService.userPresence.upsert.mockResolvedValue({
        id: '1',
        userId: mockUserId,
        deviceId: mockDeviceId,
        status: 'ONLINE',
        lastSeenAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.updateStatus(mockUserId, { status: 'ONLINE' }, mockDeviceId);

      expect(mockRedisService.setUserOnline).toHaveBeenCalledWith(mockUserId, {
        status: 'ONLINE',
        deviceId: mockDeviceId,
      });
    });
  });

  describe('heartbeat', () => {
    it('should update heartbeat in Redis and database', async () => {
      mockPrismaService.userPresence.upsert.mockResolvedValue({
        id: '1',
        userId: mockUserId,
        deviceId: 'default',
        status: 'ONLINE',
        lastSeenAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.heartbeat(mockUserId);

      expect(mockRedisService.heartbeat).toHaveBeenCalledWith(mockUserId);
      expect(mockPrismaService.userPresence.upsert).toHaveBeenCalled();
    });
  });

  describe('getPresence', () => {
    it('should return user presence from database', async () => {
      const mockPresence = {
        id: '1',
        userId: mockUserId,
        deviceId: 'default',
        status: 'ONLINE' as const,
        lastSeenAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrismaService.userPresence.findFirst.mockResolvedValue(mockPresence);

      const result = await service.getPresence(mockUserId);

      expect(result).toBeDefined();
      expect(result?.userId).toBe(mockUserId);
      expect(result?.status).toBe('ONLINE');
    });

    it('should return null when user has no presence', async () => {
      mockPrismaService.userPresence.findFirst.mockResolvedValue(null);

      const result = await service.getPresence(mockUserId);

      expect(result).toBeNull();
    });
  });

  describe('setOffline', () => {
    it('should set user offline and remove from all room presences', async () => {
      mockRedisService.getUserRooms.mockResolvedValue([mockRoomId, 'room-2']);
      mockPrismaService.userPresence.upsert.mockResolvedValue({
        id: '1',
        userId: mockUserId,
        deviceId: 'default',
        status: 'OFFLINE',
        lastSeenAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.setOffline(mockUserId);

      expect(mockRedisService.setUserOffline).toHaveBeenCalledWith(mockUserId);
      expect(mockRedisService.getUserRooms).toHaveBeenCalledWith(mockUserId);
      expect(mockRedisService.removeUserPresenceFromRoom).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.userPresence.upsert).toHaveBeenCalled();
    });
  });

  describe('setUserIdle', () => {
    it('should set user to idle status', async () => {
      mockPrismaService.userPresence.upsert.mockResolvedValue({
        id: '1',
        userId: mockUserId,
        deviceId: 'default',
        status: 'AWAY',
        lastSeenAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.setUserIdle(mockUserId);

      expect(mockRedisService.setUserIdle).toHaveBeenCalledWith(mockUserId);
      expect(mockPrismaService.userPresence.upsert).toHaveBeenCalled();
    });
  });

  describe('setUserPresenceInRoom', () => {
    it('should set user presence in room via Redis', async () => {
      await service.setUserPresenceInRoom(mockUserId, mockRoomId, 'ONLINE');

      expect(mockRedisService.setUserPresenceInRoom).toHaveBeenCalledWith(
        mockUserId,
        mockRoomId,
        'ONLINE'
      );
      expect(mockRedisService.setUserOnline).toHaveBeenCalledWith(mockUserId, { status: 'ONLINE' });
    });

    it('should not update global presence for non-ONLINE status', async () => {
      await service.setUserPresenceInRoom(mockUserId, mockRoomId, 'IDLE');

      expect(mockRedisService.setUserPresenceInRoom).toHaveBeenCalledWith(
        mockUserId,
        mockRoomId,
        'IDLE'
      );
      expect(mockRedisService.setUserOnline).not.toHaveBeenCalled();
    });
  });

  describe('getRoomPresence', () => {
    it('should return room presence with member counts for all statuses', async () => {
      mockRedisService.getRoomPresenceList.mockResolvedValue([
        { userId: 'user-1', status: 'ONLINE', lastSeenAt: Date.now() },
        { userId: 'user-2', status: 'IDLE', lastSeenAt: Date.now() },
        { userId: 'user-3', status: 'AWAY', lastSeenAt: Date.now() },
        { userId: 'user-4', status: 'BUSY', lastSeenAt: Date.now() },
        { userId: 'user-5', status: 'OFFLINE', lastSeenAt: Date.now() },
      ]);

      const result = await service.getRoomPresence(mockRoomId);

      expect(result.roomId).toBe(mockRoomId);
      expect(result.members).toHaveLength(5);
      expect(result.totalOnline).toBe(1);
      expect(result.totalIdle).toBe(1);
      expect(result.totalAway).toBe(1);
      expect(result.totalBusy).toBe(1);
      expect(result.totalOffline).toBe(1);
    });

    it('should return empty presence for room with no members', async () => {
      mockRedisService.getRoomPresenceList.mockResolvedValue([]);

      const result = await service.getRoomPresence(mockRoomId);

      expect(result.roomId).toBe(mockRoomId);
      expect(result.members).toHaveLength(0);
      expect(result.totalOnline).toBe(0);
      expect(result.totalIdle).toBe(0);
      expect(result.totalAway).toBe(0);
      expect(result.totalBusy).toBe(0);
      expect(result.totalOffline).toBe(0);
    });
  });

  describe('startDisconnectGracePeriod', () => {
    it('should start grace period via Redis', async () => {
      const result = await service.startDisconnectGracePeriod(mockUserId);

      expect(result).toBe(true);
      expect(mockRedisService.startDisconnectGracePeriod).toHaveBeenCalledWith(mockUserId, 30000);
    });
  });

  describe('cancelDisconnectGracePeriod', () => {
    it('should cancel grace period via Redis', async () => {
      mockRedisService.cancelDisconnectGracePeriod.mockResolvedValue(true);

      const result = await service.cancelDisconnectGracePeriod(mockUserId);

      expect(result).toBe(true);
      expect(mockRedisService.cancelDisconnectGracePeriod).toHaveBeenCalledWith(mockUserId);
    });

    it('should return false when no grace period exists', async () => {
      mockRedisService.cancelDisconnectGracePeriod.mockResolvedValue(false);

      const result = await service.cancelDisconnectGracePeriod(mockUserId);

      expect(result).toBe(false);
    });
  });

  describe('isInDisconnectGracePeriod', () => {
    it('should check grace period status via Redis', async () => {
      mockRedisService.isInDisconnectGracePeriod.mockResolvedValue(true);

      const result = await service.isInDisconnectGracePeriod(mockUserId);

      expect(result).toBe(true);
      expect(mockRedisService.isInDisconnectGracePeriod).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe('handleReconnection', () => {
    it('should cancel grace period and restore online status', async () => {
      mockRedisService.cancelDisconnectGracePeriod.mockResolvedValue(true);
      mockRedisService.getUserRooms.mockResolvedValue([mockRoomId]);
      mockPrismaService.userPresence.upsert.mockResolvedValue({
        id: '1',
        userId: mockUserId,
        deviceId: 'default',
        status: 'ONLINE',
        lastSeenAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.handleReconnection(mockUserId);

      expect(mockRedisService.cancelDisconnectGracePeriod).toHaveBeenCalledWith(mockUserId);
      expect(mockRedisService.setUserOnline).toHaveBeenCalled();
      expect(mockRedisService.setUserPresenceInRoom).toHaveBeenCalledWith(
        mockUserId,
        mockRoomId,
        'ONLINE'
      );
    });
  });

  describe('getLastSeen', () => {
    it('should return last seen timestamp', async () => {
      const lastSeenAt = new Date();
      mockPrismaService.userPresence.findFirst.mockResolvedValue({
        id: '1',
        userId: mockUserId,
        deviceId: 'default',
        status: 'ONLINE' as const,
        lastSeenAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.getLastSeen(mockUserId);

      expect(result).toEqual(lastSeenAt);
    });

    it('should return null when user has no presence', async () => {
      mockPrismaService.userPresence.findFirst.mockResolvedValue(null);

      const result = await service.getLastSeen(mockUserId);

      expect(result).toBeNull();
    });
  });

  describe('getRoomOnlineUsers', () => {
    it('should return online users from Redis when available', async () => {
      mockRedisService.getOnlineUsersInRoom.mockResolvedValue(['user-1', 'user-2']);

      const result = await service.getRoomOnlineUsers(mockRoomId);

      expect(result).toEqual(['user-1', 'user-2']);
      expect(mockRedisService.getOnlineUsersInRoom).toHaveBeenCalledWith(mockRoomId);
    });

    it('should fall back to database when Redis is empty', async () => {
      mockRedisService.getOnlineUsersInRoom.mockResolvedValue([]);
      mockPrismaService.roomMember.findMany.mockResolvedValue([
        { userId: 'user-1' },
        { userId: 'user-2' },
      ]);
      mockPrismaService.userPresence.findMany.mockResolvedValue([{ userId: 'user-1' }]);

      const result = await service.getRoomOnlineUsers(mockRoomId);

      expect(result).toEqual(['user-1']);
    });
  });

  describe('getMultiplePresence', () => {
    it('should return presence for multiple users', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([
        { userId: 'user-1', status: 'ONLINE', lastSeenAt: new Date() },
        { userId: 'user-2', status: 'OFFLINE', lastSeenAt: new Date() },
      ]);

      const result = await service.getMultiplePresence(['user-1', 'user-2']);

      expect(result).toHaveLength(2);
      expect(mockPrismaService.$queryRaw).toHaveBeenCalled();
    });

    it('should return empty array for empty input', async () => {
      const result = await service.getMultiplePresence([]);

      expect(result).toEqual([]);
      expect(mockPrismaService.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('cleanupStalePresences', () => {
    it('should clean up stale presences from Redis and database', async () => {
      mockRedisService.cleanupStalePresence.mockResolvedValue(5);
      mockPrismaService.userPresence.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.cleanupStalePresences();

      expect(result).toBe(3);
      expect(mockRedisService.cleanupStalePresence).toHaveBeenCalled();
      expect(mockPrismaService.userPresence.updateMany).toHaveBeenCalled();
    });
  });
});
