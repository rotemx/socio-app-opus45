# Socio Web

## Overview

React.js web application with Vite bundler.

## Tech Stack

- React 18.x
- Vite 5.x
- React Router 6.x
- Zustand for state management
- TanStack Query for server state

## Commands

```bash
# Development
pnpm dev

# Production build
pnpm build

# Preview production build
pnpm preview

# Linting
pnpm lint
```

## Directory Structure

```
src/
├── pages/           # Page components
├── routes/          # React Router config
├── components/      # Web-specific components
└── App.tsx          # Entry point
```

## Shared Code

Import from workspace packages:

```typescript
import { useChat, useRoomDiscovery } from '@socio/shared';
import { MessageBubble, RoomCard } from '@socio/ui';
import type { Message, ChatRoom } from '@socio/types';
```

## Path Aliases

```typescript
import { SomeComponent } from '@/components/SomeComponent';
```

## Styling

- Use Tailwind CSS utilities
- Follow Material Design 3 color system
- Support dark mode via system preference
