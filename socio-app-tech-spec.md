# Socio Technical Specification
## Mobile-First Geo-Local Chat Application for Tel Aviv LGBT Community

**Version 1.0 | November 2025**

---

## Executive summary

Socio is a location-based chat room discovery platform enabling users to find nearby communities, engage in real-time conversations, and connect through voice/video calls. This specification provides the complete technical foundation for building Socio with a modern, scalable architecture optimized for the AWS Tel Aviv region and Claude Code-assisted development.

The recommended stack combines **NestJS** for structured backend development, **PostgreSQL with PostGIS** for geospatial queries, **React Native + React.js in a Turborepo monorepo** for cross-platform clients, **100ms** for voice/video integration, and **Socket.io with Redis** for real-time messaging. This architecture enables an MVP launch within **12-16 weeks** while maintaining a path to scale.

---

## Technology stack decisions

### Backend architecture

| Component | Technology | Version | Justification |
|-----------|------------|---------|---------------|
| **Framework** | NestJS | 10.x | TypeScript-first, built-in WebSocket support, dependency injection for testability |
| **WebSocket** | Socket.io + uWebSockets.js | 4.7+ | Room/namespace abstractions with 10-20x performance boost from uWebSockets backend |
| **Message Broker** | Redis Streams | 7.0+ | At-least-once delivery, message persistence, cluster-ready |
| **Job Queue** | BullMQ | 5.x | Background processing for notifications, message persistence |
| **ORM** | Prisma | 5.x | Type-safe queries, excellent PostgreSQL/PostGIS support |

**NestJS was chosen over Express.js** because it provides ~40% faster development time through its modular architecture, built-in decorators for WebSocket handling (`@WebSocketGateway`, `@SubscribeMessage`), and dependency injection that dramatically simplifies testing. The structured approach aligns well with Claude Code's ability to generate consistent, pattern-following code.

### Database layer

| Component | Technology | Version | Justification |
|-----------|------------|---------|---------------|
| **Primary Database** | PostgreSQL | 16.x | Mature, excellent JSON support, AWS RDS availability |
| **Geospatial Extension** | PostGIS | 3.4+ | Industry-standard for location queries, ST_DWithin for efficient proximity search |
| **Connection Pooling** | PgBouncer | Latest | Transaction pooling for efficient connection management |
| **Caching** | Redis | 7.0+ | Pub/sub, presence tracking, session storage |

### Frontend architecture

| Component | Technology | Version | Justification |
|-----------|------------|---------|---------------|
| **Monorepo Tool** | Turborepo | 2.x | Simple setup, excellent caching, Vercel integration |
| **Mobile** | React Native | 0.76+ | Cross-platform with native performance |
| **Web** | React.js + Vite | 18.x / 5.x | Modern bundling, excellent DX |
| **Styling** | NativeWind | 4.x | Tailwind utilities across platforms |
| **State (Client)** | Zustand | 4.x | Minimal boilerplate, perfect for real-time updates |
| **State (Server)** | TanStack Query | 5.x | Caching, infinite scroll, WebSocket integration |
| **Navigation** | React Navigation / React Router | 7.x / 6.x | Platform-appropriate navigation patterns |

### Voice/video integration

**100ms is recommended** over Twilio (sunsetting), Agora, and Daily.co based on:

- **Best React Native SDK** with latest RN 0.77 support and TypeScript
- **Predictable pricing** at $0.004/minute without resolution-based tiers
- **10,000 free minutes/month** covering MVP usage
- **Prebuilt UI components** accelerating development timeline

| Scenario | Monthly Minutes | Estimated Cost |
|----------|-----------------|----------------|
| MVP (1,000 users) | 5,000 | **$0** (free tier) |
| Growth (10,000 users) | 50,000 | **~$160** |
| Scale (100,000 users) | 500,000 | **~$2,000-2,500** |

### AWS infrastructure (Tel Aviv il-central-1)

| Service | Configuration | Free Tier | Monthly After FT |
|---------|---------------|-----------|------------------|
| **EC2** | t3.micro (WebSocket servers) | 750 hrs/mo | ~$7.59 |
| **RDS** | db.t3.micro PostgreSQL + PostGIS | 750 hrs + 20GB | ~$12.41 |
| **ElastiCache** | cache.t3.micro Redis | ❌ | ~$11.68 |
| **ALB** | WebSocket-enabled | ❌ | ~$16.43 |
| **S3** | Media storage | 5GB | ~$2-5 |
| **CloudFront** | CDN with Tel Aviv edge | 1TB | ~$4.25 |
| **Total MVP** | | | **~$55-65/month** |

