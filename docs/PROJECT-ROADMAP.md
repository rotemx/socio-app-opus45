# Socio Project Roadmap

## Current Sprint Status

**Current Phase**: MVP Foundation (Sprint 1-2)
**Last Updated**: 2025-11-29

---

## Epic Overview

| Epic | Title | Status | Progress |
|------|-------|--------|----------|
| SOCIO-10 | Project Setup & Infrastructure | **Complete** | 8/8 (100%) |
| SOCIO-20 | Authentication System | In Progress | 7/8 (87%) |
| SOCIO-30 | Real-Time Messaging Core | In Progress | 2/7 (28%) |
| SOCIO-40 | Room Discovery & Geolocation | Partial | 2/7 (28%) |
| SOCIO-50 | Chat Interface | Not Started | 0/6 (0%) |

---

## SOCIO-10: Project Setup & Infrastructure

### Completed Tickets

| Ticket | Title | Points | Status | Notes |
|--------|-------|--------|--------|-------|
| SOCIO-101 | Initialize monorepo with Turborepo | 3 | ✅ Done | Turborepo + pnpm workspaces |
| SOCIO-102 | Configure TypeScript base config | 2 | ✅ Done | Strict mode, path aliases |
| SOCIO-103 | Setup ESLint and Prettier | 2 | ✅ Done | Shared configs in packages/config |
| SOCIO-104 | Create NestJS backend scaffold | 8 | ✅ Done | Full module structure, guards, decorators |
| SOCIO-105 | Setup Prisma with PostgreSQL/PostGIS | 5 | ✅ Done | Docker services, spatial queries, seeding |
| SOCIO-106 | Initialize React Native project | 5 | ✅ Done | Navigation, NativeWind, screens scaffold |
| SOCIO-107 | Configure AWS Free Tier resources | 8 | ✅ Done | Terraform, S3Service, SecretsService |

### All Complete

| Ticket | Title | Points | Status | Notes |
|--------|-------|--------|--------|-------|
| SOCIO-108 | Setup GitHub Actions CI pipeline | 5 | ✅ Done | CI/CD, CodeQL, Dependabot, PR template |

---

## SOCIO-108: GitHub Actions CI Pipeline

### Description
Setup comprehensive CI/CD pipeline with GitHub Actions for automated testing, linting, and deployment.

### Acceptance Criteria
- [x] Detect changes per workspace (backend, mobile, web, packages)
- [x] Run backend tests with PostgreSQL/PostGIS and Redis services
- [x] Run mobile lint and typecheck verification
- [x] Run web build and lint
- [x] Run shared packages tests
- [x] Code coverage reporting to Codecov
- [x] PR checks block merge on failure
- [x] CodeQL security scanning
- [x] Dependabot configuration for automated dependency updates
- [x] PR template for consistent contributions
- [ ] Staging deployment on develop branch merge (deferred - requires AWS secrets)

**Out of Scope** (follow-up tickets):
- E2E test automation (SOCIO-109) - Requires Playwright/Cypress setup
- Production deployment workflow (SOCIO-110) - Requires production infrastructure

### Sub-tasks

| Sub-task | Description | Points | Priority |
|----------|-------------|--------|----------|
| SOCIO-108-1 | Create workflow file with change detection | 2 | High |
| SOCIO-108-2 | Configure backend test job with services | 2 | High |
| SOCIO-108-3 | Configure mobile build verification | 2 | Medium |
| SOCIO-108-4 | Configure web build and lint job | 1 | Medium |
| SOCIO-108-5 | Add Codecov integration | 1 | Low |
| SOCIO-108-6 | Configure staging deployment job | 2 | Low |

### Technical Notes
- Use `dorny/paths-filter` for workspace change detection
- PostgreSQL service: `postgis/postgis:16-3.4`
- Redis service: `redis:7`
- Cache pnpm dependencies
- Parallel job execution for speed

---

## SOCIO-20: Authentication System

### Epic Overview
Implement complete authentication system with multiple providers, JWT tokens, and mobile integration.

**Epic Points**: 34 total
**Priority**: High (blocks all user-facing features)

### Tickets

| Ticket | Title | Points | Priority | Dependencies | Status |
|--------|-------|--------|----------|--------------|--------|
| SOCIO-201 | Implement JWT auth service | 5 | Critical | SOCIO-104 | ✅ Done |
| SOCIO-202 | Create auth guards and decorators | 3 | Critical | SOCIO-201 | ✅ Done |
| SOCIO-203 | Google OAuth integration | 5 | High | SOCIO-201 | ✅ Done |
| SOCIO-204 | Apple Sign-In integration | 5 | High | SOCIO-201 | ✅ Done |
| SOCIO-205 | Phone verification with Twilio | 5 | Medium | SOCIO-201 | Pending |
| SOCIO-206 | Guest/anonymous user flow | 3 | Medium | SOCIO-201 | ✅ Done (in 201) |
| SOCIO-207 | Mobile login screens | 5 | High | SOCIO-201, SOCIO-106 | ✅ Done |
| SOCIO-208 | Token refresh WebSocket integration | 3 | Medium | SOCIO-201, SOCIO-301 | ✅ Done |

