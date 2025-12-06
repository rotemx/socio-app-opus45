# Socio Shared

## Overview

Shared business logic used by both mobile and web applications.

## Contents

### Stores (Zustand)

- `authStore.ts` - Authentication state
- `chatStore.ts` - Messages, typing indicators, presence
- `roomStore.ts` - Room state and nearby rooms

### Hooks

- `useAuth.ts` - Authentication utilities
- `useChat.ts` - Chat room messaging (Zustand-based)
- `useChatHistory.ts` - Paginated message history (TanStack Query, infinite scroll)
- `useRoomDetails.ts` - Room details query (TanStack Query)
- `useRoomMembers.ts` - Room members query (TanStack Query)
- `useSendMessage.ts` - Message mutations with optimistic updates (TanStack Query)
- `useRoomDiscovery.ts` - Nearby room discovery

### Providers

- `QueryProvider.tsx` - TanStack Query provider with Socio defaults
- `queryCacheInvalidation.ts` - WebSocket-driven cache invalidation

### Services

- `api.ts` - REST API client
- `websocket.ts` - Socket.io client wrapper

## Usage

```typescript
import {
  // Zustand hooks
  useChat,
  useChatStore,
  // TanStack Query hooks
  useChatHistory,
  useRoomDetails,
  useRoomMembersQuery,
  useSendMessage,
  useEditMessage,
  useDeleteMessage,
  // Providers
  QueryProvider,
  initializeQueryCacheHandlers,
  // Services
  api,
  websocket
} from '@socio/shared';
```

## TanStack Query Setup

Wrap your app with `QueryProvider`:

```tsx
import { QueryProvider, initializeQueryCacheHandlers } from '@socio/shared';

function App() {
  useEffect(() => {
    // Initialize WebSocket cache handlers after auth
    const cleanup = initializeQueryCacheHandlers();
    return cleanup;
  }, []);

  return (
    <QueryProvider>
      <YourApp />
    </QueryProvider>
  );
}
```

## Adding New Code

- Stores go in `src/stores/`
- Hooks go in `src/hooks/`
- Providers go in `src/providers/`
- Services go in `src/services/`
- Export everything from `src/index.ts`
