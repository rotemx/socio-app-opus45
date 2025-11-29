import { Test, type TestingModule } from '@nestjs/testing';
import { RedisService } from './redis.service';
import { REDIS_CLIENT, REDIS_KEYS } from './redis.constants';

// Type for our mock Redis
interface MockRedis {
  status: string;
  get: jest.Mock;
  set: jest.Mock;
  setex: jest.Mock;
  del: jest.Mock;
  exists: jest.Mock;
  expire: jest.Mock;
  ttl: jest.Mock;
  hgetall: jest.Mock;
  hget: jest.Mock;
  hset: jest.Mock;
  hmset: jest.Mock;
  hdel: jest.Mock;
  sadd: jest.Mock;
  srem: jest.Mock;
  smembers: jest.Mock;
  sismember: jest.Mock;
  scard: jest.Mock;
  zadd: jest.Mock;
  zrem: jest.Mock;
  zrangebyscore: jest.Mock;
  zremrangebyscore: jest.Mock;
  publish: jest.Mock;
  duplicate: jest.Mock;
  subscribe: jest.Mock;
  unsubscribe: jest.Mock;
  on: jest.Mock;
  quit: jest.Mock;
  pipeline: jest.Mock;
  keys: jest.Mock;
  scan: jest.Mock;
}