### SOCIO-201: Implement JWT Auth Service (Critical)

**Points**: 5 | **Priority**: Critical

#### Description
Complete JWT authentication implementation with access/refresh token flow, password hashing, and token validation.

#### Acceptance Criteria
- [x] JWT access token generation (15-min expiry, configurable via JWT_EXPIRY)
- [x] JWT refresh token generation (7-day expiry, configurable via JWT_REFRESH_EXPIRY)
- [x] Password hashing with bcrypt (12 rounds)
- [x] Token validation and extraction (JwtStrategy + verifyAccessToken)
- [x] Token refresh with rotation
- [x] Refresh token family tracking (detect reuse)
- [x] Logout with token invalidation
- [x] Guest user creation and conversion
- [x] Unit tests (32 passing)

#### Sub-taskss
| Sub-task | Description | Points |
|----------|-------------|--------|
| SOCIO-201-1 | Install @nestjs/jwt, @nestjs/passport, bcrypt | 1 |
| SOCIO-201-2 | Create JwtStrategy with validation | 2 |
| SOCIO-201-3 | Implement password hashing utilities | 1 |
| SOCIO-201-4 | Implement token generation in AuthService | 2 |
| SOCIO-201-5 | Implement token refresh with rotation | 2 |
| SOCIO-201-6 | Write unit tests (80%+ coverage) | 2 |

#### Technical Notes
```typescript
// Token payload structure
interface AccessTokenPayload {
  sub: string;      // User ID
  type: 'access';
  roles: string[];
  deviceId: string;
  iat: number;
  exp: number;
}

interface RefreshTokenPayload {
  sub: string;
  type: 'refresh';
  family: string;   // For rotation detection
  iat: number;
  exp: number;
}
```

### SOCIO-207: Mobile Login Screens (High)

**Points**: 5 | **Priority**: High

#### Description
Implement login/register screens for React Native with form validation, social login buttons, and phone verification UI.

#### Acceptance Criteria
- [x] Login screen with email/password
- [x] Register screen with validation
- [x] Social login buttons (Google, Apple)
- [x] Phone number input with country code
- [x] OTP verification screen
- [x] Loading states and error handling
- [x] Secure token storage (interface ready, needs react-native-keychain)
- [x] Navigation to home on success

#### Sub-tasks
| Sub-task | Description | Points |
|----------|-------------|--------|
| SOCIO-207-1 | Create LoginScreen component | 2 |
| SOCIO-207-2 | Create RegisterScreen component | 2 |
| SOCIO-207-3 | Create PhoneVerificationScreen | 2 |
| SOCIO-207-4 | Implement authStore with Zustand | 2 |
| SOCIO-207-5 | Add secure token storage | 1 |
| SOCIO-207-6 | Write component tests | 1 |

---

## SOCIO-30: Real-Time Messaging Core

### Epic Overview
Implement real-time messaging infrastructure with Socket.io, Redis pub/sub, and message persistence.

**Epic Points**: 31 total
**Priority**: High (core feature)

### Tickets

| Ticket | Title | Points | Priority | Dependencies | Status |
|--------|-------|--------|----------|--------------|--------|
| SOCIO-301 | Socket.io gateway setup | 5 | Critical | SOCIO-201, SOCIO-104 | ✅ Done |
| SOCIO-302 | Redis pub/sub integration | 5 | Critical | SOCIO-301 | ✅ Done |
| SOCIO-303 | Message service with persistence | 5 | High | SOCIO-301 | Pending |
| SOCIO-304 | Presence tracking service | 5 | High | SOCIO-301, SOCIO-302 | Pending |
| SOCIO-305 | Typing indicators | 3 | Medium | SOCIO-301 | Pending |
| SOCIO-306 | Read receipts implementation | 3 | Medium | SOCIO-303 | Pending |
| SOCIO-307 | Rate limiting middleware | 5 | High | SOCIO-301 | Pending |

### SOCIO-301: Socket.io Gateway Setup (Critical)

**Points**: 5 | **Priority**: Critical

#### Description
Implement authenticated WebSocket gateway with Socket.io for real-time messaging, room subscriptions, and event handling.

#### Acceptance Criteria
- [x] WebSocket gateway accepts connections on /socket.io
- [x] JWT validation on handshake
- [x] Invalid tokens disconnect with error
- [x] Room join/leave with validation
- [x] Message broadcast to room members
- [x] Connection/disconnection event handling
- [x] Graceful reconnection support (30s grace)

