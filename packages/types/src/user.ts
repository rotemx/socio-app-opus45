export interface User {
  id: string;
  username: string;
  email?: string;
  phone?: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  authProvider: 'email' | 'google' | 'apple' | 'phone';
  isGuest: boolean;
  isVerified: boolean;
  currentLocation?: GeoLocation;
  settings: UserSettings;
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt?: Date;
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface UserSettings {
  notifications: boolean;
  locationSharing: boolean;
  discoverable: boolean;
}

export type UserRole = 'creator' | 'admin' | 'moderator' | 'member';
