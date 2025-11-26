import type { GeoLocation, User, UserRole } from './user';

export interface ChatRoom {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  creatorId: string;
  location: GeoLocation;
  radiusMeters: number;
  isPublic: boolean;
  isActive: boolean;
  maxMembers: number;
  tags: string[];
  settings: RoomSettings;
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date;
}

export interface RoomSettings {
  allowMedia: boolean;
  requireLocationCheck: boolean;
  voiceEnabled: boolean;
  videoEnabled: boolean;
}

export interface RoomMember {
  id: string;
  roomId: string;
  userId: string;
  user?: User;
  joinLocation?: GeoLocation;
  role: UserRole;
  activityWeight: number;
  isMuted: boolean;
  notificationsEnabled: boolean;
  joinedAt: Date;
  lastReadAt: Date;
}

export interface RoomWithDistance extends ChatRoom {
  distanceMeters: number;
  memberCount: number;
}