---

## System architecture overview

### Component interaction diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                   │
├─────────────────────┬───────────────────────┬───────────────────────────┤
│   React Native      │      React.js Web     │       Push Services       │
│   (iOS/Android)     │                       │    (FCM/APNs via 100ms)   │
└─────────┬───────────┴───────────┬───────────┴───────────────────────────┘
          │ REST/WebSocket        │ REST/WebSocket
          ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        LOAD BALANCER (ALB)                               │
│                  Sticky Sessions | SSL Termination                       │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
┌─────────────────────────────────┼───────────────────────────────────────┐
│                         APPLICATION LAYER                                │
├─────────────────────────────────┴───────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────────────┐  │
│  │   REST API       │  │  WebSocket       │  │   Background Workers  │  │
│  │   (NestJS)       │  │  Gateway         │  │   (BullMQ)            │  │
│  │                  │  │  (Socket.io)     │  │                       │  │
│  │  - Auth          │  │  - Messages      │  │  - Push notifications │  │
│  │  - Rooms CRUD    │  │  - Presence      │  │  - Message archival   │  │
│  │  - User mgmt     │  │  - Typing        │  │  - Media processing   │  │
│  │  - Room discovery│  │  - Call signals  │  │  - Analytics          │  │
│  └────────┬─────────┘  └────────┬─────────┘  └───────────┬───────────┘  │
└───────────┼─────────────────────┼────────────────────────┼──────────────┘
            │                     │                        │
┌───────────┴─────────────────────┴────────────────────────┴──────────────┐
│                          DATA LAYER                                      │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────┐   ┌────────────────────┐   ┌─────────────────┐  │
│  │  PostgreSQL/PostGIS│   │    Redis Cluster   │   │      S3         │  │
│  │                    │   │                    │   │                 │  │
│  │  - Users           │   │  - Pub/Sub         │   │  - Media files  │  │
│  │  - Rooms           │   │  - Sessions        │   │  - Voice notes  │  │
│  │  - Messages        │   │  - Presence cache  │   │  - Video notes  │  │
│  │  - Geospatial      │   │  - Rate limiting   │   │  - Attachments  │  │
│  └────────────────────┘   └────────────────────┘   └─────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────┴───────────────────────────────────────┐
│                      EXTERNAL SERVICES                                   │
├──────────────────┬──────────────────┬────────────────┬──────────────────┤
│      100ms       │  Twilio Verify   │    CloudFront  │   OAuth Providers│
│  (Voice/Video)   │  (Phone OTP)     │    (CDN)       │   (Google/Apple) │
└──────────────────┴──────────────────┴────────────────┴──────────────────┘
```

### Real-time message flow

```
User A sends message:

