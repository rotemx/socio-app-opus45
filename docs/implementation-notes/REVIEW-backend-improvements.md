# Backend Code Review & Improvements

## Summary

Comprehensive code review of the Socio backend identifying and fixing bugs, performance issues, and security gaps.

## Issues Found & Fixed

### 1. N+1 Query Bug in ChatService.getRoomMessages()

**File**: `apps/backend/src/modules/chat/chat.service.ts`

**Problem**: Nested `await` inside Prisma `where` clause caused an extra DB query for every paginated request.

```typescript
// BEFORE (buggy - N+1 query)
const messages = await this.prisma.message.findMany({
  where: {
    roomId,
    isDeleted: false,
    ...(before && {
      createdAt: {
        lt: (await this.prisma.message.findUnique({ where: { id: before } }))?.createdAt,
      },
    }),
  },
  // ...
});
```

**Fix**: Fetch cursor message separately before building the query.

```typescript
// AFTER (fixed)
let cursorDate: Date | undefined;
if (before) {
  const cursorMessage = await this.prisma.message.findUnique({
    where: { id: before },
    select: { createdAt: true },
  });
  cursorDate = cursorMessage?.createdAt;
}

const messages = await this.prisma.message.findMany({
  where: {
    roomId,
    isDeleted: false,
    ...(cursorDate && { createdAt: { lt: cursorDate } }),
  },
  // ...
});
```

### 2. Inefficient Memory Deduplication in PresenceService

**File**: `apps/backend/src/modules/presence/presence.service.ts`

**Problem**: `getMultiplePresence()` fetched all presence records then deduplicated in memory.

**Fix**: Use PostgreSQL `DISTINCT ON` for efficient single-query deduplication.

```typescript
// AFTER (uses efficient SQL)
const presences = await this.prisma.$queryRaw<Array<{...}>>`
  SELECT DISTINCT ON ("userId") "userId", "status", "lastSeenAt"
  FROM "UserPresence"
  WHERE "userId" = ANY(${userIds}::uuid[])
  ORDER BY "userId", "lastSeenAt" DESC
`;
```

### 3. Missing Rate Limiting on REST API (Security)

**Problem**: Auth endpoints (login, register, etc.) had no rate limiting, making them vulnerable to brute force attacks.

**Fix**: Created rate limiting infrastructure using Redis sliding window algorithm.

**Files Added**:
- `apps/backend/src/common/decorators/rate-limit.decorator.ts` - `@RateLimit()` decorator
- `apps/backend/src/common/guards/rate-limit.guard.ts` - Guard implementation
- `apps/backend/src/common/guards/rate-limit.guard.spec.ts` - 10 unit tests

**Applied to Auth Controller**:
| Endpoint | Rate Limit |
|----------|-----------|
| POST /auth/login | 5/minute |
| POST /auth/register | 3/minute |
| POST /auth/refresh | 20/minute |
| POST /auth/guest | 10/minute |
| POST /auth/phone/* | 3-5/minute |
| POST /auth/google/* | 10/minute |
| POST /auth/apple/* | 10/minute |
| POST /auth/oauth/* | 10/minute |

**Features**:
- Redis sliding window for accurate rate limiting
- Per-IP or per-user rate limiting
- X-RateLimit-* headers in responses
- Retry-After header when exceeded
- Fail-open on Redis errors (allows request rather than blocking)
- X-Forwarded-For support for reverse proxies

## Other Observations (Not Fixed - Low Priority)

1. **PostGIS TODO**: `RoomsService.findNearbyRooms()` has TODO for spatial queries
2. **Password Complexity**: Only length validation, no complexity requirements
3. **Missing Unit Tests**: RoomsService, UsersService, PresenceService lack test files

## Test Results

- **186 tests passing** (176 existing + 10 new rate limit guard tests)
- TypeScript: Clean
- ESLint: Clean

## Files Modified

| File | Change |
|------|--------|
| `apps/backend/src/modules/chat/chat.service.ts` | Fixed N+1 query |
| `apps/backend/src/modules/presence/presence.service.ts` | Optimized SQL query |
| `apps/backend/src/modules/auth/auth.controller.ts` | Added rate limiting |
| `apps/backend/src/common/decorators/rate-limit.decorator.ts` | New file |
| `apps/backend/src/common/guards/rate-limit.guard.ts` | New file |
| `apps/backend/src/common/guards/rate-limit.guard.spec.ts` | New file |
| `apps/backend/src/common/decorators/index.ts` | Export rate limit |
| `apps/backend/src/common/guards/index.ts` | Export rate limit guard |
