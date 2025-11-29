# SOCIO-303: Message Service with Persistence

## Summary

Verified and completed the message service implementation with full persistence, CRUD operations, read receipts, and comprehensive unit tests.

## Implementation Status

The message service was **already fully implemented** as part of the initial project scaffolding. This ticket adds **30 unit tests** to complete the acceptance criteria.

## Existing Implementation

### MessagesService (`apps/backend/src/modules/messages/messages.service.ts`)

6 methods, 237 lines:

1. **`sendMessage()`** - Creates a message, validates membership, updates room activity
2. **`getMessages()`** - Retrieves paginated messages with cursor support
3. **`findById()`** - Fetches a single message
4. **`editMessage()`** - Updates message content (only sender can edit)
5. **`deleteMessage()`** - Soft delete with role-based authorization
6. **`markAsRead()`** - Updates read receipts for a user in a room
7. **`getUnreadCount()`** - Counts unread messages (excludes own messages)

### MessagesController (`apps/backend/src/modules/messages/messages.controller.ts`)

6 REST endpoints:
- `GET /messages` - Get messages with pagination
- `POST /messages` - Send a message
- `POST /messages/read` - Mark messages as read
- `GET /messages/unread/:roomId` - Get unread count
- `GET /messages/:id` - Get single message
- `PATCH /messages/:id` - Edit message
- `DELETE /messages/:id` - Delete message

### DTOs with Zod Validation (`apps/backend/src/modules/messages/dto/messages.dto.ts`)

- `SendMessageDto` - roomId, content (1-4000 chars), contentType, replyToId, metadata
- `EditMessageDto` - content validation
- `GetMessagesDto` - roomId, limit (1-100, default 50), cursor, before, after dates
- `MarkReadDto` - roomId, messageId

## Files Added

### `apps/backend/src/modules/messages/messages.service.spec.ts`

30 comprehensive unit tests covering:

| Category | Tests |
|----------|-------|
| sendMessage | 4 tests (success, auth, reply, metadata) |
| getMessages | 6 tests (pagination, cursor, date filtering) |
| findById | 3 tests (success, not found, deleted) |
| editMessage | 3 tests (success, auth, not found) |
| deleteMessage | 6 tests (sender, moderator, admin, creator, forbidden cases) |
| markAsRead | 1 test |
| getUnreadCount | 4 tests (no reads, with reads, zero count, exclude own) |
| error handling | 3 tests (database errors) |

## Key Features

### Message Persistence
- Full Prisma ORM integration with PostgreSQL
- Soft deletes with `isDeleted` flag
- Edit tracking with `isEdited` flag
- Metadata JSON field for extensibility

### Content Types
- TEXT, IMAGE, VIDEO, AUDIO, FILE, LOCATION
- Metadata field for rich content (attachments, thumbnails, etc.)

### Threading
- Reply-to functionality with `replyToId`
- Nested relations for thread display

### Authorization
- Room membership validation
- Role-based deletion (sender, moderator, admin, creator)
- Sender-only editing

### Read Receipts
- Per-user read status per room
- `ReadReceipt` model with `lastReadMessageId` and `lastReadAt`
- Excludes own messages from unread count

### Pagination
- Cursor-based pagination for efficient loading
- Configurable limit (1-100, default 50)
- Date range filtering (`before`, `after`)

## Database Schema

```prisma
model Message {
  id          String      @id @db.Uuid
  roomId      String      @db.Uuid
  senderId    String      @db.Uuid
  content     String
  contentType ContentType @default(TEXT)
  metadata    Json        @default("{}")
  replyToId   String?     @db.Uuid
  isEdited    Boolean     @default(false)
  isDeleted   Boolean     @default(false)
  createdAt   DateTime    @db.Timestamptz()
  updatedAt   DateTime    @db.Timestamptz()

  @@index([roomId, createdAt(sort: Desc)])
  @@index([senderId, createdAt(sort: Desc)])
}

model ReadReceipt {
  id               String   @id @db.Uuid
  roomId           String   @db.Uuid
  userId           String   @db.Uuid
  lastReadMessageId String?  @db.Uuid
  lastReadAt       DateTime @db.Timestamptz()

  @@unique([roomId, userId])
}
```

## Testing

- **176 total tests** (12 test suites)
- **31 new tests** for MessagesService (including date range filter test)
- TypeScript: Clean
- ESLint: Clean

## Integration Points

### ChatGateway Integration
- Messages sent via WebSocket call `chatService.sendMessage()`
- Broadcasts `message:new` event to room members
- Real-time delivery with Socket.io

### WebSocket Events
- `message:send` - Client sends message
- `message:new` - Server broadcasts to room
- `message:deleted` - Server notifies deletion
- `message:edited` - Server notifies edit

## Bug Fixes During Review

### 1. Date Range Filtering (CRITICAL)
**Problem**: When both `before` and `after` were provided, the spread operators overwrote each other - only `after` was applied.

**Fix**: Properly build the `createdAt` filter object:
```typescript
let createdAtFilter: { lt?: Date; gt?: Date } | undefined;
if (dto.before || dto.after) {
  createdAtFilter = {};
  if (dto.before) createdAtFilter.lt = dto.before;
  if (dto.after) createdAtFilter.gt = dto.after;
}
```

### 2. Rate Limiter Race Condition (Redis)
**Problem**: Two-pipeline approach had TOCTOU race condition between check and add.

**Fix**: Single atomic pipeline that adds entry first, then checks count:
```typescript
pipeline.zremrangebyscore(rateLimitKey, '-inf', windowStart);
pipeline.zadd(rateLimitKey, now, `${now}-${Math.random()}`);
pipeline.zcard(rateLimitKey);
pipeline.expire(rateLimitKey, windowSeconds);
```

## Status

**COMPLETED** - All acceptance criteria met.

## Acceptance Criteria Status

- [x] Message CRUD operations
- [x] Soft delete with authorization
- [x] Read receipts tracking
- [x] Unread count calculation
- [x] Cursor-based pagination
- [x] Date range filtering
- [x] Message threading (reply-to)
- [x] Rich content type support
- [x] Role-based authorization
- [x] Unit tests (30 tests)
- [x] Integration with ChatGateway