1. Mobile App → WebSocket Gateway (Socket.io)
2. Gateway validates JWT, rate-limits user
3. Gateway publishes to Redis Stream: "messages:room1"
4. Message persisted to PostgreSQL asynchronously (BullMQ)
5. Redis Pub/Sub broadcasts to all Gateway instances
6. Each Gateway emits to local connected room members
7. Acknowledgment sent to User A
8. Push notification queued for offline members
```

---

## Database schema design

### Core tables with PostGIS

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =====================================================
-- USERS TABLE
-- =====================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255),
    display_name VARCHAR(100),
    avatar_url TEXT,
    bio TEXT,
    
    -- Authentication
    auth_provider VARCHAR(20) DEFAULT 'email', -- email, google, apple, phone
    auth_provider_id VARCHAR(255),
    is_guest BOOLEAN DEFAULT false,
    guest_expires_at TIMESTAMPTZ,
    
    -- Location (GEOGRAPHY for accurate global distance)
    current_location GEOGRAPHY(POINT, 4326),
    location_updated_at TIMESTAMPTZ,
    location_precision VARCHAR(20) DEFAULT 'approximate',
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    shadow_banned BOOLEAN DEFAULT false,
    
    -- Settings
    settings JSONB DEFAULT '{
        "notifications": true,
        "location_sharing": true,
        "discoverable": true
    }'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ
);

CREATE INDEX idx_users_location ON users USING GIST (current_location);
CREATE INDEX idx_users_username_search ON users USING GIN (username gin_trgm_ops);

-- =====================================================
-- CHAT ROOMS TABLE
-- =====================================================
CREATE TABLE chat_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    avatar_url TEXT,
    
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    
    -- Location: store both GEOMETRY (fast indexing) and GEOGRAPHY (accurate distance)
    location GEOMETRY(POINT, 4326) NOT NULL,
    location_geog GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (location::geography) STORED,
    
    -- Dynamic location (40% creator + 60% weighted member average)
    computed_location GEOMETRY(POINT, 4326),
    location_geohash VARCHAR(12) GENERATED ALWAYS AS (ST_GeoHash(location, 6)) STORED,
    
    -- Room configuration
    radius_meters INTEGER DEFAULT 5000,
    is_public BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    max_members INTEGER DEFAULT 100,
    
    -- Tags for discovery
    tags TEXT[] DEFAULT '{}',
    
    -- Room settings
    settings JSONB DEFAULT '{
        "allow_media": true,
        "require_location_check": true,
        "voice_enabled": true,
        "video_enabled": true
    }'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ DEFAULT NOW()
);

-- Critical spatial indexes
CREATE INDEX idx_rooms_location_gist ON chat_rooms USING GIST (location);
CREATE INDEX idx_rooms_geog_gist ON chat_rooms USING GIST (location_geog);
CREATE INDEX idx_rooms_active_public ON chat_rooms USING GIST (location_geog) 
    WHERE is_active = true AND is_public = true;
CREATE INDEX idx_rooms_tags ON chat_rooms USING GIN (tags);

-- =====================================================
-- ROOM MEMBERS TABLE
-- =====================================================
CREATE TABLE room_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Member location for weighted calculation
    join_location GEOGRAPHY(POINT, 4326),
    
    -- Role and permissions
    role VARCHAR(20) DEFAULT 'member', -- creator, admin, moderator, member
    
    -- Activity weight for location calculation (0.0-2.0)
    activity_weight DECIMAL(3,2) DEFAULT 1.0,
    
    -- Preferences
    is_muted BOOLEAN DEFAULT false,
    notifications_enabled BOOLEAN DEFAULT true,
    
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_read_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(room_id, user_id)
);

CREATE INDEX idx_members_room ON room_members (room_id);
CREATE INDEX idx_members_user ON room_members (user_id);

-- =====================================================
-- MESSAGES TABLE (Partitioned by month)
-- =====================================================
CREATE TABLE messages (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL,
    sender_id UUID NOT NULL,
    
    -- Content
    content TEXT NOT NULL,
    content_type VARCHAR(20) DEFAULT 'text', -- text, image, video, audio, file, location
    
    -- Metadata for rich content
    metadata JSONB DEFAULT '{}',
    
    -- Threading
    reply_to_id UUID,
    
    -- Status
    is_edited BOOLEAN DEFAULT false,
    is_deleted BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (created_at, id)
) PARTITION BY RANGE (created_at);

-- Create monthly partitions (automate with pg_partman in production)
CREATE TABLE messages_2025_01 PARTITION OF messages
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE messages_2025_02 PARTITION OF messages
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
-- Continue for additional months...
CREATE TABLE messages_default PARTITION OF messages DEFAULT;

CREATE INDEX idx_messages_room_time ON messages (room_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages (sender_id, created_at DESC);
CREATE INDEX idx_messages_created_brin ON messages USING BRIN (created_at);

-- =====================================================
-- READ RECEIPTS TABLE
-- =====================================================
CREATE TABLE read_receipts (
    room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_message_id UUID,
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (room_id, user_id)
);
```

### Optimized room discovery query

```sql
-- Find rooms within 5km, sorted by distance, with member counts
SELECT 
    r.id,
    r.name,
    r.description,
    r.avatar_url,
    r.tags,
    ST_Distance(r.location_geog, :user_geog) AS distance_meters,
    COUNT(rm.id) AS member_count,
    r.last_activity_at
FROM chat_rooms r
LEFT JOIN room_members rm ON r.id = rm.room_id
WHERE ST_DWithin(
    r.location_geog,
    ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
    5000  -- 5km in meters
)
AND r.is_active = true
AND r.is_public = true
GROUP BY r.id
ORDER BY r.location <-> ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)
LIMIT 50;
```

### Dynamic room location calculation

