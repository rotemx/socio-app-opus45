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
- `useChat.ts` - Chat room messaging
- `useChatHistory.ts` - Paginated message history (TanStack Query)
- `useRoomDiscovery.ts` - Nearby room discovery

### Services
- `api.ts` - REST API client
- `websocket.ts` - Socket.io client wrapper

## Usage
```typescript
import { useChat, useChatStore, api, websocket } from '@socio/shared';
```

## Adding New Code
- Stores go in `src/stores/`
- Hooks go in `src/hooks/`
- Services go in `src/services/`
- Export everything from `src/index.ts`
