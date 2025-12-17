# SOC-97: Search API endpoints

| Field | Value |
|-------|-------|
| Epic | E08-search |
| Project | MVP Foundation |
| Status | done |
| Priority | Medium |
| Story Points | 5 |
| Created | 2025-11-29 |
| Completed | 2025-12-17 |

## Description

Implement search API endpoints with PostgreSQL full-text search.

## Acceptance Criteria

- [x] GET /search/rooms - Search rooms by name, description, tags
- [x] GET /search/messages - Search messages within a room
- [x] GET /search/users - Search users by name, username
- [x] Full-text search with pg_trgm
- [x] Result highlighting
- [x] Pagination support
- [x] Minimum 3 character query
- [x] Response time <500ms

---

## Implementation Notes

### Files Created

- `apps/backend/src/modules/search/search.module.ts` - NestJS module
- `apps/backend/src/modules/search/search.controller.ts` - REST endpoints
- `apps/backend/src/modules/search/search.service.ts` - Search logic with pg_trgm
- `apps/backend/src/modules/search/dto/search.dto.ts` - Zod DTOs and response types
- `apps/backend/src/modules/search/index.ts` - Module exports
- `apps/backend/prisma/search-indexes.sql` - GIN index migration

### Features

1. **Room Search** (`GET /search/rooms`)
   - Searches name, description, and tags
   - Fuzzy matching with pg_trgm similarity
   - ILIKE fallback for exact matches
   - ts_headline for result highlighting
   - Cursor-based pagination

2. **Message Search** (`GET /search/messages`)
   - Requires room membership (authorization check)
   - Searches message content in TEXT messages
   - Result highlighting
   - Sorted by relevance + recency

3. **User Search** (`GET /search/users`)
   - Searches username and display name
   - Filters: active, not shadow-banned, not guest, discoverable
   - Result highlighting

### Technical Details

- **Similarity threshold**: 0.1 (configurable)
- **Cache TTL**: 5 minutes for rooms/users, 2.5 minutes for messages
- **Rate limits**: 60/min for rooms/users, 30/min for messages
- **Min query length**: 3 characters
- **Max results per page**: 50

### Database Indexes

GIN indexes added via `prisma/search-indexes.sql`:
- `idx_chat_rooms_name_trgm` - Room name trigram
- `idx_chat_rooms_description_trgm` - Room description trigram
- `idx_messages_content_trgm` - Message content trigram
- `idx_messages_content_text_active` - Partial index for active text messages
- `idx_users_username_trgm` - Username trigram
- `idx_users_display_name_trgm` - Display name trigram

### To Apply Indexes

```bash
cd apps/backend
psql $DATABASE_URL -f prisma/search-indexes.sql
```