describe('RedisService', () => {
  let service: RedisService;
  let mockRedis: MockRedis;

  beforeEach(async () => {
    // Create mock Redis client
    mockRedis = {
      status: 'ready',
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
      hgetall: jest.fn(),
      hget: jest.fn(),
      hset: jest.fn(),
      hmset: jest.fn(),
      hdel: jest.fn(),
      sadd: jest.fn(),
      srem: jest.fn(),
      smembers: jest.fn(),
      sismember: jest.fn(),
      scard: jest.fn(),
      zadd: jest.fn(),
      zrem: jest.fn(),
      zrangebyscore: jest.fn(),
      zremrangebyscore: jest.fn(),
      publish: jest.fn(),
      duplicate: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      on: jest.fn(),
      quit: jest.fn().mockResolvedValue('OK'),
      pipeline: jest.fn().mockReturnValue({
        zremrangebyscore: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 0],
          [null, 0], // current count (0 = under limit)
        ]),
      }),
      keys: jest.fn(),
      scan: jest.fn().mockResolvedValue(['0', []]), // Default: empty scan result
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: REDIS_CLIENT,
          useValue: mockRedis,
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('basic operations', () => {
    it('should get a value', async () => {
      mockRedis.get.mockResolvedValue('test-value');

      const result = await service.get('test-key');

      expect(result).toBe('test-value');
      expect(mockRedis.get).toHaveBeenCalledWith('test-key');
    });

    it('should set a value without TTL', async () => {
      await service.set('test-key', 'test-value');

      expect(mockRedis.set).toHaveBeenCalledWith('test-key', 'test-value');
    });

    it('should set a value with TTL', async () => {
      await service.set('test-key', 'test-value', 60);

      expect(mockRedis.setex).toHaveBeenCalledWith('test-key', 60, 'test-value');
    });

    it('should delete a key', async () => {
      mockRedis.del.mockResolvedValue(1);

      const result = await service.del('test-key');

      expect(result).toBe(1);
      expect(mockRedis.del).toHaveBeenCalledWith('test-key');
    });

    it('should check if key exists', async () => {
      mockRedis.exists.mockResolvedValue(1);

      const result = await service.exists('test-key');

      expect(result).toBe(true);
      expect(mockRedis.exists).toHaveBeenCalledWith('test-key');
    });
  });

  describe('JSON operations', () => {
    it('should get JSON value', async () => {
      const testObj = { foo: 'bar', num: 42 };
      mockRedis.get.mockResolvedValue(JSON.stringify(testObj));

      const result = await service.getJson<typeof testObj>('test-key');

      expect(result).toEqual(testObj);
    });

    it('should return null for missing key', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.getJson('test-key');

      expect(result).toBeNull();
    });

    it('should return null for invalid JSON', async () => {
      mockRedis.get.mockResolvedValue('invalid-json');

      const result = await service.getJson('test-key');

      expect(result).toBeNull();
    });

    it('should set JSON value', async () => {
      const testObj = { foo: 'bar' };

      await service.setJson('test-key', testObj, 60);

      expect(mockRedis.setex).toHaveBeenCalledWith('test-key', 60, JSON.stringify(testObj));
    });
  });

  describe('set operations', () => {
    it('should add members to set', async () => {
      mockRedis.sadd.mockResolvedValue(2);

      const result = await service.sadd('test-set', 'member1', 'member2');

      expect(result).toBe(2);
      expect(mockRedis.sadd).toHaveBeenCalledWith('test-set', 'member1', 'member2');
    });

    it('should get all set members', async () => {
      mockRedis.smembers.mockResolvedValue(['member1', 'member2']);

      const result = await service.smembers('test-set');

      expect(result).toEqual(['member1', 'member2']);
    });

    it('should check set membership', async () => {
      mockRedis.sismember.mockResolvedValue(1);

      const result = await service.sismember('test-set', 'member1');

      expect(result).toBe(true);
    });
  });

  describe('presence operations', () => {
    it('should set user online', async () => {
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.publish.mockResolvedValue(1);

      await service.setUserOnline('user-123', {
        status: 'ONLINE',
        deviceId: 'device-1',
      });

      expect(mockRedis.setex).toHaveBeenCalled();
      expect(mockRedis.zadd).toHaveBeenCalled();
      expect(mockRedis.publish).toHaveBeenCalled();
    });

    it('should set user offline', async () => {
      mockRedis.get.mockResolvedValue(
        JSON.stringify({
          userId: 'user-123',
          status: 'ONLINE',
          lastSeenAt: Date.now(),
        })
      );
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.zrem.mockResolvedValue(1);
      mockRedis.publish.mockResolvedValue(1);

      await service.setUserOffline('user-123');

      expect(mockRedis.zrem).toHaveBeenCalledWith(`${REDIS_KEYS.PRESENCE}:online`, 'user-123');
      expect(mockRedis.publish).toHaveBeenCalled();
    });

    it('should get user presence', async () => {
      const presenceData = {
        userId: 'user-123',
        status: 'ONLINE',
        lastSeenAt: Date.now(),
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(presenceData));

      const result = await service.getUserPresence('user-123');

      expect(result).toEqual(presenceData);
    });

    it('should add user to room', async () => {
      mockRedis.sadd.mockResolvedValue(1);
      mockRedis.publish.mockResolvedValue(1);

      await service.addUserToRoom('user-123', 'room-456');

      expect(mockRedis.sadd).toHaveBeenCalledWith(`${REDIS_KEYS.ROOM}:room-456:users`, 'user-123');
      expect(mockRedis.sadd).toHaveBeenCalledWith(`${REDIS_KEYS.USER}:user-123:rooms`, 'room-456');
    });

    it('should remove user from room', async () => {
      mockRedis.srem.mockResolvedValue(1);
      mockRedis.publish.mockResolvedValue(1);

      await service.removeUserFromRoom('user-123', 'room-456');

      expect(mockRedis.srem).toHaveBeenCalledWith(`${REDIS_KEYS.ROOM}:room-456:users`, 'user-123');
      expect(mockRedis.srem).toHaveBeenCalledWith(`${REDIS_KEYS.USER}:user-123:rooms`, 'room-456');
    });

    it('should get online users in room', async () => {
      mockRedis.smembers.mockResolvedValue(['user-1', 'user-2', 'user-3']);
      mockRedis.zrangebyscore.mockResolvedValue(['user-1', 'user-2']);

      const result = await service.getOnlineUsersInRoom('room-456');

      expect(result).toEqual(['user-1', 'user-2']);
    });
  });

  describe('rate limiting', () => {
    it('should allow request under limit', async () => {
      // Mock single atomic pipeline: zremrangebyscore, zadd, zcard, expire
      mockRedis.pipeline.mockReturnValue({
        zremrangebyscore: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 0], // zremrangebyscore result
          [null, 1], // zadd result
          [null, 1], // zcard result (count = 1, under limit of 10)
          [null, 1], // expire result
        ]),
      });

      const result = await service.checkRateLimit('test-key', 10, 60);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('should deny request over limit', async () => {
      // Mock pipeline returns count exceeding limit
      mockRedis.pipeline.mockReturnValue({
        zremrangebyscore: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 0], // zremrangebyscore result
          [null, 1], // zadd result
          [null, 11], // zcard result (count = 11, over limit of 10)
          [null, 1], // expire result
        ]),
      });

      const result = await service.checkRateLimit('test-key', 10, 60);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });

  describe('pub/sub', () => {
    it('should publish message', async () => {
      mockRedis.publish.mockResolvedValue(1);

      const result = await service.publish('test-channel', 'test-message');

      expect(result).toBe(1);
      expect(mockRedis.publish).toHaveBeenCalledWith('test-channel', 'test-message');
    });

    it('should publish JSON message', async () => {
      mockRedis.publish.mockResolvedValue(1);
      const testData = { foo: 'bar' };

      const result = await service.publishJson('test-channel', testData);

      expect(result).toBe(1);
      expect(mockRedis.publish).toHaveBeenCalledWith('test-channel', JSON.stringify(testData));
    });
  });

  describe('connection status', () => {
    it('should return connected status', () => {
      expect(service.isConnected()).toBe(true);
    });

    it('should return disconnected status', () => {
      mockRedis.status = 'connecting';
      expect(service.isConnected()).toBe(false);
    });
  });

  describe('caching', () => {
    it('should return cached value', async () => {
      const cachedValue = { data: 'cached' };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedValue));

      const result = await service.getOrSet('cache-key', async () => ({ data: 'fresh' }), 60);

      expect(result).toEqual(cachedValue);
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });

    it('should call factory and cache when not cached', async () => {
      mockRedis.get.mockResolvedValue(null);
      const freshValue = { data: 'fresh' };

      const result = await service.getOrSet('cache-key', async () => freshValue, 60);

      expect(result).toEqual(freshValue);
      expect(mockRedis.setex).toHaveBeenCalledWith('cache-key', 60, JSON.stringify(freshValue));
    });

    it('should invalidate cache by pattern using SCAN', async () => {
      // Mock SCAN to return keys in first iteration, then complete
      mockRedis.scan
        .mockResolvedValueOnce(['0', ['key1', 'key2', 'key3']]);
      mockRedis.del.mockResolvedValue(3);

      const result = await service.invalidateCache('test:*');

      expect(result).toBe(3);
      expect(mockRedis.scan).toHaveBeenCalledWith('0', 'MATCH', 'test:*', 'COUNT', 100);
      expect(mockRedis.del).toHaveBeenCalledWith('key1', 'key2', 'key3');
    });

    it('should handle multiple SCAN iterations', async () => {
      // Mock SCAN to return keys in multiple iterations
      mockRedis.scan
        .mockResolvedValueOnce(['5', ['key1', 'key2']]) // First batch, cursor 5
        .mockResolvedValueOnce(['0', ['key3']]); // Second batch, cursor 0 = done
      mockRedis.del.mockResolvedValue(2).mockResolvedValueOnce(2).mockResolvedValueOnce(1);

      const result = await service.invalidateCache('test:*');

      expect(result).toBe(3);
      expect(mockRedis.scan).toHaveBeenCalledTimes(2);
    });

    it('should return 0 when no keys to invalidate', async () => {
      mockRedis.scan.mockResolvedValue(['0', []]); // Empty result

      const result = await service.invalidateCache('nonexistent:*');

      expect(result).toBe(0);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should propagate Redis get errors', async () => {
      mockRedis.get.mockRejectedValue(new Error('Connection refused'));

      await expect(service.get('test-key')).rejects.toThrow('Connection refused');
    });

    it('should propagate Redis set errors', async () => {
      mockRedis.set.mockRejectedValue(new Error('Operation timeout'));

      await expect(service.set('test-key', 'value')).rejects.toThrow('Operation timeout');
    });

    it('should propagate pipeline execution errors', async () => {
      mockRedis.pipeline.mockReturnValue({
        zremrangebyscore: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error('Pipeline failed')),
      });

      await expect(service.checkRateLimit('test-key', 10, 60)).rejects.toThrow('Pipeline failed');
    });

    it('should propagate publish errors', async () => {
      mockRedis.publish.mockRejectedValue(new Error('Publish failed'));

      await expect(service.publish('channel', 'message')).rejects.toThrow('Publish failed');
    });

    it('should handle setUserOnline errors', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis unavailable'));

      await expect(
        service.setUserOnline('user-123', { status: 'ONLINE' })
      ).rejects.toThrow('Redis unavailable');
    });
  });
});
