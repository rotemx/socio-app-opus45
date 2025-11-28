# SOCIO-302: Redis Pub/Sub Integration

## Summary

Implemented Redis pub/sub integration for multi-instance Socket.io support, presence caching, and rate limiting infrastructure.

## Implementation Details

### Files Created

1. **`apps/backend/src/redis/redis.constants.ts`**
   - `REDIS_CLIENT`, `REDIS_PUBLISHER`, `REDIS_SUBSCRIBER` injection tokens
   - `REDIS_KEYS` - Key prefixes for presence, session, rate limit, room, user, socket.io
   - `REDIS_CHANNELS` - Pub/sub channels for presence, user status, room events, messages
   - `REDIS_TTL` - Default TTL values for different data types

2. **`apps/backend/src/redis/redis.service.ts`**
   - Core Redis operations (get/set/del with TTL)
   - JSON operations with automatic serialization
   - Hash operations for structured data
   - Set operations for room membership tracking
   - Sorted set operations for presence ordering
   - Pub/sub with channel subscriptions
   - Presence operations:
     - `setUserOnline()` - Mark user online with status and device
     - `setUserOffline()` - Mark user offline
     - `heartbeat()` - Update presence timestamp
     - `getOnlineUsers()` - Get all online users
     - `getOnlineUsersInRoom()` - Get online users in a specific room
     - `addUserToRoom()` / `removeUserFromRoom()` - Track room membership
   - Rate limiting with sliding window algorithm
   - Cache operations with TTL

3. **`apps/backend/src/redis/redis.module.ts`**
   - Global Redis module with static and async configuration
   - Creates three Redis connections: client, publisher, subscriber
   - Connection event logging and error handling
   - Graceful shutdown on application close

4. **`apps/backend/src/redis/redis.service.spec.ts`**
   - 30 unit tests covering all service operations
   - Tests for basic operations, JSON, sets, presence, rate limiting, pub/sub

5. **`apps/backend/src/redis/index.ts`**
   - Module exports

### Files Modified

1. **`apps/backend/src/app.module.ts`**
   - Added RedisModule.forRootAsync() with URL from config

2. **`apps/backend/src/modules/chat/chat.gateway.ts`**
   - Added `@socket.io/redis-adapter` for multi-instance support
   - Injected RedisService, pub/sub clients
   - `afterInit()` - Configures Redis adapter on server
   - `handleConnection()` - Sets user online in Redis
   - `handleJoinRoom()` - Tracks user in room via Redis
   - `handleLeaveRoom()` - Removes user from room in Redis
   - `handleHeartbeat()` - Updates Redis presence
   - `handleUserOffline()` - Cleans up Redis state on disconnect

3. **`apps/backend/src/modules/chat/chat.gateway.spec.ts`**
   - Updated with RedisService mock and new assertions

4. **`apps/backend/src/modules/presence/presence.service.ts`**
   - Added RedisService dependency
   - `updateStatus()` - Updates both Redis and database
   - `heartbeat()` - Updates Redis immediately, then database
   - `getRoomOnlineUsers()` - Reads from Redis first, falls back to DB
   - `setOffline()` - Updates both Redis and database
   - `cleanupStalePresences()` - Cleans both Redis and database

5. **`apps/backend/package.json`**
   - Added `ioredis` and `@socket.io/redis-adapter` dependencies

## Architecture

### Redis Adapter Flow
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Instance 1    │     │   Instance 2    │     │   Instance 3    │
│  ChatGateway    │     │  ChatGateway    │     │  ChatGateway    │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │      Redis Server       │
                    │  (Pub/Sub Adapter)      │
                    └─────────────────────────┘
```

### Presence Data Flow
```
Client                      Gateway                      Redis
  │                           │                           │
  │── heartbeat ─────────────>│                           │
  │                           │── setUserOnline() ───────>│
  │                           │                           │
  │                           │<── presence:online ──────│ (pub/sub)
  │                           │                           │
  │<── broadcast to room ─────│                           │
```

## Key Features

### Multi-Instance Socket.io Support
- Uses `@socket.io/redis-adapter` to sync events across server instances
- Messages broadcast to one instance are delivered to all instances
- Room membership is shared across the cluster

### Presence Caching
- User presence stored in Redis with TTL
- Sorted set tracks online users with timestamps
- Room membership tracked with sets
- Falls back to database when Redis is empty

### Rate Limiting
- Sliding window algorithm using sorted sets
- Configurable limits and time windows
- Returns remaining count and reset timestamp

### Pub/Sub Channels
- `presence:update` - Presence status changes
- `user:status` - Online/offline events
- `room:event` - Room join/leave events
- `message:event` - Message events (for future use)

## Testing

- 139 tests passing (30 new tests for Redis)
- TypeScript: Clean
- ESLint: Clean

## Dependencies Added

- `ioredis@^5.8.2` - Redis client for Node.js
- `@socket.io/redis-adapter@^8.3.0` - Redis adapter for Socket.io

## Configuration

Set `REDIS_URL` environment variable:
```
REDIS_URL=redis://localhost:6379
```

If not set, defaults to `redis://localhost:6379`.

## Docker Services

Redis is already configured in `scripts/docker-services.sh`:
- Container: `socio-redis`
- Port: 6379
- Data volume: `socio_redis_data`

## Status

**COMPLETED** - All acceptance criteria met. Ready for integration testing.

## Acceptance Criteria Status

- [x] Redis pub/sub for multi-instance Socket.io
- [x] Presence caching with TTL
- [x] Room membership tracking in Redis
- [x] Rate limiting infrastructure
- [x] Graceful degradation to database
- [x] Unit tests for Redis service
- [x] Integration with existing ChatGateway
- [x] Integration with existing PresenceService
