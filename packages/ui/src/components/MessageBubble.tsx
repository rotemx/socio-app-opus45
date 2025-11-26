import React from 'react';
import type { Message } from '@socio/types';
import { colors, spacing, radius } from '../tokens';
import { View, Text, StyleSheet } from 'react-native';

export interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showTimestamp?: boolean;
}

export function MessageBubble({
  message,
  isOwn,
  showTimestamp = true,
}: MessageBubbleProps) {
  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const bubbleStyle = StyleSheet.create({
    bubble: {
      backgroundColor: isOwn
        ? colors.primaryContainer.light
        : colors.surfaceVariant.light,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.xl,
      maxWidth: '75%',
      alignSelf: isOwn ? 'flex-end' : 'flex-start', // Align bubble itself
    },
    text: {
      color: isOwn
        ? colors.onPrimaryContainer.light
        : colors.onSurface.light,
    },
    timestamp: {
      fontSize: 10,
      color: colors.onSurfaceVariant.light,
      marginTop: spacing.xs,
      textAlign: isOwn ? 'right' : 'left',
    }
  });


  return (
    <View style={bubbleStyle.bubble}>
      <Text style={bubbleStyle.text}>{message.content}</Text>
      {showTimestamp && (
        <Text style={bubbleStyle.timestamp}>{formatTime(message.createdAt)}</Text>
      )}
      {/* TODO: Implement read status indicator */}
    </View>
  );
}
