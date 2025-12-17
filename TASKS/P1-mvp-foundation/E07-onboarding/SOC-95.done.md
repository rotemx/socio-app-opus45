# SOC-95: Permission request screens - Mobile

| Field | Value |
|-------|-------|
| Epic | E07-onboarding |
| Project | MVP Foundation |
| Status | done |
| Priority | High |
| Story Points | 3 |
| Created | 2025-11-29 |
| Completed | 2025-12-14 |

## Description

Implement permission request screens with explanations before native dialogs.

## Acceptance Criteria

- [x] Location permission primer screen
- [x] Notification permission primer screen
- [x] Clear explanation of why permission needed
- [x] Request permission button
- [x] Skip option
- [x] Handle denied state gracefully
- [x] Deep link to settings if permanently denied

---

## Implementation Notes

### Files Created

1. **`apps/mobile/src/hooks/useNotifications.ts`**
   - Hook for notification permission handling using react-native-permissions
   - Uses `checkNotifications` and `requestNotifications` APIs
   - Handles all states: granted, denied, blocked, unavailable, limited
   - Provides `openNotificationSettings` for deep linking to device settings
   - Automatically refreshes permission status when app returns to foreground

2. **`apps/mobile/src/screens/Onboarding/PermissionPrimer.tsx`**
   - Reusable permission primer component
   - Displays icon, title, description, feature list
   - Supports primary/secondary buttons with loading state
   - Handles multiple variants: initial, denied, blocked, unavailable

3. **`apps/mobile/src/screens/Onboarding/NotificationPermissionScreen.tsx`**
   - Notification permission primer screen
   - Shows benefits of enabling notifications
   - Handles all permission states with appropriate UI
   - Integrates with useNotifications hook

### Files Modified

1. **`apps/mobile/src/navigation/types.ts`**
   - Added `NotificationPermission` screen to `RootStackParamList`

2. **`apps/mobile/src/navigation/RootNavigator.tsx`**
   - Added `NotificationPermissionScreen` import
   - Added permission screens to onboarding flow
   - Removed LocationPermission from authenticated screens

3. **`apps/mobile/src/screens/Permissions/LocationPermissionScreen.tsx`**
   - Updated navigation flow: now navigates to `NotificationPermission` instead of `Home`

4. **`apps/mobile/src/screens/Onboarding/ProfileSetupScreen.tsx`**
   - Updated navigation flow: navigates to `LocationPermission` instead of `Login`

5. **`apps/mobile/src/hooks/index.ts`**
   - Exported useNotifications hook and types

6. **`apps/mobile/src/screens/Onboarding/index.ts`**
   - Exported NotificationPermissionScreen and PermissionPrimer components

### Onboarding Flow

```
Onboarding (WelcomeCarousel)
    ↓
ProfileSetup
    ↓
LocationPermission (primer → request → next or skip)
    ↓
NotificationPermission (primer → request → next or skip)
    ↓
Login
```

### Permission States Handled

| State | Behavior |
|-------|----------|
| `granted` | Auto-navigate to next screen |
| `limited` | Auto-navigate to next screen |
| `denied` | Show "Open Settings" button |
| `blocked` | Show "Open Settings" button |
| `unavailable` | Show message and "Continue" button |
| `unknown` | Show primer with "Allow" button |

### Notes

- LocationPermissionScreen was already implemented in `apps/mobile/src/screens/Permissions/`
- Uses react-native-permissions v5.4.4
- Notifications use separate API (`checkNotifications`/`requestNotifications`) rather than generic `check`/`request`
- iOS notification options requested: alert, badge, sound