```sql
-- Function: 40% creator location + 60% weighted member average
CREATE OR REPLACE FUNCTION calculate_room_location(p_room_id UUID)
RETURNS GEOMETRY AS $$
DECLARE
    v_creator_location GEOMETRY;
    v_member_centroid GEOMETRY;
    v_member_count INTEGER;
BEGIN
    -- Get creator's location
    SELECT u.current_location::geometry INTO v_creator_location
    FROM chat_rooms r
    JOIN users u ON r.creator_id = u.id
    WHERE r.id = p_room_id;
    
    -- Calculate weighted member centroid
    SELECT 
        ST_SetSRID(ST_MakePoint(
            SUM(ST_X(rm.join_location::geometry) * rm.activity_weight) / 
                NULLIF(SUM(rm.activity_weight), 0),
            SUM(ST_Y(rm.join_location::geometry) * rm.activity_weight) / 
                NULLIF(SUM(rm.activity_weight), 0)
        ), 4326),
        COUNT(*)
    INTO v_member_centroid, v_member_count
    FROM room_members rm
    WHERE rm.room_id = p_room_id
      AND rm.join_location IS NOT NULL;
    
    IF v_member_centroid IS NULL OR v_member_count = 0 THEN
        RETURN v_creator_location;
    END IF;
    
    -- 40% creator + 60% member weighted average
    RETURN ST_SetSRID(ST_MakePoint(
        0.4 * ST_X(v_creator_location) + 0.6 * ST_X(v_member_centroid),
        0.4 * ST_Y(v_creator_location) + 0.6 * ST_Y(v_member_centroid)
    ), 4326);
END;
$$ LANGUAGE plpgsql;
```

---

## Monorepo project structure

```
socio/
├── CLAUDE.md                          # Root project context for Claude Code
├── .claude/
│   └── commands/                      # Custom slash commands
│       ├── fix-issue.md
│       ├── generate-tests.md
│       └── code-review.md
├── apps/
│   ├── mobile/                        # React Native app
│   │   ├── CLAUDE.md                  # Mobile-specific context
│   │   ├── src/
│   │   │   ├── screens/
│   │   │   │   ├── ChatRoom/
│   │   │   │   │   ├── ChatRoomScreen.tsx
│   │   │   │   │   └── components/
│   │   │   │   ├── RoomDiscovery/
│   │   │   │   ├── Profile/
│   │   │   │   └── Settings/
│   │   │   ├── navigation/
│   │   │   │   ├── RootNavigator.tsx
│   │   │   │   └── linking.ts
│   │   │   ├── services/
│   │   │   │   └── notifications.ts
│   │   │   └── App.tsx
│   │   ├── android/
│   │   ├── ios/
│   │   ├── metro.config.js
│   │   └── package.json
│   │
│   ├── web/                           # React.js web app
│   │   ├── CLAUDE.md
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   ├── routes/
│   │   │   └── App.tsx
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   └── backend/                       # NestJS server
│       ├── CLAUDE.md                  # Backend-specific context
│       ├── src/
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   │   ├── auth.controller.ts
│       │   │   │   ├── auth.service.ts
│       │   │   │   ├── auth.module.ts
│       │   │   │   ├── strategies/
│       │   │   │   │   ├── jwt.strategy.ts
│       │   │   │   │   └── google.strategy.ts
│       │   │   │   └── dto/
│       │   │   ├── chat/
│       │   │   │   ├── chat.gateway.ts
│       │   │   │   ├── chat.service.ts
│       │   │   │   └── chat.module.ts
│       │   │   ├── rooms/
│       │   │   │   ├── rooms.controller.ts
│       │   │   │   ├── rooms.service.ts
│       │   │   │   └── dto/
│       │   │   ├── messages/
│       │   │   ├── users/
│       │   │   └── presence/
│       │   ├── common/
│       │   │   ├── guards/
│       │   │   ├── interceptors/
│       │   │   └── decorators/
│       │   ├── config/
│       │   └── main.ts
│       ├── prisma/
│       │   ├── schema.prisma
│       │   └── migrations/
│       └── package.json
│
├── packages/
│   ├── shared/                        # Shared business logic
│   │   ├── CLAUDE.md
│   │   ├── src/
│   │   │   ├── stores/
│   │   │   │   ├── chatStore.ts       # Zustand
│   │   │   │   ├── authStore.ts
│   │   │   │   └── roomStore.ts
│   │   │   ├── hooks/
│   │   │   │   ├── useChat.ts
│   │   │   │   ├── useChatHistory.ts  # TanStack Query
│   │   │   │   ├── useRoomDiscovery.ts
│   │   │   │   └── useAuth.ts
│   │   │   ├── services/
│   │   │   │   ├── websocket.ts
│   │   │   │   └── api.ts
│   │   │   └── utils/
│   │   └── package.json
│   │
│   ├── ui/                            # Shared UI components
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── Avatar/
│   │   │   │   ├── MessageBubble/
│   │   │   │   ├── RoomCard/
│   │   │   │   └── ChatInput/
│   │   │   ├── tokens/
│   │   │   │   ├── colors.ts
│   │   │   │   └── spacing.ts
│   │   │   └── index.ts
│   │   ├── tailwind.config.js
│   │   └── package.json
│   │
│   ├── types/                         # Shared TypeScript types
│   │   ├── src/
│   │   │   ├── api.ts
│   │   │   ├── chat.ts
│   │   │   ├── user.ts
│   │   │   └── room.ts
│   │   └── package.json
│   │
│   └── config/                        # Shared configurations
│       ├── eslint/
│       ├── typescript/
│       └── tailwind/
│
├── docs/
│   ├── architecture/
│   │   ├── decisions/                 # ADRs
│   │   └── diagrams/
│   └── api/
│
├── turbo.json
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

### Turborepo configuration

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "lint": {
      "dependsOn": ["^build"]
    }
  }
}
```

