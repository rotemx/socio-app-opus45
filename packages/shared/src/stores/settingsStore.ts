import { create } from 'zustand';
import type { DistanceUnit } from '../utils/formatDistance';

export interface SettingsState {
  /** Distance unit preference: 'imperial' (ft/mi) or 'metric' (m/km) */
  distanceUnit: DistanceUnit;
  /** Whether notifications are enabled */
  notificationsEnabled: boolean;
  /** Whether location sharing is enabled */
  locationSharingEnabled: boolean;
  /** Whether user is discoverable to others */
  discoverableEnabled: boolean;

  // Actions
  setDistanceUnit: (unit: DistanceUnit) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setLocationSharingEnabled: (enabled: boolean) => void;
  setDiscoverableEnabled: (enabled: boolean) => void;
  resetSettings: () => void;
}

const defaultSettings = {
  distanceUnit: 'imperial' as DistanceUnit,
  notificationsEnabled: true,
  locationSharingEnabled: true,
  discoverableEnabled: true,
};

/**
 * Settings store for user preferences
 * Note: Persistence is handled at the platform level (AsyncStorage for RN, localStorage for web)
 * Configure persistence in the platform-specific app entry point
 */
export const useSettingsStore = create<SettingsState>()((set) => ({
  ...defaultSettings,

  setDistanceUnit: (distanceUnit) => set({ distanceUnit }),
  setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
  setLocationSharingEnabled: (locationSharingEnabled) => set({ locationSharingEnabled }),
  setDiscoverableEnabled: (discoverableEnabled) => set({ discoverableEnabled }),
  resetSettings: () => set(defaultSettings),
}));
