import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform, Linking, AppState, type AppStateStatus } from 'react-native';
import {
  checkNotifications,
  requestNotifications,
  RESULTS,
  openSettings,
  type PermissionStatus,
  type NotificationOption,
} from 'react-native-permissions';

/** Permission state types */
export type NotificationPermissionState =
  | 'granted'
  | 'denied'
  | 'blocked'
  | 'unavailable'
  | 'limited'
  | 'unknown';

/** Notifications hook state */
export interface UseNotificationsState {
  /** Current permission status */
  permissionStatus: NotificationPermissionState;
  /** Whether permission is being checked/requested */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
}

/** Notifications hook actions */
export interface UseNotificationsActions {
  /** Request notification permission */
  requestPermission: () => Promise<NotificationPermissionState>;
  /** Open device settings for notifications */
  openNotificationSettings: () => Promise<void>;
  /** Check current permission status */
  checkPermission: () => Promise<NotificationPermissionState>;
}

/** Notification options to request on iOS */
const IOS_NOTIFICATION_OPTIONS: NotificationOption[] = ['alert', 'badge', 'sound'];

/**
 * Map react-native-permissions status to our simplified status
 */
function mapPermissionStatus(status: PermissionStatus): NotificationPermissionState {
  switch (status) {
    case RESULTS.GRANTED:
      return 'granted';
    case RESULTS.DENIED:
      return 'denied';
    case RESULTS.BLOCKED:
      return 'blocked';
    case RESULTS.UNAVAILABLE:
      return 'unavailable';
    case RESULTS.LIMITED:
      return 'limited';
    default:
      return 'unknown';
  }
}

/**
 * useNotifications - Hook for notification permission handling
 *
 * Features:
 * - Request notification permission
 * - Handle all permission states
 * - Open device settings
 * - Update permission status on app foreground
 */
export function useNotifications(): UseNotificationsState & UseNotificationsActions {
  const [state, setState] = useState<UseNotificationsState>({
    permissionStatus: 'unknown',
    isLoading: false,
    error: null,
  });

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  /**
   * Check current permission status
   */
  const checkPermission = useCallback(async (): Promise<NotificationPermissionState> => {
    const { status } = await checkNotifications();
    const mappedStatus = mapPermissionStatus(status);

    setState((prev) => ({ ...prev, permissionStatus: mappedStatus }));
    return mappedStatus;
  }, []);

  /**
   * Request notification permission
   */
  const requestPermission = useCallback(async (): Promise<NotificationPermissionState> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    // First check current status
    const { status: currentStatus } = await checkNotifications();

    // If already granted or blocked, don't request again
    if (currentStatus === RESULTS.GRANTED) {
      const mapped = mapPermissionStatus(currentStatus);
      setState((prev) => ({
        ...prev,
        permissionStatus: mapped,
        isLoading: false,
      }));
      return mapped;
    }

    if (currentStatus === RESULTS.BLOCKED) {
      const mapped = mapPermissionStatus(currentStatus);
      setState((prev) => ({
        ...prev,
        permissionStatus: mapped,
        isLoading: false,
        error: 'Notification permission is blocked. Please enable it in settings.',
      }));
      return mapped;
    }

    // Request permission with options for iOS
    const { status: resultStatus } = await requestNotifications(IOS_NOTIFICATION_OPTIONS);
    const mappedResult = mapPermissionStatus(resultStatus);

    setState((prev) => ({
      ...prev,
      permissionStatus: mappedResult,
      isLoading: false,
      error: mappedResult === 'denied' || mappedResult === 'blocked'
        ? 'Notification permission was denied'
        : null,
    }));

    return mappedResult;
  }, []);

  /**
   * Open device settings for notifications
   */
  const openNotificationSettings = useCallback(async (): Promise<void> => {
    if (Platform.OS === 'ios') {
      // On iOS, openSettings opens the app-specific settings
      await openSettings();
    } else {
      // On Android, open app settings
      await Linking.openSettings();
    }
  }, []);

  /**
   * Handle app state changes - refresh permission when app comes to foreground
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to foreground - check if user changed permission in settings
        checkPermission();
      }

      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [checkPermission]);

  /**
   * Check permission on mount
   */
  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  return {
    // State
    ...state,
    // Actions
    requestPermission,
    openNotificationSettings,
    checkPermission,
  };
}

export default useNotifications;