---

## Claude Code development guide

### Root CLAUDE.md template

```markdown
# Socio Chat Application

## Project Overview
Location-based chat discovery app with React Native mobile, React.js web, and NestJS backend.

## Tech Stack
- **Mobile**: React Native 0.76+, TypeScript, Expo modules, Zustand, TanStack Query
- **Web**: React.js 18, Vite, TypeScript
- **Backend**: NestJS 10, Socket.io, Prisma, PostgreSQL/PostGIS, Redis
- **Voice/Video**: 100ms SDK

## Development Commands
```bash
# Start all services
pnpm dev

# Backend only
pnpm dev --filter=@socio/backend

# Mobile (requires emulator/device)
pnpm dev --filter=@socio/mobile

# Run tests
pnpm test

# Database migrations
cd apps/backend && npx prisma migrate dev
```

## Code Conventions
- TypeScript strict mode everywhere
- Functional components with hooks (React/React Native)
- async/await, never callbacks
- Zod for runtime validation
- Use existing patterns as templates (see examples below)

## Key Patterns
- **WebSocket Handler**: See `apps/backend/src/modules/chat/chat.gateway.ts`
- **React Component**: See `packages/ui/src/components/MessageBubble/`
- **Zustand Store**: See `packages/shared/src/stores/chatStore.ts`
- **TanStack Query Hook**: See `packages/shared/src/hooks/useChatHistory.ts`

## Testing Requirements
- Unit tests for all services (80% coverage minimum)
- Component tests for UI components
- E2E tests for critical flows (auth, chat, room discovery)

## DO NOT
- Modify authentication without security review
- Add npm packages without approval
- Use `any` type
- Skip error handling
- Use inline styles in React Native
```

### Effective Claude Code prompts

**Feature implementation prompt:**
```xml
<task>
Implement real-time presence tracking for chat rooms
</task>

<context>
- Working in apps/backend/src/modules/presence/
- We use Socket.io for WebSocket with NestJS Gateway pattern
- Redis stores presence state with TTL
- See chat.gateway.ts for existing WebSocket patterns
</context>

<requirements>
- Track when users join/leave rooms
- Broadcast presence updates to room members only
- Store online status in Redis sorted set (score = timestamp)
- Handle reconnection gracefully (30-second grace period)
- Clean up stale presence on disconnect
</requirements>

<output_format>
1. Create presence.gateway.ts following chat.gateway.ts pattern
2. Create presence.service.ts with Redis integration
3. Create presence.service.spec.ts with comprehensive tests
4. Update app.module.ts to include new providers
</output_format>
```

**Database query generation prompt:**
```
Create an optimized Prisma query for room discovery:

Requirements:
- Find rooms within X kilometers of user location
- Sort by distance (nearest first)
- Include member count for each room
- Support cursor-based pagination
- Filter by tags (optional)
- Only return active, public rooms

Use raw SQL with PostGIS for the spatial query.
Follow the pattern in rooms.service.ts for Prisma raw queries.
Write tests covering: no results, pagination, tag filtering.
```

---

## Authentication and security specification

### JWT token structure

```typescript
// Access Token (15-minute expiry)
interface AccessTokenPayload {
  sub: string;        // User ID
  type: 'access';
  roles: string[];
  deviceId: string;
  sessionId: string;
  iat: number;
  exp: number;
}

// Refresh Token (7-day expiry)
interface RefreshTokenPayload {
  sub: string;
  type: 'refresh';
  family: string;     // Token family for rotation detection
  iat: number;
  exp: number;
}
```

### WebSocket authentication flow

