import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform, Linking, AppState, type AppStateStatus } from 'react-native';
import {
  check,
  request,
  PERMISSIONS,
  RESULTS,
  openSettings,
  type PermissionStatus,
} from 'react-native-permissions';
import Geolocation, {
  type GeolocationResponse,
  type GeolocationError,
} from '@react-native-community/geolocation';

/** Location coordinates */
export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
}

/** Permission state types */
export type LocationPermissionState =
  | 'granted'
  | 'denied'
  | 'blocked'
  | 'unavailable'
  | 'limited'
  | 'unknown';

/** Location hook state */
export interface UseLocationState {
  /** Current permission status */
  permissionStatus: LocationPermissionState;
  /** Current location coordinates */
  location: LocationCoordinates | null;
  /** Whether location is being fetched */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Whether location services are enabled */
  isLocationEnabled: boolean;
}

/** Location hook actions */
export interface UseLocationActions {
  /** Request location permission */
  requestPermission: () => Promise<LocationPermissionState>;
  /** Get current location once */
  getCurrentLocation: () => Promise<LocationCoordinates | null>;
  /** Start watching location changes */
  startWatching: () => void;
  /** Stop watching location changes */
  stopWatching: () => void;
  /** Open device settings for location */
  openLocationSettings: () => Promise<void>;
  /** Check current permission status */
  checkPermission: () => Promise<LocationPermissionState>;
}

/** High accuracy options for geolocation */
const HIGH_ACCURACY_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 10000,
};

/** Low accuracy options for faster response */
const LOW_ACCURACY_OPTIONS = {
  enableHighAccuracy: false,
  timeout: 5000,
  maximumAge: 60000,
};

/**
 * Map react-native-permissions status to our simplified status
 */
function mapPermissionStatus(status: PermissionStatus): LocationPermissionState {
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
 * Get the appropriate permission based on platform and type
 */
function getLocationPermission(type: 'whenInUse' | 'always' = 'whenInUse') {
  const iosPermission = type === 'always'
    ? PERMISSIONS.IOS.LOCATION_ALWAYS
    : PERMISSIONS.IOS.LOCATION_WHEN_IN_USE;

  const androidPermission = type === 'always'
    ? PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION
    : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;

  return Platform.select({
    ios: iosPermission,
    android: androidPermission,
    default: androidPermission,
  });
}

/**
 * useLocation - Hook for location permission handling and geolocation
 *
 * Features:
 * - Request location permission (when in use / always)
 * - Get current location
 * - Watch location changes
 * - Handle all permission states
 * - Open device settings
 * - Update location on app foreground
 */
export function useLocation(): UseLocationState & UseLocationActions {
  const [state, setState] = useState<UseLocationState>({
    permissionStatus: 'unknown',
    location: null,
    isLoading: false,
    error: null,
    isLocationEnabled: true,
  });

  const watchIdRef = useRef<number | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  /**
   * Check current permission status
   */
  const checkPermission = useCallback(async (): Promise<LocationPermissionState> => {
    const permission = getLocationPermission('whenInUse');
    const status = await check(permission);
    const mappedStatus = mapPermissionStatus(status);

    setState((prev) => ({ ...prev, permissionStatus: mappedStatus }));
    return mappedStatus;
  }, []);

  /**
   * Request location permission
   */
  const requestPermission = useCallback(async (): Promise<LocationPermissionState> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    const permission = getLocationPermission('whenInUse');

    // First check current status
    const currentStatus = await check(permission);

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
        error: 'Location permission is blocked. Please enable it in settings.',
      }));
      return mapped;
    }

    // Request permission
    const result = await request(permission);
    const mappedResult = mapPermissionStatus(result);

    setState((prev) => ({
      ...prev,
      permissionStatus: mappedResult,
      isLoading: false,
      error: mappedResult === 'denied' || mappedResult === 'blocked'
        ? 'Location permission was denied'
        : null,
    }));

    return mappedResult;
  }, []);

  /**
   * Get current location once
   */
  const getCurrentLocation = useCallback(
    async (highAccuracy = true): Promise<LocationCoordinates | null> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      // Check permission first
      const status = await checkPermission();
      if (status !== 'granted' && status !== 'limited') {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: 'Location permission not granted',
        }));
        return null;
      }

      return new Promise((resolve) => {
        const options = highAccuracy ? HIGH_ACCURACY_OPTIONS : LOW_ACCURACY_OPTIONS;

        Geolocation.getCurrentPosition(
          (position: GeolocationResponse) => {
            const coords: LocationCoordinates = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              altitude: position.coords.altitude,
              altitudeAccuracy: position.coords.altitudeAccuracy ?? null,
              heading: position.coords.heading,
              speed: position.coords.speed,
            };

            setState((prev) => ({
              ...prev,
              location: coords,
              isLoading: false,
              error: null,
            }));

            resolve(coords);
          },
          (error: GeolocationError) => {
            let errorMessage = 'Failed to get location';

            switch (error.code) {
              case 1: // PERMISSION_DENIED
                errorMessage = 'Location permission denied';
                break;
              case 2: // POSITION_UNAVAILABLE
                errorMessage = 'Location unavailable. Please check your GPS settings.';
                setState((prev) => ({ ...prev, isLocationEnabled: false }));
                break;
              case 3: // TIMEOUT
                errorMessage = 'Location request timed out. Please try again.';
                break;
            }

            setState((prev) => ({
              ...prev,
              isLoading: false,
              error: errorMessage,
            }));

            resolve(null);
          },
          options
        );
      });
    },
    [checkPermission]
  );

  /**
   * Start watching location changes
   */
  const startWatching = useCallback(() => {
    // Stop any existing watch
    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = Geolocation.watchPosition(
      (position: GeolocationResponse) => {
        const coords: LocationCoordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          altitudeAccuracy: position.coords.altitudeAccuracy ?? null,
          heading: position.coords.heading,
          speed: position.coords.speed,
        };

        setState((prev) => ({
          ...prev,
          location: coords,
          error: null,
          isLocationEnabled: true,
        }));
      },
      (error: GeolocationError) => {
        if (error.code === 2) {
          setState((prev) => ({ ...prev, isLocationEnabled: false }));
        }
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 10, // Update every 10 meters
        interval: 10000, // Android: update every 10 seconds
        fastestInterval: 5000, // Android: fastest update every 5 seconds
      }
    );
  }, []);

  /**
   * Stop watching location changes
   */
  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  /**
   * Open device settings for location
   */
  const openLocationSettings = useCallback(async (): Promise<void> => {
    if (Platform.OS === 'ios') {
      // On iOS, openSettings opens the app-specific settings
      await openSettings();
    } else {
      // On Android, open location settings
      await Linking.openSettings();
    }
  }, []);

  /**
   * Handle app state changes - refresh location when app comes to foreground
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to foreground
        checkPermission();

        // If watching, get fresh location
        if (watchIdRef.current !== null) {
          getCurrentLocation(false); // Low accuracy for quick update
        }
      }

      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [checkPermission, getCurrentLocation]);

  /**
   * Check permission on mount
   */
  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  /**
   * Cleanup watch on unmount
   */
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return {
    // State
    ...state,
    // Actions
    requestPermission,
    getCurrentLocation,
    startWatching,
    stopWatching,
    openLocationSettings,
    checkPermission,
  };
}

export default useLocation;
