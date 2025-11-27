# Socio Mobile

## Overview

React Native mobile application for iOS and Android.

## Tech Stack

- React Native 0.76+
- React Navigation 7.x
- Zustand for state management
- TanStack Query for server state
- 100ms SDK for voice/video calls

## Commands

```bash
# Development
pnpm dev           # Start Metro bundler

# iOS
pnpm ios           # Run on iOS simulator

# Android
pnpm android       # Run on Android emulator

# Testing
pnpm test
```

## Directory Structure

```
src/
├── screens/         # Screen components
│   ├── ChatRoom/
│   ├── RoomDiscovery/
│   ├── Profile/
│   └── Settings/
├── navigation/      # React Navigation config
├── services/        # Platform-specific services
└── App.tsx          # Entry point
```

## Shared Code

Import from workspace packages:

```typescript
import { useChat, useRoomDiscovery } from '@socio/shared';
import { MessageBubble, RoomCard } from '@socio/ui';
import type { Message, ChatRoom } from '@socio/types';
```

## Platform Guidelines

- Follow iOS Human Interface Guidelines
- Follow Material Design 3 for Android
- Use NativeWind for cross-platform styling
- Test on both platforms before PR

## Permissions

Required permissions:

- Location (for room discovery)
- Camera/Microphone (for calls)
- Notifications

## DO NOT

- Use inline styles (use NativeWind)
- Mix platform-specific code without Platform.select
- Skip accessibility labels