```typescript
// NestJS WebSocket Gateway with JWT
@WebSocketGateway({ cors: true })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  
  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token;
    
    if (!token) {
      client.emit('error', { message: 'Authentication required' });
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.authService.validateToken(token);
      client.data.user = payload;
      client.data.connectedAt = Date.now();
      
      // Join user's personal room for direct messages
      client.join(`user:${payload.sub}`);
      
    } catch (error) {
      client.emit('error', { message: 'Invalid token' });
      client.disconnect(true);
    }
  }

  // Handle token refresh during active connection
  @SubscribeMessage('auth:refresh')
  async handleTokenRefresh(
    client: Socket, 
    payload: { refreshToken: string }
  ) {
    const newTokens = await this.authService.refreshTokens(payload.refreshToken);
    client.data.user = await this.authService.validateToken(newTokens.accessToken);
    client.emit('auth:refreshed', newTokens);
  }
}
```

### Rate limiting implementation

```typescript
// Redis-based sliding window rate limiter
@Injectable()
export class RateLimitService {
  constructor(private readonly redis: Redis) {}

  async checkLimit(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number }> {
    const now = Date.now();
    const windowStart = now - (windowSeconds * 1000);
    
    const pipeline = this.redis.pipeline();
    pipeline.zremrangebyscore(key, '-inf', windowStart);
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    pipeline.zcard(key);
    pipeline.expire(key, windowSeconds);
    
    const results = await pipeline.exec();
    const count = results[2][1] as number;
    
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count)
    };
  }
}

// Apply to messages: 60 messages per minute per user
// Apply to rooms: 1000 messages per minute per room
```

---

## Voice/video integration with 100ms

### SDK setup

```typescript
// packages/mobile/src/services/calling.ts
import { HMSSDK, HMSConfig } from '@100mslive/react-native-hms';

class CallingService {
  private hmsInstance: HMSSDK | null = null;

  async initialize() {
    this.hmsInstance = await HMSSDK.build();
    this.setupListeners();
  }

  async joinCall(roomCode: string, userId: string, userName: string) {
    // Get auth token from backend
    const { token } = await api.post('/calls/token', { roomCode, userId });
    
    const config = new HMSConfig({
      authToken: token,
      username: userName,
      captureNetworkQualityInPreview: true,
    });

    await this.hmsInstance?.join(config);
  }

  async leaveCall() {
    await this.hmsInstance?.leave();
  }

  private setupListeners() {
    this.hmsInstance?.addEventListener(
      HMSUpdateListenerActions.ON_PEER_UPDATE,
      this.handlePeerUpdate
    );
    
    this.hmsInstance?.addEventListener(
      HMSUpdateListenerActions.ON_ERROR,
      this.handleError
    );
  }

  private handlePeerUpdate = (data: { peer: HMSPeer; type: HMSPeerUpdate }) => {
    // Update UI with peer join/leave/mute status
  };
}

export const callingService = new CallingService();
```

### Backend call token generation

```typescript
// apps/backend/src/modules/calls/calls.service.ts
import * as HMS from '@100mslive/server-sdk';

@Injectable()
export class CallsService {
  private hms: HMS;

  constructor() {
    this.hms = new HMS.SDK(
      process.env.HMS_ACCESS_KEY,
      process.env.HMS_SECRET
    );
  }

  async generateToken(roomCode: string, userId: string, role: string = 'guest') {
    const token = await this.hms.auth.getAuthToken({
      roomId: roomCode,
      userId: userId,
      role: role,
    });
    
    return { token };
  }

  async createRoom(roomName: string): Promise<{ roomId: string; roomCode: string }> {
    const room = await this.hms.rooms.create({
      name: roomName,
      template_id: process.env.HMS_TEMPLATE_ID,
    });
    
    return {
      roomId: room.id,
      roomCode: room.room_code,
    };
  }
}
```

---

## CI/CD pipeline

### GitHub Actions workflow

```yaml
# .github/workflows/ci.yml
name: CI Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      backend: ${{ steps.filter.outputs.backend }}
      mobile: ${{ steps.filter.outputs.mobile }}
      web: ${{ steps.filter.outputs.web }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v2
        id: filter
        with:
          filters: |
            backend:
              - 'apps/backend/**'
              - 'packages/shared/**'
              - 'packages/types/**'
            mobile:
              - 'apps/mobile/**'
              - 'packages/shared/**'
              - 'packages/ui/**'
            web:
              - 'apps/web/**'
              - 'packages/shared/**'
              - 'packages/ui/**'

  backend-tests:
    needs: detect-changes
    if: needs.detect-changes.outputs.backend == 'true'
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgis/postgis:16-3.4
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: socio_test
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm --filter @socio/backend run db:migrate
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/socio_test
      - run: pnpm --filter @socio/backend run test:cov
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/socio_test
          REDIS_URL: redis://localhost:6379
      - uses: codecov/codecov-action@v3
        with:
          files: apps/backend/coverage/lcov.info

  mobile-build:
    needs: detect-changes
    if: needs.detect-changes.outputs.mobile == 'true'
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - name: Install CocoaPods
        run: |
          cd apps/mobile/ios
          pod install
      - name: Build iOS
        run: |
          cd apps/mobile
          npx react-native build-ios --mode Release --scheme Socio

  deploy-staging:
    needs: [backend-tests]
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: il-central-1
      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster socio-staging \
            --service backend \
            --force-new-deployment
```

