# SOC-98: Search screen - Mobile

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

Implement global search screen for mobile with rooms, messages, and users.

## Acceptance Criteria

- [x] Search input with auto-focus
- [x] Tab switcher (Rooms, Messages, Users)
- [x] Debounced search (300ms)
- [x] Recent searches list
- [x] Search results with highlighting
- [x] Loading and empty states
- [x] Clear search button
- [x] Cancel/back navigation

---

## Implementation Notes

### Files Created

**Mobile App (`apps/mobile/src/screens/Search/`):**
- `SearchScreen.tsx` - Main container with debounced search state management
- `SearchInput.tsx` - Search input with auto-focus, clear, and cancel buttons
- `SearchTabs.tsx` - Tab switcher for Rooms/Messages/Users with result counts
- `RoomSearchResults.tsx` - Room results list with highlighting and infinite scroll
- `MessageSearchResults.tsx` - Message results list with highlighting
- `UserSearchResults.tsx` - User results list with highlighting and verified badges
- `RecentSearches.tsx` - Recent searches list with timestamps and clear functionality
- `HighlightText.tsx` - Shared component for rendering highlighted text from PostgreSQL ts_headline
- `useRecentSearches.ts` - Hook for AsyncStorage-based recent search management
- `types.ts` - TypeScript interfaces for search results
- `index.ts` - Module exports

**Shared Package (`packages/shared/src/hooks/`):**
- `useSearch.ts` - TanStack Query hooks for search APIs:
  - `useSearchRooms()` - Room search with infinite pagination
  - `useSearchMessages()` - Message search within a room
  - `useSearchUsers()` - User search with infinite pagination

### Features

1. **Search Input**
   - Auto-focus on mount
   - 300ms debounce for API calls
   - Clear button when text is present
   - Cancel button to go back

2. **Tab Navigation**
   - Rooms, Messages, Users tabs
   - Result count badges on each tab
   - Active tab indicator

3. **Search Results**
   - PostgreSQL ts_headline highlighting parsed and rendered
   - Infinite scroll pagination with TanStack Query
   - Loading, error, and empty states
   - Navigate to room on tap (rooms)
   - Private room badges
   - Verified user badges

4. **Recent Searches**
   - Stored in AsyncStorage
   - Max 20 recent searches
   - Auto-cleanup after 30 days
   - Tab context preserved
   - Individual and clear all delete

### Navigation

- Added `Search` screen to `RootStackParamList`
- Full-screen modal presentation with slide-from-bottom animation
- Search bar placeholder on Home screen to trigger search

### API Integration

Uses search endpoints from SOC-97:
- `GET /search/rooms?q=...`
- `GET /search/messages?q=...&roomId=...`
- `GET /search/users?q=...`

### Notes

- Message search requires a `roomId` - currently shows prompt to select room from Rooms tab
- User profile navigation placeholder - awaits UserProfile screen implementation
- Scroll-to-message for message results planned for SOC-100
