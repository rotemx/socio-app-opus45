import { WsException } from '@nestjs/websockets';
import type Redis from 'ioredis';
import { ChatGateway } from './chat.gateway';
import type { ChatService } from './chat.service';
import type { AuthService } from '../auth';
import type { PresenceService } from '../presence/presence.service';
import type { RedisService } from '../../redis';
import type { Server, Socket } from 'socket.io';

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let mockChatService: jest.Mocked<
    Pick<
      ChatService,
      'validateRoomAccess' | 'getOnlineUsersInRoom' | 'sendMessage' | 'setUserOffline'
    >
  >;
  let mockAuthService: jest.Mocked<Pick<AuthService, 'verifyAccessToken' | 'validateUser'>>;
  let mockPresenceService: jest.Mocked<
    Pick<
      PresenceService,
      | 'handleReconnection'
      | 'setUserPresenceInRoom'
      | 'getRoomPresence'
      | 'startDisconnectGracePeriod'
      | 'setOffline'
    >
  >;
  let mockRedisService: jest.Mocked<
    Pick<
      RedisService,
      | 'setUserOnline'
      | 'setUserOffline'
      | 'heartbeat'
      | 'addUserToRoom'
      | 'removeUserFromRoom'
      | 'removeUserPresenceFromRoom'
      | 'getOnlineUsersInRoom'
      | 'getUserRooms'
      | 'subscribe'
    >
  >;
  let mockPubClient: jest.Mocked<Partial<Redis>>;
  let mockSubClient: jest.Mocked<Partial<Redis>>;
  let mockServer: Partial<Server>;
  let mockSocket: Partial<Socket>;

  const mockUser = {
    sub: 'user-123',
    type: 'access' as const,
    email: 'test@example.com',
    username: 'testuser',
    roles: ['user'],
    deviceId: 'device-1',
    sessionId: 'session-1',
    iat: Date.now(),
    exp: Date.now() + 900000,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockChatService = {
      validateRoomAccess: jest.fn(),
      getOnlineUsersInRoom: jest.fn(),
      sendMessage: jest.fn(),
      setUserOffline: jest.fn(),
    };

    mockAuthService = {
      verifyAccessToken: jest.fn(),
      validateUser: jest.fn().mockResolvedValue({ id: 'user-123', isActive: true }),
    };

    mockPresenceService = {
      handleReconnection: jest.fn().mockResolvedValue(undefined),
      setUserPresenceInRoom: jest.fn().mockResolvedValue(undefined),
      getRoomPresence: jest.fn().mockResolvedValue({
        roomId: 'room-123',
        members: [],
        totalOnline: 0,
        totalIdle: 0,
        totalAway: 0,
        totalBusy: 0,
        totalOffline: 0,
      }),
      startDisconnectGracePeriod: jest.fn().mockResolvedValue(true),
      setOffline: jest.fn().mockResolvedValue(undefined),
    };

    mockRedisService = {
      setUserOnline: jest.fn().mockResolvedValue(undefined),
      setUserOffline: jest.fn().mockResolvedValue(undefined),
      heartbeat: jest.fn().mockResolvedValue(undefined),
      addUserToRoom: jest.fn().mockResolvedValue(undefined),
      removeUserFromRoom: jest.fn().mockResolvedValue(undefined),
      removeUserPresenceFromRoom: jest.fn().mockResolvedValue(undefined),
      getOnlineUsersInRoom: jest.fn().mockResolvedValue([]),
      getUserRooms: jest.fn().mockResolvedValue([]),
      subscribe: jest.fn().mockResolvedValue(undefined),
    };

    mockPubClient = {
      status: 'ready',
    };

    mockSubClient = {
      status: 'ready',
    };

    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      adapter: jest.fn(),
      sockets: {
        adapter: {
          rooms: new Map(),
        },
      } as unknown as Server['sockets'],
    };

    mockSocket = {
      id: 'socket-123',
      data: {},
      handshake: {
        auth: { token: 'valid-token' },
        headers: {},
      } as unknown as Socket['handshake'],
      join: jest.fn(),
      leave: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      disconnect: jest.fn(),
    };

    gateway = new ChatGateway(
      mockChatService as unknown as ChatService,
      mockAuthService as unknown as AuthService,
      mockPresenceService as unknown as PresenceService,
      mockRedisService as unknown as RedisService,
      mockPubClient as Redis,
      mockSubClient as Redis
    );
    gateway.server = mockServer as Server;
  });

  describe('afterInit', () => {
    it('should log initialization', () => {
      expect(() => gateway.afterInit(mockServer as Server)).not.toThrow();
    });
  });

  describe('handleConnection', () => {
    it('should authenticate and connect user with valid token', async () => {
      mockAuthService.verifyAccessToken.mockResolvedValue(mockUser);

      await gateway.handleConnection(mockSocket as Socket);

      expect(mockAuthService.verifyAccessToken).toHaveBeenCalledWith('valid-token');
      expect(mockSocket.data?.user).toEqual(mockUser);
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'connection:success',
        expect.objectContaining({
          userId: mockUser.sub,
          username: mockUser.username,
        })
      );
    });

    it('should disconnect client without token', async () => {
      const noTokenSocket = {
        ...mockSocket,
        handshake: {
          auth: {},
          headers: {},
        } as unknown as Socket['handshake'],
      };

      await gateway.handleConnection(noTokenSocket as Socket);

      expect(noTokenSocket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          code: 'UNAUTHORIZED',
        })
      );
      expect(noTokenSocket.disconnect).toHaveBeenCalledWith(true);
    });

    it('should disconnect client with invalid token', async () => {
      mockAuthService.verifyAccessToken.mockRejectedValue(new Error('Invalid token'));

      await gateway.handleConnection(mockSocket as Socket);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          code: 'UNAUTHORIZED',
        })
      );
      expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
    });

    it('should extract token from Authorization header', async () => {
      const headerSocket = {
        ...mockSocket,
        handshake: {
          auth: {},
          headers: { authorization: 'Bearer header-token' },
        } as unknown as Socket['handshake'],
      };
      mockAuthService.verifyAccessToken.mockResolvedValue(mockUser);

      await gateway.handleConnection(headerSocket as Socket);

      expect(mockAuthService.verifyAccessToken).toHaveBeenCalledWith('header-token');
    });
  });

  describe('handleDisconnect', () => {
    it('should handle authenticated user disconnect', () => {
      mockSocket.data = { user: mockUser, rooms: new Set(['room-1']) };

      gateway.handleDisconnect(mockSocket as Socket);

      // Gateway leaves all rooms for this socket
      expect(mockSocket.leave).toHaveBeenCalledWith('room-1');
    });

    it('should handle anonymous client disconnect', () => {
      mockSocket.data = {};

      expect(() => gateway.handleDisconnect(mockSocket as Socket)).not.toThrow();
    });
  });

  describe('handleJoinRoom', () => {
    beforeEach(() => {
      mockSocket.data = { user: mockUser, rooms: new Set() };
    });

    it('should join room successfully', async () => {
      mockChatService.validateRoomAccess.mockResolvedValue({
        id: 'room-1',
        name: 'Test Room',
        memberCount: 5,
        isMember: true,
      });
      mockPresenceService.getRoomPresence.mockResolvedValue({
        roomId: 'room-1',
        members: [
          { userId: 'user-1', status: 'ONLINE', lastSeenAt: Date.now() },
          { userId: 'user-2', status: 'BUSY', lastSeenAt: Date.now() },
        ],
        totalOnline: 1,
        totalIdle: 0,
        totalAway: 0,
        totalBusy: 1,
        totalOffline: 0,
      });

      const result = await gateway.handleJoinRoom(mockSocket as Socket, { roomId: 'room-1' });

      expect(mockSocket.join).toHaveBeenCalledWith('room-1');
      expect(mockSocket.to).toHaveBeenCalledWith('room-1');
      expect(mockRedisService.addUserToRoom).toHaveBeenCalledWith(mockUser.sub, 'room-1');
      expect(mockPresenceService.setUserPresenceInRoom).toHaveBeenCalledWith(
        mockUser.sub,
        'room-1',
        'ONLINE'
      );
      expect(result).toEqual({
        roomId: 'room-1',
        roomName: 'Test Room',
        memberCount: 5,
        onlineUsers: ['user-1', 'user-2'],
      });
    });

    it('should throw WsException when room access fails', async () => {
      mockChatService.validateRoomAccess.mockRejectedValue(new Error('Room not found'));

      await expect(
        gateway.handleJoinRoom(mockSocket as Socket, { roomId: 'invalid-room' })
      ).rejects.toThrow(WsException);
    });
  });

  describe('handleLeaveRoom', () => {
    beforeEach(() => {
      mockSocket.data = { user: mockUser, rooms: new Set(['room-1']) };
    });

    it('should leave room successfully', async () => {
      const result = await gateway.handleLeaveRoom(mockSocket as Socket, { roomId: 'room-1' });

      expect(mockSocket.leave).toHaveBeenCalledWith('room-1');
      expect(mockSocket.to).toHaveBeenCalledWith('room-1');
      expect(mockRedisService.removeUserFromRoom).toHaveBeenCalledWith(mockUser.sub, 'room-1');
      expect(result).toEqual({ roomId: 'room-1', success: true });
    });
  });

  describe('handleMessage', () => {
    beforeEach(() => {
      mockSocket.data = { user: mockUser, rooms: new Set(['room-1']) };
    });

    it('should send message successfully', async () => {
      const savedMessage = {
        id: 'msg-1',
        roomId: 'room-1',
        senderId: mockUser.sub,
        content: 'Hello!',
        replyToId: null,
        createdAt: new Date(),
      };
      mockChatService.sendMessage.mockResolvedValue(savedMessage);

      const result = await gateway.handleMessage(mockSocket as Socket, {
        roomId: 'room-1',
        content: 'Hello!',
      });

      expect(mockChatService.sendMessage).toHaveBeenCalledWith(
        mockUser.sub,
        'room-1',
        'Hello!',
        undefined
      );
      expect(mockServer.to).toHaveBeenCalledWith('room-1');
      expect(result.id).toBe('msg-1');
      expect(result.senderName).toBe(mockUser.username);
    });

    it('should throw WsException when send fails', async () => {
      mockChatService.sendMessage.mockRejectedValue(new Error('Not a member'));

      await expect(
        gateway.handleMessage(mockSocket as Socket, {
          roomId: 'room-1',
          content: 'Hello!',
        })
      ).rejects.toThrow(WsException);
    });
  });

  describe('handleTyping', () => {
    it('should broadcast typing event', () => {
      mockSocket.data = { user: mockUser, rooms: new Set(['room-1']) };

      gateway.handleTyping(mockSocket as Socket, { roomId: 'room-1', isTyping: true });

      expect(mockSocket.to).toHaveBeenCalledWith('room-1');
    });
  });

  describe('handleHeartbeat', () => {
    it('should update heartbeat timestamp', async () => {
      mockSocket.data = { user: mockUser, lastHeartbeat: 0 };

      const result = await gateway.handleHeartbeat(mockSocket as Socket);

      expect(result.timestamp).toBeGreaterThan(0);
      expect(mockSocket.data.lastHeartbeat).toBeGreaterThan(0);
      expect(mockRedisService.heartbeat).toHaveBeenCalledWith(mockUser.sub);
    });
  });

  describe('getOnlineCountInRoom', () => {
    it('should return room size', () => {
      const roomSet = new Set(['socket-1', 'socket-2']);
      (mockServer.sockets!.adapter.rooms as Map<string, Set<string>>).set('room-1', roomSet);

      const count = gateway.getOnlineCountInRoom('room-1');

      expect(count).toBe(2);
    });

    it('should return 0 for empty room', () => {
      const count = gateway.getOnlineCountInRoom('empty-room');

      expect(count).toBe(0);
    });
  });
});
