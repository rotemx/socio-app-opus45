import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import type { PrismaService } from '../../database';

describe('RoomsService', () => {
  let service: RoomsService;
  let mockPrismaService: jest.Mocked<
    Pick<PrismaService, 'chatRoom' | 'roomMember'>
  >;

  const mockCreator = {
    id: 'creator-1',
    username: 'creator',
    displayName: 'Room Creator',
    avatarUrl: null,
    currentLocation: {
      type: 'Point',
      coordinates: [34.78, 32.08], // Tel Aviv [lng, lat]
    },
  };

  const mockRoom = {
    id: 'room-1',
    name: 'Test Room',
    description: 'A test room',
    creatorId: 'creator-1',
    location: { type: 'Point', coordinates: [34.78, 32.08] },
    computedLocation: null,
    isActive: true,
    isPublic: true,
    maxMembers: 100,
    tags: ['test'],
    creator: mockCreator,
    _count: { members: 3 },
  };

  const mockMembers = [
    {
      userId: 'creator-1',
      joinLocation: { type: 'Point', coordinates: [34.78, 32.08] },
      activityWeight: 1.5,
      user: { currentLocation: { type: 'Point', coordinates: [34.78, 32.08] } },
    },
    {
      userId: 'member-1',
      joinLocation: { type: 'Point', coordinates: [34.79, 32.09] },
      activityWeight: 1.0,
      user: { currentLocation: { type: 'Point', coordinates: [34.79, 32.09] } },
    },
    {
      userId: 'member-2',
      joinLocation: { type: 'Point', coordinates: [34.77, 32.07] },
      activityWeight: 0.5,
      user: { currentLocation: null },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    mockPrismaService = {
      chatRoom: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      } as unknown as jest.Mocked<PrismaService['chatRoom']>,
      roomMember: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      } as unknown as jest.Mocked<PrismaService['roomMember']>,
    };

    service = new RoomsService(mockPrismaService as unknown as PrismaService);
  });

  describe('calculateRoomLocation', () => {
    it('should calculate weighted centroid with creator and members', async () => {
      const roomWithMembers = {
        ...mockRoom,
        members: mockMembers,
      };
      (mockPrismaService.chatRoom.findUnique as jest.Mock).mockResolvedValue(roomWithMembers);
      (mockPrismaService.chatRoom.update as jest.Mock).mockResolvedValue({});

      const result = await service.calculateRoomLocation('room-1');

      expect(result).not.toBeNull();
      expect(result?.type).toBe('Point');
      expect(result?.coordinates).toHaveLength(2);
      // Verify coordinates are within valid range
      expect(result?.coordinates[0]).toBeGreaterThanOrEqual(-180);
      expect(result?.coordinates[0]).toBeLessThanOrEqual(180);
      expect(result?.coordinates[1]).toBeGreaterThanOrEqual(-90);
      expect(result?.coordinates[1]).toBeLessThanOrEqual(90);
      expect(mockPrismaService.chatRoom.update).toHaveBeenCalledWith({
        where: { id: 'room-1' },
        data: { computedLocation: result },
      });
    });

    it('should apply 40% weight to creator and 60% to members', async () => {
      // Simplified test with only creator location at [0, 0] and one member at [10, 10]
      const simpleRoom = {
        ...mockRoom,
        creator: {
          ...mockCreator,
          currentLocation: { type: 'Point', coordinates: [0, 0] },
        },
        members: [
          {
            userId: 'member-1',
            joinLocation: null,
            activityWeight: 1.0,
            user: { currentLocation: { type: 'Point', coordinates: [10, 10] } },
          },
        ],
      };
      (mockPrismaService.chatRoom.findUnique as jest.Mock).mockResolvedValue(simpleRoom);
      (mockPrismaService.chatRoom.update as jest.Mock).mockResolvedValue({});

      const result = await service.calculateRoomLocation('room-1');

      // With 40% creator weight at [0,0] and 60% member weight at [10,10]:
      // Expected: [0.4*0 + 0.6*10, 0.4*0 + 0.6*10] = [6, 6]
      expect(result?.coordinates[0]).toBeCloseTo(6, 1);
      expect(result?.coordinates[1]).toBeCloseTo(6, 1);
    });

    it('should use activity weights for member distribution', async () => {
      // Two members with different activity weights
      const roomWithWeightedMembers = {
        ...mockRoom,
        creator: {
          ...mockCreator,
          currentLocation: null, // No creator location
        },
        members: [
          {
            userId: 'member-1',
            joinLocation: { type: 'Point', coordinates: [0, 0] },
            activityWeight: 2.0, // High activity
            user: { currentLocation: null },
          },
          {
            userId: 'member-2',
            joinLocation: { type: 'Point', coordinates: [10, 10] },
            activityWeight: 1.0, // Normal activity
            user: { currentLocation: null },
          },
        ],
      };
      (mockPrismaService.chatRoom.findUnique as jest.Mock).mockResolvedValue(
        roomWithWeightedMembers
      );
      (mockPrismaService.chatRoom.update as jest.Mock).mockResolvedValue({});

      const result = await service.calculateRoomLocation('room-1');

      // Member 1 has 2x the weight of member 2
      // Total activity: 3.0, Member 1: 2/3 of 60% = 40%, Member 2: 1/3 of 60% = 20%
      // Expected: [0.4*0 + 0.2*10, 0.4*0 + 0.2*10] = [2/0.6, 2/0.6] ≈ [3.33, 3.33]
      expect(result?.coordinates[0]).toBeCloseTo(3.33, 1);
      expect(result?.coordinates[1]).toBeCloseTo(3.33, 1);
    });

    it('should return null for non-existent room', async () => {
      (mockPrismaService.chatRoom.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.calculateRoomLocation('invalid-room');

      expect(result).toBeNull();
      expect(mockPrismaService.chatRoom.update).not.toHaveBeenCalled();
    });

    it('should return null when no valid locations exist', async () => {
      const roomWithNoLocations = {
        ...mockRoom,
        creator: { ...mockCreator, currentLocation: null },
        members: [
          {
            userId: 'member-1',
            joinLocation: null,
            activityWeight: 1.0,
            user: { currentLocation: null },
          },
        ],
      };
      (mockPrismaService.chatRoom.findUnique as jest.Mock).mockResolvedValue(roomWithNoLocations);

      const result = await service.calculateRoomLocation('room-1');

      expect(result).toBeNull();
      expect(mockPrismaService.chatRoom.update).not.toHaveBeenCalled();
    });

    it('should prefer current location over join location', async () => {
      const roomWithBothLocations = {
        ...mockRoom,
        creator: { ...mockCreator, currentLocation: null },
        members: [
          {
            userId: 'member-1',
            joinLocation: { type: 'Point', coordinates: [0, 0] }, // Old location
            activityWeight: 1.0,
            user: { currentLocation: { type: 'Point', coordinates: [10, 10] } }, // Current location
          },
        ],
      };
      (mockPrismaService.chatRoom.findUnique as jest.Mock).mockResolvedValue(
        roomWithBothLocations
      );
      (mockPrismaService.chatRoom.update as jest.Mock).mockResolvedValue({});

      const result = await service.calculateRoomLocation('room-1');

      // Should use current location [10, 10] not join location [0, 0]
      expect(result?.coordinates[0]).toBeCloseTo(10, 1);
      expect(result?.coordinates[1]).toBeCloseTo(10, 1);
    });

    it('should handle simple lat/lng format', async () => {
      const roomWithSimpleFormat = {
        ...mockRoom,
        creator: {
          ...mockCreator,
          currentLocation: { lat: 32.08, lng: 34.78 }, // Simple format
        },
        members: [],
      };
      (mockPrismaService.chatRoom.findUnique as jest.Mock).mockResolvedValue(roomWithSimpleFormat);
      (mockPrismaService.chatRoom.update as jest.Mock).mockResolvedValue({});

      const result = await service.calculateRoomLocation('room-1');

      expect(result?.coordinates[0]).toBeCloseTo(34.78, 2);
      expect(result?.coordinates[1]).toBeCloseTo(32.08, 2);
    });

    it('should reject invalid coordinates', async () => {
      const roomWithInvalidCoords = {
        ...mockRoom,
        creator: {
          ...mockCreator,
          currentLocation: { type: 'Point', coordinates: [200, 100] }, // Invalid
        },
        members: [],
      };
      (mockPrismaService.chatRoom.findUnique as jest.Mock).mockResolvedValue(roomWithInvalidCoords);

      const result = await service.calculateRoomLocation('room-1');

      expect(result).toBeNull();
    });
  });

  describe('recalculateAllRoomLocations', () => {
    it('should recalculate locations for all active rooms', async () => {
      const activeRooms = [{ id: 'room-1' }, { id: 'room-2' }, { id: 'room-3' }];
      (mockPrismaService.chatRoom.findMany as jest.Mock).mockResolvedValue(activeRooms);
      (mockPrismaService.chatRoom.findUnique as jest.Mock).mockResolvedValue({
        ...mockRoom,
        members: mockMembers,
      });
      (mockPrismaService.chatRoom.update as jest.Mock).mockResolvedValue({});

      await service.recalculateAllRoomLocations();

      expect(mockPrismaService.chatRoom.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        select: { id: true },
      });
      // Should have been called 3 times (once for each room)
      expect(mockPrismaService.chatRoom.findUnique).toHaveBeenCalledTimes(3);
    });

    it('should continue on error for individual room', async () => {
      const activeRooms = [{ id: 'room-1' }, { id: 'room-2' }];
      (mockPrismaService.chatRoom.findMany as jest.Mock).mockResolvedValue(activeRooms);
      (mockPrismaService.chatRoom.findUnique as jest.Mock)
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValueOnce({ ...mockRoom, members: mockMembers });
      (mockPrismaService.chatRoom.update as jest.Mock).mockResolvedValue({});

      // Should not throw
      await expect(service.recalculateAllRoomLocations()).resolves.not.toThrow();

      // Should have attempted both rooms
      expect(mockPrismaService.chatRoom.findUnique).toHaveBeenCalledTimes(2);
    });
  });

  describe('joinRoom triggers recalculation', () => {
    it('should trigger location recalculation after member joins', async () => {
      const room = { ...mockRoom, _count: { members: 5 } };
      (mockPrismaService.chatRoom.findUnique as jest.Mock)
        .mockResolvedValueOnce(room) // For findById
        .mockResolvedValueOnce({ ...room, members: mockMembers }); // For calculateRoomLocation
      (mockPrismaService.roomMember.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrismaService.roomMember.count as jest.Mock).mockResolvedValue(5);
      (mockPrismaService.roomMember.create as jest.Mock).mockResolvedValue({
        id: 'member-id',
        roomId: 'room-1',
        userId: 'new-user',
      });
      (mockPrismaService.chatRoom.update as jest.Mock).mockResolvedValue({});

      await service.joinRoom('room-1', 'new-user', { lat: 32.08, lng: 34.78 });

      // Wait for async recalculation
      await new Promise((resolve) => process.nextTick(resolve));

      expect(mockPrismaService.roomMember.create).toHaveBeenCalled();
    });
  });

  describe('leaveRoom triggers recalculation', () => {
    it('should trigger location recalculation after member leaves', async () => {
      (mockPrismaService.roomMember.findUnique as jest.Mock).mockResolvedValue({
        roomId: 'room-1',
        userId: 'member-1',
        role: 'MEMBER',
      });
      (mockPrismaService.roomMember.delete as jest.Mock).mockResolvedValue({});
      (mockPrismaService.chatRoom.findUnique as jest.Mock).mockResolvedValue({
        ...mockRoom,
        members: mockMembers,
      });
      (mockPrismaService.chatRoom.update as jest.Mock).mockResolvedValue({});

      await service.leaveRoom('room-1', 'member-1');

      // Wait for async recalculation
      await new Promise((resolve) => process.nextTick(resolve));

      expect(mockPrismaService.roomMember.delete).toHaveBeenCalled();
    });

    it('should prevent creator from leaving', async () => {
      (mockPrismaService.roomMember.findUnique as jest.Mock).mockResolvedValue({
        roomId: 'room-1',
        userId: 'creator-1',
        role: 'CREATOR',
      });

      await expect(service.leaveRoom('room-1', 'creator-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findById', () => {
    it('should return room with creator info', async () => {
      (mockPrismaService.chatRoom.findUnique as jest.Mock).mockResolvedValue(mockRoom);

      const result = await service.findById('room-1');

      expect(result).toEqual(mockRoom);
      expect(mockPrismaService.chatRoom.findUnique).toHaveBeenCalledWith({
        where: { id: 'room-1' },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException for non-existent room', async () => {
      (mockPrismaService.chatRoom.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findById('invalid')).rejects.toThrow(NotFoundException);
    });
  });
});
