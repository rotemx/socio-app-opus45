# Socio Chat Application

## Project Overview
Location-based chat room discovery platform for the Tel Aviv LGBT community. Users can find nearby communities, engage in real-time conversations, and connect through voice/video calls.

## Tech Stack
- **Mobile**: React Native 0.76+, TypeScript, Zustand, TanStack Query
- **Web**: React.js 18, Vite, TypeScript
- **Backend**: NestJS 10, Socket.io, Prisma, PostgreSQL/PostGIS, Redis
- **Voice/Video**: 100ms SDK
- **Monorepo**: Turborepo with pnpm workspaces

## Development Commands
```bash
# Start all services
pnpm dev

# Backend only
pnpm dev --filter=@socio/backend

# Web only
pnpm dev --filter=@socio/web

# Mobile (requires emulator/device)
pnpm dev --filter=@socio/mobile

# Run tests
pnpm test

# Lint all packages
pnpm lint

# Database migrations
cd apps/backend && npx prisma migrate dev
```

## Project Structure
```
socio/
├── apps/
│   ├── backend/      # NestJS server
│   ├── mobile/       # React Native app
│   └── web/          # React.js web app
├── packages/
│   ├── shared/       # Shared business logic (stores, hooks, services)
│   ├── ui/           # Shared UI components
│   ├── types/        # Shared TypeScript types
│   └── config/       # Shared configurations
└── docs/             # Documentation
```

## Code Conventions
- TypeScript strict mode everywhere
- Functional components with hooks (React/React Native)
- async/await, never callbacks
- Zod for runtime validation
- Use existing patterns as templates

## Key Patterns
- **WebSocket Handler**: See `apps/backend/src/modules/chat/chat.gateway.ts`
- **Zustand Store**: See `packages/shared/src/stores/chatStore.ts`
- **TanStack Query Hook**: See `packages/shared/src/hooks/useChatHistory.ts`
- **UI Component**: See `packages/ui/src/components/MessageBubble.tsx`

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
- Commit sensitive data (API keys, secrets)
