# SOCIO-106: Initialize React Native Project

## Overview

This ticket implemented the React Native mobile application foundation, including project configuration, navigation structure, NativeWind styling, React Query setup, and basic screen scaffolds.

## Implementation Summary

### Files Created

1. **`apps/mobile/index.js`**
   - React Native app entry point
   - Registers the App component with AppRegistry

2. **`apps/mobile/app.json`**
   - App name configuration (name: "Socio", displayName: "Socio")

3. **`apps/mobile/metro.config.js`**
   - Metro bundler configuration for monorepo support
   - Configures watchFolders to include monorepo root
   - Sets up nodeModulesPaths for workspace package resolution

4. **`apps/mobile/babel.config.js`**
   - Babel configuration with React Native preset
   - NativeWind/babel plugin for Tailwind CSS support

5. **`apps/mobile/tailwind.config.js`**
   - NativeWind Tailwind configuration
   - Custom color palette:
     - Primary: Fuchsia/magenta (Socio brand)
     - Secondary: Violet/purple
     - Semantic colors: success, warning, error, info
   - Content paths configured for monorepo packages

6. **`apps/mobile/global.css`**
   - Tailwind CSS base imports (@tailwind base/components/utilities)

7. **`apps/mobile/nativewind-env.d.ts`**
   - TypeScript reference for NativeWind types

8. **`apps/mobile/src/navigation/types.ts`**
   - Type-safe navigation types using React Navigation's type system
   - RootStackParamList defining all screens and their params:
     - Home, Discover, Profile, Settings (no params)
     - ChatRoom (roomId, roomName)
     - CreateRoom, Login, Register, ForgotPassword (no params)
   - Helper types: RootStackScreenProps, RootStackNavigationProp

9. **`apps/mobile/src/navigation/RootNavigator.tsx`**
   - Main navigation stack using @react-navigation/native-stack
   - Screens configured with appropriate headers
   - Safe optional chaining for dynamic screen options

10. **`apps/mobile/src/providers/QueryProvider.tsx`**
    - React Query (TanStack Query) configuration
    - Optimized settings for mobile:
      - staleTime: 5 minutes
      - gcTime: 30 minutes
      - refetchOnWindowFocus: false (not needed on mobile)
      - refetchOnReconnect: true (important for mobile connectivity)
      - retry: 2

11. **`apps/mobile/src/screens/Home/HomeScreen.tsx`**
    - Main landing screen with:
      - Hero section with welcome message
      - Quick action buttons (Discover Rooms, Create Room)
      - Placeholder for nearby rooms list
      - Full accessibility labels on interactive elements

12. **`apps/mobile/src/screens/Discover/DiscoverScreen.tsx`**
    - Room discovery interface with:
      - Search/filter header
      - FlatList of nearby rooms with distance indicators
      - Room cards showing name, description, distance, member count
      - Navigation to ChatRoom on selection

13. **`apps/mobile/src/screens/ChatRoom/ChatRoomScreen.tsx`**
    - Real-time messaging interface with:
      - Message list with sender differentiation (own vs others)
      - Keyboard-avoiding input area
      - Timestamp formatting
      - Placeholder for WebSocket integration (SOCIO-301)

14. **`apps/mobile/src/screens/Profile/ProfileScreen.tsx`**
    - User profile and settings hub with:
      - Profile header with avatar placeholder
      - Edit profile button
      - Stats section (rooms, messages, connections)
      - Navigation menu (Settings, Privacy, Help, Sign Out)
      - Version info footer

15. **`apps/mobile/src/screens/Settings/SettingsScreen.tsx`**
    - App preferences with:
      - Notification toggles (Push notifications)
      - Privacy toggles (Location sharing, Discoverability)
      - About section (Terms, Privacy Policy, Licenses)
      - Account section (Delete account)

16. **`apps/mobile/jest.config.js`**
    - Jest configuration for React Native
    - Uses react-native preset
    - Transforms workspace packages

17. **`apps/mobile/jest.setup.js`**
    - Jest setup file placeholder

18. **`apps/mobile/.eslintrc.js`**
    - ESLint configuration extending shared react-native config
    - Proper ignorePatterns for config files, ios/, android/
    - Test file overrides with jest environment

### Files Modified

