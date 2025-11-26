import React from 'react';
import type { Message } from '@socio/types';
import { colors, spacing, radius } from '../tokens';

export interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showTimestamp?: boolean;
  showReadStatus?: boolean;
  readStatus?: 'sent' | 'delivered' | 'read';
}

export function MessageBubble({
  message,
  isOwn,
  showTimestamp = true,
  showReadStatus = false,
  readStatus = 'sent',
}: MessageBubbleProps) {
  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // This is a placeholder - actual implementation will differ for web vs mobile
  return {
    type: 'MessageBubble',
    props: {
      content: message.content,
      contentType: message.contentType,
      isOwn,
      timestamp: showTimestamp ? formatTime(message.createdAt) : undefined,
      readStatus: showReadStatus ? readStatus : undefined,
      backgroundColor: isOwn
        ? colors.primaryContainer.light
        : colors.surfaceVariant.light,
      textColor: isOwn
        ? colors.onPrimaryContainer.light
        : colors.onSurface.light,
      padding: {
        vertical: spacing.sm,
        horizontal: spacing.md,
      },
      borderRadius: radius.xl,
      maxWidth: '75%',
    },
  };
}