---

## Jira work breakdown structure

### Epic hierarchy

```
📦 SOCIO-1: MVP Foundation (Sprint 1-4)
├── 📋 SOCIO-10: Project Setup & Infrastructure
│   ├── ✅ SOCIO-101: Initialize monorepo with Turborepo
│   ├── ✅ SOCIO-102: Configure TypeScript base config
│   ├── ✅ SOCIO-103: Setup ESLint and Prettier
│   ├── ✅ SOCIO-104: Create NestJS backend scaffold
│   ├── ✅ SOCIO-105: Setup Prisma with PostgreSQL/PostGIS
│   ├── ✅ SOCIO-106: Initialize React Native project
│   ├── ✅ SOCIO-107: Configure AWS Free Tier resources
│   └── ✅ SOCIO-108: Setup GitHub Actions CI pipeline
│
├── 📋 SOCIO-20: Authentication System
│   ├── ✅ SOCIO-201: Implement JWT auth service
│   ├── ✅ SOCIO-202: Create auth guards and decorators
│   ├── ✅ SOCIO-203: Google OAuth integration
│   ├── ✅ SOCIO-204: Apple Sign-In integration
│   ├── ✅ SOCIO-205: Phone verification with Twilio
│   ├── ✅ SOCIO-206: Guest/anonymous user flow
│   ├── ✅ SOCIO-207: Mobile login screens
│   └── ✅ SOCIO-208: Token refresh WebSocket integration
│
├── 📋 SOCIO-30: Real-Time Messaging Core
│   ├── ✅ SOCIO-301: Socket.io gateway setup
│   ├── ✅ SOCIO-302: Redis pub/sub integration
│   ├── ✅ SOCIO-303: Message service with persistence
│   ├── ✅ SOCIO-304: Presence tracking service
│   ├── ✅ SOCIO-305: Typing indicators
│   ├── ✅ SOCIO-306: Read receipts implementation
│   └── ✅ SOCIO-307: Rate limiting middleware
│
├── 📋 SOCIO-40: Room Discovery & Geolocation
│   ├── ✅ SOCIO-401: PostGIS spatial queries
│   ├── ✅ SOCIO-402: Room CRUD endpoints
│   ├── ✅ SOCIO-403: Dynamic room location calculation
│   ├── ✅ SOCIO-404: Nearby rooms discovery API
│   ├── ✅ SOCIO-405: Location permission handling (mobile)
│   ├── ✅ SOCIO-406: Room discovery map view
│   └── ✅ SOCIO-407: Room list with distance display
│
└── 📋 SOCIO-50: Chat Interface
    ├── ✅ SOCIO-501: MessageBubble component
    ├── ✅ SOCIO-502: ChatInput with media support
    ├── ✅ SOCIO-503: Message list with infinite scroll
    ├── ✅ SOCIO-504: Room header with members
    ├── ✅ SOCIO-505: Zustand chat store
    └── ✅ SOCIO-506: TanStack Query integration

📦 SOCIO-2: Voice/Video & Media (Sprint 5-7)
├── 📋 SOCIO-60: 100ms Integration
│   ├── SOCIO-601: 100ms SDK setup
│   ├── SOCIO-602: Token generation service
│   ├── SOCIO-603: 1:1 voice call UI
│   ├── SOCIO-604: 1:1 video call UI
│   ├── SOCIO-605: CallKit/ConnectionService integration
│   └── SOCIO-606: Push notifications for calls
│
├── 📋 SOCIO-70: Media Handling
│   ├── SOCIO-701: S3 presigned URL service
│   ├── SOCIO-702: Image upload and compression
│   ├── SOCIO-703: Voice note recording
│   ├── SOCIO-704: Voice note playback
│   ├── SOCIO-705: Video note recording
│   └── SOCIO-706: CloudFront CDN setup
│
└── 📋 SOCIO-80: Push Notifications
    ├── SOCIO-801: FCM integration (Android)
    ├── SOCIO-802: APNs integration (iOS)
    ├── SOCIO-803: Notification service (backend)
    ├── SOCIO-804: Deep linking setup
    └── SOCIO-805: Notification preferences UI

📦 SOCIO-3: Polish & Launch (Sprint 8-10)
├── 📋 SOCIO-90: User Profile & Settings
├── 📋 SOCIO-100: Moderation & Safety
├── 📋 SOCIO-110: Performance Optimization
└── 📋 SOCIO-120: App Store Submission
```

