# SOCIO-104: NestJS Backend Scaffold Implementation

## Ticket Summary
**Ticket**: SOCIO-104
**Title**: Create NestJS Backend Scaffold
**Status**: Completed
**Date**: 2025-11-27

## Overview
This ticket implemented the complete NestJS backend scaffold for the Socio chat application. The scaffold includes all core modules, database schema, authentication infrastructure, and common utilities needed to build the full application.

## Architecture

### Module Structure
```
apps/backend/src/
├── common/
│   ├── decorators/
│   │   ├── current-user.decorator.ts   # @CurrentUser() for HTTP requests
│   │   ├── public.decorator.ts         # @Public() to bypass auth
│   │   ├── roles.decorator.ts          # @Roles() for RBAC
│   │   └── index.ts
│   ├── filters/
│   │   ├── http-exception.filter.ts    # Standard HTTP error responses
│   │   ├── ws-exception.filter.ts      # WebSocket error handling
│   │   └── index.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts           # HTTP JWT authentication
│   │   ├── ws-auth.guard.ts            # WebSocket JWT authentication
│   │   └── index.ts
│   └── interceptors/
│       ├── logging.interceptor.ts      # Request/response logging
│       ├── timeout.interceptor.ts      # Request timeout handling
│       ├── transform.interceptor.ts    # Standard API response wrapper
│       └── index.ts
├── config/
│   ├── config.module.ts                # Global config module
│   ├── config.service.ts               # Type-safe config access
│   ├── env.validation.ts               # Zod schema for env vars
│   └── index.ts
├── database/
│   ├── database.module.ts              # Database module
│   ├── prisma.service.ts               # Prisma client wrapper
│   └── index.ts
├── modules/
│   ├── auth/                           # Authentication (scaffold)
│   ├── users/                          # User management (full)
│   ├── rooms/                          # Chat rooms (full)
│   ├── messages/                       # Messages (full)
│   ├── presence/                       # Online status (full)
│   └── chat/                           # WebSocket gateway (existing)
├── app.module.ts                       # Root module
└── main.ts                             # Application entry
```

### Database Schema
Located at `apps/backend/prisma/schema.prisma`:

| Model | Purpose |
|-------|---------|
| User | User accounts with auth providers, profile, location |
| ChatRoom | Chat rooms with location, settings, discovery |
| RoomMember | Room membership with roles |
| Message | Chat messages with content types |
| ReadReceipt | Message read tracking |
| UserPresence | Online/offline status |
| RefreshToken | JWT refresh token storage |

### Key Design Decisions

1. **Zod for Validation**: All DTOs use `nestjs-zod` for runtime validation with type inference
2. **Global Auth Guard**: `JwtAuthGuard` is registered globally; use `@Public()` to bypass
3. **Soft Deletes**: Messages use `isDeleted` flag instead of hard deletes
4. **Location Storage**: Uses PostGIS-compatible JSON format for spatial queries
5. **Token Rotation**: Refresh tokens stored with family tracking for security

## Files Created

### Infrastructure
- `apps/backend/src/common/guards/jwt-auth.guard.ts`
- `apps/backend/src/common/guards/ws-auth.guard.ts`
- `apps/backend/src/common/decorators/current-user.decorator.ts`
- `apps/backend/src/common/decorators/public.decorator.ts`
- `apps/backend/src/common/decorators/roles.decorator.ts`
- `apps/backend/src/common/interceptors/logging.interceptor.ts`
- `apps/backend/src/common/interceptors/transform.interceptor.ts`
- `apps/backend/src/common/interceptors/timeout.interceptor.ts`
- `apps/backend/src/common/filters/http-exception.filter.ts`
- `apps/backend/src/common/filters/ws-exception.filter.ts`
- `apps/backend/src/config/env.validation.ts`
- `apps/backend/src/config/config.service.ts`
- `apps/backend/src/config/config.module.ts`
- `apps/backend/src/database/prisma.service.ts`
- `apps/backend/src/database/database.module.ts`

### Feature Modules
- `apps/backend/src/modules/auth/` (controller, service, DTOs, module)
- `apps/backend/src/modules/users/` (controller, service, DTOs, module)
- `apps/backend/src/modules/rooms/` (controller, service, DTOs, module)
- `apps/backend/src/modules/messages/` (controller, service, DTOs, module)
- `apps/backend/src/modules/presence/` (controller, service, DTOs, module)

### Testing
- `apps/backend/jest.config.ts`
- `apps/backend/test/setup.ts`
- `apps/backend/test/utils/test-helpers.ts`