#### Sub-tasks
| Sub-task | Description | Points |
|----------|-------------|--------|
| SOCIO-301-1 | Create ChatGateway with @WebSocketGateway | 2 |
| SOCIO-301-2 | Implement handleConnection with JWT | 2 |
| SOCIO-301-3 | Add room:join and room:leave handlers | 2 |
| SOCIO-301-4 | Add message:send handler | 2 |
| SOCIO-301-5 | Create WebSocket client in packages/shared | 2 |
| SOCIO-301-6 | Write integration tests | 2 |

#### Technical Notes
```typescript
// Gateway events
@WebSocketGateway({ cors: true })
export class ChatGateway {
  @SubscribeMessage('room:join')
  handleJoinRoom(client: Socket, roomId: string) {}

  @SubscribeMessage('room:leave')
  handleLeaveRoom(client: Socket, roomId: string) {}

  @SubscribeMessage('message:send')
  handleMessage(client: Socket, payload: SendMessageDto) {}
}

// Client events to emit
- 'room:joined' - Confirmation + room state
- 'room:left' - Confirmation
- 'message:new' - New message broadcast
- 'user:joined' - User joined room
- 'user:left' - User left room
- 'error' - Error with code and message
```

### SOCIO-302: Redis Pub/Sub Integration (Critical)

**Points**: 5 | **Priority**: Critical

#### Description
Implement Redis pub/sub integration for multi-instance Socket.io support, presence caching, and rate limiting infrastructure.

#### Acceptance Criteria
- [x] Redis adapter for multi-instance Socket.io
- [x] Presence caching with TTL
- [x] Room membership tracking in Redis
- [x] Rate limiting infrastructure
- [x] Graceful degradation to database
- [x] Unit tests for Redis service (30 tests)
- [x] Integration with ChatGateway
- [x] Integration with PresenceService

#### Sub-tasks
| Sub-task | Description | Points |
|----------|-------------|--------|
| SOCIO-302-1 | Create Redis module and service | 2 |
| SOCIO-302-2 | Add @socket.io/redis-adapter | 2 |
| SOCIO-302-3 | Update ChatGateway for Redis | 2 |
| SOCIO-302-4 | Update PresenceService for Redis | 2 |
| SOCIO-302-5 | Write unit tests | 2 |

#### Technical Notes
- Uses `ioredis` for Redis client
- Uses `@socket.io/redis-adapter` for Socket.io clustering
- Redis keys prefixed by type (presence, session, room, user)
- Pub/sub channels for real-time updates across instances
- 5-minute TTL for presence data

---

## SOCIO-40: Room Discovery & Geolocation

### Epic Overview
Implement location-based room discovery with PostGIS spatial queries and mobile location handling.

**Epic Points**: 28 total
**Priority**: High (differentiating feature)

### Completed Tickets

| Ticket | Title | Points | Status |
|--------|-------|--------|--------|
| SOCIO-401 | PostGIS spatial queries | 5 | ✅ Done (SOCIO-105) |
| SOCIO-402 | Room CRUD endpoints | 3 | ✅ Done (SOCIO-104) |

### Remaining Tickets

| Ticket | Title | Points | Priority | Dependencies |
|--------|-------|--------|----------|--------------|
| SOCIO-403 | Dynamic room location calculation | 3 | Medium | SOCIO-402 |
| SOCIO-404 | Nearby rooms discovery API | 5 | High | SOCIO-401 |
| SOCIO-405 | Location permission handling (mobile) | 3 | High | SOCIO-106 |
| SOCIO-406 | Room discovery map view | 5 | Medium | SOCIO-404, SOCIO-405 |
| SOCIO-407 | Room list with distance display | 3 | High | SOCIO-404 |

### SOCIO-405: Location Permission Handling (High)

**Points**: 3 | **Priority**: High

#### Description
Implement location permission requests and handling for iOS and Android with graceful degradation.

#### Acceptance Criteria
- [ ] Request location permission on first launch
- [ ] Handle "always", "when in use", "denied" states
- [ ] Show explanation dialog before permission request
- [ ] Navigate to settings if denied
- [ ] Background location for room proximity alerts
- [ ] Update location on app foreground

#### Sub-tasks
| Sub-task | Description | Points |
|----------|-------------|--------|
| SOCIO-405-1 | Install react-native-permissions | 1 |
| SOCIO-405-2 | Create useLocation hook | 2 |
| SOCIO-405-3 | Create PermissionScreen component | 1 |
| SOCIO-405-4 | Handle background location updates | 2 |

---

## SOCIO-50: Chat Interface

### Epic Overview
Build the chat UI components with real-time updates, infinite scroll, and media support.