1. **`apps/mobile/src/App.tsx`**
   - Replaced placeholder with full provider stack:
     - SafeAreaProvider (react-native-safe-area-context)
     - QueryProvider (TanStack Query)
     - NavigationContainer (React Navigation)
     - StatusBar configuration
     - RootNavigator

## Architecture Decisions

### Navigation Structure

Using React Navigation 7.x with native-stack for optimal performance:

```
RootStack (Native Stack)
├── Home (initial)
├── Discover
├── Profile
├── Settings
├── ChatRoom (params: roomId, roomName)
├── CreateRoom (placeholder)
├── Login (placeholder)
├── Register (placeholder)
└── ForgotPassword (placeholder)
```

### Styling Approach

NativeWind (Tailwind CSS for React Native) was chosen for:
- Familiar Tailwind utility classes
- Design system consistency with web app
- No runtime style generation overhead
- TypeScript support via nativewind-env.d.ts

### State Management Strategy

- **Server state**: TanStack Query (React Query)
- **Client state**: Zustand (to be integrated in future tickets)
- **Navigation state**: React Navigation

## Usage

### Development

```bash
# Start Metro bundler
pnpm dev --filter=@socio/mobile

# Or directly
cd apps/mobile && pnpm dev

# iOS (requires Mac with Xcode)
pnpm ios --filter=@socio/mobile

# Android (requires Android Studio)
pnpm android --filter=@socio/mobile
```

### Adding New Screens

1. Create screen component in `src/screens/[ScreenName]/[ScreenName]Screen.tsx`
2. Add screen type to `src/navigation/types.ts` RootStackParamList
3. Add screen to `src/navigation/RootNavigator.tsx`

### Using Navigation

```typescript
import { useNavigation } from '@react-navigation/native';
import type { RootStackScreenProps } from '../navigation/types';

type Props = RootStackScreenProps<'Home'>;

export function HomeScreen(): React.JSX.Element {
  const navigation = useNavigation<Props['navigation']>();

  // Navigate with params
  navigation.navigate('ChatRoom', { roomId: '123', roomName: 'Test Room' });
}
```

### Using React Query

```typescript
import { useQuery } from '@tanstack/react-query';

export function useRooms() {
  return useQuery({
    queryKey: ['rooms'],
    queryFn: () => fetchRooms(),
  });
}
```

## Code Review Fixes Applied

After 2 iterations of coderabbit review, the following issues were addressed:

1. **CSS env() variables** - Removed from tailwind.config.js (not supported in React Native)
2. **Route params safety** - Added optional chaining for `route.params?.roomName`
3. **ESLint ignorePatterns** - Properly merged with base config ignorePatterns
4. **Missing handlers** - Added TODO comments for unimplemented onPress handlers
5. **Console statements** - Replaced with `void Promise.resolve()` pattern

## Remaining Work (Future Tickets)

1. **SOCIO-206 (Auth)** - Sign out and delete account functionality
2. **SOCIO-301 (WebSocket)** - Real-time messaging in ChatRoomScreen
3. **Settings persistence** - Save toggle states to AsyncStorage or API
4. **Permission handling** - Request location, camera, microphone permissions
5. **Deep linking** - URL scheme configuration
6. **Push notifications** - Firebase/APNs setup

## Dependencies

Core dependencies already in package.json:
- react-native: ^0.76.7
- @react-navigation/native: ^7.0.14
- @react-navigation/native-stack: ^7.2.0
- @tanstack/react-query: ^5.72.2
- nativewind: ^4.1.23
- tailwindcss: ^3.4.17
- react-native-safe-area-context: ^5.3.0
- react-native-screens: ^4.7.0

## Accessibility

All screens follow accessibility best practices:
- `accessibilityLabel` on interactive elements
- `accessibilityRole` for semantic meaning (button, search)
- Proper touch target sizes (min 44x44 for iOS guidelines)
- Color contrast following WCAG guidelines

## Color Palette Reference

| Name | Hex | Usage |
|------|-----|-------|
| primary-500 | #d946ef | Main brand color, buttons |
| primary-100 | Light fuchsia | Subtle backgrounds |
| secondary-500 | #8b5cf6 | Secondary actions |
| success | #22c55e | Success states |
| warning | #f59e0b | Warning states |
| error | #ef4444 | Error states, destructive actions |
| gray-50 | #f9fafb | Background |
| gray-900 | #111827 | Primary text |