### Database
- `apps/backend/prisma/schema.prisma` (full schema with all models)

## API Endpoints

### Auth (`/auth`) - Scaffold
| Method | Path | Description |
|--------|------|-------------|
| POST | /register | Register new user |
| POST | /login | Login with email/password |
| POST | /refresh | Refresh access token |
| POST | /guest | Create guest user |
| POST | /phone/request | Request phone verification |
| POST | /phone/confirm | Confirm phone verification |
| POST | /oauth/callback | OAuth callback handler |

### Users (`/users`)
| Method | Path | Description |
|--------|------|-------------|
| GET | /me | Get current user profile |
| PATCH | /me | Update profile |
| PUT | /me/location | Update location |
| PUT | /me/settings | Update settings |
| GET | /:id | Get user by ID |
| GET | /username/:username | Get user by username |
| GET | /search | Search users |

### Rooms (`/rooms`)
| Method | Path | Description |
|--------|------|-------------|
| GET | /discover | Find nearby rooms |
| POST | / | Create room |
| GET | /my | Get user's rooms |
| GET | /:id | Get room details |
| PATCH | /:id | Update room |
| DELETE | /:id | Delete room |
| POST | /:id/join | Join room |
| POST | /:id/leave | Leave room |
| GET | /:id/members | Get room members |
| PATCH | /:id/members/:userId/role | Update member role |

### Messages (`/messages`)
| Method | Path | Description |
|--------|------|-------------|
| GET | / | Get messages (with pagination) |
| POST | / | Send message |
| POST | /read | Mark messages as read |
| GET | /unread/:roomId | Get unread count |
| GET | /:id | Get single message |
| PATCH | /:id | Edit message |
| DELETE | /:id | Delete message |

### Presence (`/presence`)
| Method | Path | Description |
|--------|------|-------------|
| GET | /me | Get own presence |
| PUT | /status | Update status |
| POST | /heartbeat | Send heartbeat |
| GET | /:userId | Get user presence |
| POST | /batch | Get multiple users presence |
| GET | /room/:roomId | Get room online users |

## What's NOT Implemented (By Design)

These items are scaffolded but require implementation in future tickets:

1. **JWT Verification**: Guards have TODO comments; need `@nestjs/jwt` integration
2. **Password Hashing**: AuthService needs bcrypt implementation
3. **OAuth Flows**: Google/Apple OAuth not implemented
4. **Phone Verification**: Twilio integration not implemented
5. **Redis Caching**: Config exists but not utilized
6. **Rate Limiting**: Not implemented
7. **File Uploads**: S3 config exists but not utilized

## Environment Variables Required

```env
# Required
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=your-secret-at-least-32-chars
CORS_ORIGIN=http://localhost:3000

# Optional
NODE_ENV=development
PORT=3000
REDIS_URL=redis://localhost:6379
JWT_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
```

## How to Extend

### Adding a New Module
1. Create folder in `src/modules/your-module/`
2. Create files: `your-module.module.ts`, `your-module.service.ts`, `your-module.controller.ts`
3. Create DTOs in `dto/your-module.dto.ts` using Zod schemas
4. Export from `index.ts`
5. Import in `app.module.ts`

### Adding a Protected Route
Routes are protected by default. Use `@Public()` decorator to make them public:
```typescript
@Public()
@Get('public-endpoint')
async publicEndpoint() { ... }
```

### Adding Role-Based Access
Use the `@Roles()` decorator (requires implementing RolesGuard):
```typescript
@Roles('ADMIN', 'MODERATOR')
@Delete(':id')
async deleteItem() { ... }
```

## Code Review Summary

Ran 4 rounds of CodeRabbit reviews with fixes including:
- Fixed route conflicts (specific routes before parameterized)
- Fixed type-only imports breaking NestJS DI
- Added GIN index for tags array
- Added date range validation
- Added empty string validation for tokens
- Fixed Bearer prefix parsing in WebSocket guard
- Added proper error handling in PrismaService

## Testing

```bash
# Run tests
pnpm test

# Run with coverage
pnpm test:cov

# Coverage threshold: 80%
```

Test utilities available in `test/utils/`:
- `createMockPrismaService()` - Mock Prisma client
- `createMockUser()` - Mock user data
- `createMockJwtPayload()` - Mock JWT payload
- `createMockChatRoom()` - Mock room data
- `createMockMessage()` - Mock message data

## Related Tickets
- **SOCIO-103**: ESLint and Prettier setup (prerequisite)
- **SOCIO-105**: Implement JWT authentication (follow-up)
- **SOCIO-106**: Implement WebSocket gateway (follow-up)