### Story point estimation guidelines

| Points | Complexity | Examples |
|--------|------------|----------|
| **1** | Trivial | Config change, copy update, simple bug fix |
| **2** | Simple | Single component, basic CRUD endpoint |
| **3** | Standard | Service with business logic, form with validation |
| **5** | Complex | Integration with external service, multi-step flow |
| **8** | Very Complex | New feature with multiple components, WebSocket flow |
| **13** | Epic-level | Full authentication system, real-time messaging core |

### Acceptance criteria template

```markdown
## Story: SOCIO-301 - Socket.io Gateway Setup

**As a** user
**I want** real-time messaging capability
**So that** I can chat with room members instantly

### Acceptance Criteria

- [ ] WebSocket gateway accepts authenticated connections
- [ ] Gateway validates JWT from handshake auth
- [ ] Invalid/expired tokens result in disconnection with error
- [ ] Client can subscribe to room channels
- [ ] Messages broadcast to all room members
- [ ] Connection/disconnection logged for debugging

### Technical Notes
- Follow pattern in existing chat.gateway.ts template
- Use @nestjs/websockets decorators
- Integrate with Redis for multi-instance support

### Definition of Done
- [ ] Code reviewed and approved
- [ ] Unit tests with 80%+ coverage
- [ ] Integration test for WebSocket flow
- [ ] Documentation updated
- [ ] Deployed to staging
```

---

## MVP timeline estimate

| Sprint | Duration | Focus | Key Deliverables |
|--------|----------|-------|------------------|
| **1** | 2 weeks | Foundation | Monorepo setup, basic auth, database schema |
| **2** | 2 weeks | Auth Complete | OAuth providers, phone verification, token management |
| **3** | 2 weeks | Real-time Core | WebSocket gateway, Redis pub/sub, message persistence |
| **4** | 2 weeks | Location Features | PostGIS queries, room discovery, map integration |
| **5** | 2 weeks | Chat UI | Message components, infinite scroll, presence |
| **6** | 2 weeks | Voice/Video | 100ms integration, 1:1 calls |
| **7** | 2 weeks | Media | Image/voice notes, S3 uploads |
| **8** | 2 weeks | Push & Polish | FCM/APNs, deep linking, bug fixes |
| **9** | 1 week | Testing | E2E tests, load testing, security audit |
| **10** | 1 week | Launch Prep | App store submission, production deployment |

**Total: 18 weeks (4.5 months)** for full MVP

**Accelerated timeline with Claude Code assistance: 12-14 weeks** based on:
- 40% faster initial scaffolding and boilerplate
- Automated test generation
- Consistent pattern implementation across codebase
- Reduced context-switching during development

---

## Cost projection summary

### Development phase (First 12 months)

| Resource | Monthly Cost | Notes |
|----------|--------------|-------|
| AWS Free Tier services | $0 | EC2, RDS, S3 covered |
| ElastiCache Redis | $11.68 | Not in Free Tier |
| ALB | $16.43 | Not in Free Tier |
| 100ms | $0 | Within free 10K minutes |
| Twilio Verify | ~$25 | ~500 verifications |
| Domain + SSL | ~$15 | Route 53 + ACM |
| **Monthly Total** | **~$68** | |

### Post-launch scaling (10K users)

| Resource | Monthly Cost |
|----------|--------------|
| EC2 (2x t3.small) | ~$30 |
| RDS (db.t3.small) | ~$25 |
| ElastiCache (cache.t3.small) | ~$24 |
| ALB + data transfer | ~$50 |
| S3 + CloudFront | ~$30 |
| 100ms (50K minutes) | ~$160 |
| **Monthly Total** | **~$320** |

---

## Next steps

1. **Initialize repository** using the provided monorepo structure
2. **Create CLAUDE.md files** in each app/package directory
3. **Provision AWS resources** in il-central-1 using CloudFormation/Terraform
4. **Begin Sprint 1** with project setup epic
5. **Establish development workflow** with Claude Code slash commands

This specification provides a complete technical foundation for building Socio. The architecture supports rapid MVP development while maintaining a clear path to scale as the Tel Aviv LGBT community adopts the platform.