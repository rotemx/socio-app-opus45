import React from 'react';
import { avatarSizes, colors } from '../tokens';

export interface AvatarProps {
  src?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  showOnlineStatus?: boolean;
  isOnline?: boolean;
}

export function Avatar({
  src,
  name,
  size = 'md',
  showOnlineStatus = false,
  isOnline = false,
}: AvatarProps) {
  const sizeValue = avatarSizes[size];
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // This is a placeholder - actual implementation will differ for web vs mobile
  return {
    type: 'Avatar',
    props: {
      src,
      initials,
      size: sizeValue,
      showOnlineStatus,
      isOnline,
      onlineColor: colors.online,
      offlineColor: colors.offline,
    },
  };
}
