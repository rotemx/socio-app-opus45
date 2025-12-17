-- Search Indexes for pg_trgm Full-Text Search
-- Run this migration after ensuring pg_trgm extension is enabled

-- Enable pg_trgm extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =====================================================
-- CHAT ROOMS SEARCH INDEXES
-- =====================================================

-- GIN index on room name for trigram similarity search
CREATE INDEX IF NOT EXISTS idx_chat_rooms_name_trgm
ON chat_rooms USING GIN (name gin_trgm_ops);

-- GIN index on room description for trigram similarity search
CREATE INDEX IF NOT EXISTS idx_chat_rooms_description_trgm
ON chat_rooms USING GIN (description gin_trgm_ops);

-- =====================================================
-- MESSAGES SEARCH INDEXES
-- =====================================================

-- GIN index on message content for trigram similarity search
-- Only applies to text messages
CREATE INDEX IF NOT EXISTS idx_messages_content_trgm
ON messages USING GIN (content gin_trgm_ops);

-- Partial index for active text messages (optimizes search queries)
CREATE INDEX IF NOT EXISTS idx_messages_content_text_active
ON messages USING GIN (content gin_trgm_ops)
WHERE is_deleted = false AND content_type = 'TEXT';

-- =====================================================
-- USERS SEARCH INDEXES
-- =====================================================

-- GIN index on username for trigram similarity search
CREATE INDEX IF NOT EXISTS idx_users_username_trgm
ON users USING GIN (username gin_trgm_ops);

-- GIN index on display_name for trigram similarity search
CREATE INDEX IF NOT EXISTS idx_users_display_name_trgm
ON users USING GIN (display_name gin_trgm_ops);

-- =====================================================
-- STATISTICS (Run after indexes are created)
-- =====================================================

-- Analyze tables to update query planner statistics
ANALYZE chat_rooms;
ANALYZE messages;
ANALYZE users;