**Epic Points**: 21 total
**Priority**: High (core UX)

### Tickets

| Ticket | Title | Points | Priority | Dependencies |
|--------|-------|--------|----------|--------------|
| SOCIO-501 | MessageBubble component | 3 | High | SOCIO-106 |
| SOCIO-502 | ChatInput with media support | 5 | High | SOCIO-501 |
| SOCIO-503 | Message list with infinite scroll | 5 | High | SOCIO-501, SOCIO-303 |
| SOCIO-504 | Room header with members | 2 | Medium | SOCIO-304 |
| SOCIO-505 | Zustand chat store | 3 | High | SOCIO-301 |
| SOCIO-506 | TanStack Query integration | 3 | High | SOCIO-303 |

---

## Sprint Planning

### Sprint 2 (Current) - Complete Foundation

**Goal**: Complete infrastructure setup and start authentication

| Ticket | Title | Points | Owner |
|--------|-------|--------|-------|
| SOCIO-108 | GitHub Actions CI pipeline | 5 | - |
| SOCIO-201 | Implement JWT auth service | 5 | - |
| SOCIO-202 | Create auth guards and decorators | 3 | - |

**Total Points**: 13

### Sprint 3 - Authentication & WebSocket

**Goal**: Complete auth providers and start real-time messaging

| Ticket | Title | Points | Owner |
|--------|-------|--------|-------|
| SOCIO-203 | Google OAuth integration | 5 | - |
| SOCIO-204 | Apple Sign-In integration | 5 | - |
| SOCIO-207 | Mobile login screens | 5 | - |
| SOCIO-301 | Socket.io gateway setup | 5 | - |

**Total Points**: 20

### Sprint 4 - Real-Time Core

**Goal**: Complete messaging infrastructure

| Ticket | Title | Points | Owner |
|--------|-------|--------|-------|
| SOCIO-302 | Redis pub/sub integration | 5 | - |
| SOCIO-303 | Message service with persistence | 5 | - |
| SOCIO-304 | Presence tracking service | 5 | - |
| SOCIO-307 | Rate limiting middleware | 5 | - |

**Total Points**: 20

### Sprint 5 - Chat UI & Discovery

**Goal**: Build chat interface and location features

| Ticket | Title | Points | Owner |
|--------|-------|--------|-------|
| SOCIO-501 | MessageBubble component | 3 | - |
| SOCIO-502 | ChatInput with media support | 5 | - |
| SOCIO-503 | Message list with infinite scroll | 5 | - |
| SOCIO-405 | Location permission handling | 3 | - |
| SOCIO-407 | Room list with distance display | 3 | - |

**Total Points**: 19

---

## Backlog (Prioritized)

### High Priority (Sprint 6-7)
- SOCIO-205: Phone verification with Twilio
- SOCIO-206: Guest/anonymous user flow
- SOCIO-305: Typing indicators
- SOCIO-306: Read receipts
- SOCIO-505: Zustand chat store
- SOCIO-506: TanStack Query integration

### Medium Priority (Sprint 8+)
- SOCIO-403: Dynamic room location calculation
- SOCIO-406: Room discovery map view
- SOCIO-504: Room header with members
- SOCIO-208: Token refresh WebSocket integration

### Voice/Video Epic (Sprint 9-10)
- SOCIO-601: 100ms SDK setup
- SOCIO-602: Token generation service
- SOCIO-603: 1:1 voice call UI
- SOCIO-604: 1:1 video call UI

---

## Definition of Done

For all tickets:
- [ ] Code reviewed and approved
- [ ] Unit tests with 80%+ coverage
- [ ] Integration tests for API/WebSocket flows
- [ ] TypeScript strict mode compliance
- [ ] No ESLint errors
- [ ] Documentation updated (if applicable)
- [ ] Works on iOS and Android (mobile tickets)
- [ ] Deployed to staging
- [ ] Acceptance criteria verified

---

## Risk Register

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| PostGIS query performance at scale | High | Medium | Add query caching, implement pagination |
| WebSocket connection stability | High | Medium | Implement reconnection logic, heartbeat |
| Apple Sign-In review delays | Medium | Low | Submit early, have backup auth flow |
| 100ms SDK compatibility | Medium | Low | Test thoroughly before integration |
| AWS Free Tier limits | Low | Medium | Monitor usage, set billing alerts |

---

## Metrics & KPIs

### Development Velocity
- Target: 15-20 story points per sprint
- Current: Establishing baseline

### Code Quality
- Test coverage target: 80%+
- ESLint errors: 0
- TypeScript strict: Enabled

### Performance Targets
- API response time: <200ms (p95)
- WebSocket message latency: <100ms
- Room discovery query: <500ms
- App startup time: <3s
