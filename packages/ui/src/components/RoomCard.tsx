import React from 'react';
import type { RoomWithDistance } from '@socio/types';
import { spacing } from '../tokens';

export interface RoomCardProps {
  room: RoomWithDistance;
  onPress?: () => void;
  showDistance?: boolean;
  showMemberCount?: boolean;
  showLastActivity?: boolean;
}

export function RoomCard({
  room,
  onPress,
  showDistance = true,
  showMemberCount = true,
  showLastActivity = true,
}: RoomCardProps) {
  const formatDistance = (meters: number): string => {
    if (meters < 150) {
      return `${Math.round(meters * 3.28084)} ft away`;
    }
    const miles = meters / 1609.34;
    if (miles < 1) {
      return `${miles.toFixed(1)} mi`;
    }
    return `${miles.toFixed(1)} mi`;
  };

  const formatLastActivity = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return new Date(date).toLocaleDateString();
  };

  // This is a placeholder - actual implementation will differ for web vs mobile
  return {
    type: 'RoomCard',
    props: {
      name: room.name,
      description: room.description,
      avatarUrl: room.avatarUrl,
      distance: showDistance ? formatDistance(room.distanceMeters) : undefined,
      memberCount: showMemberCount ? room.memberCount : undefined,
      lastActivity: showLastActivity
        ? formatLastActivity(room.lastActivityAt)
        : undefined,
      tags: room.tags,
      height: 72,
      padding: spacing.md,
      onPress,
    },
  };
}
