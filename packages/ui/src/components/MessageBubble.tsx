import React from 'react';
import type { Message } from '@socio/types';
import { View, Text } from 'react-native';

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

  return (
    <View 
      className={`
        py-2 px-4 rounded-xl max-w-[75%]
        ${isOwn ? 'bg-blue-100 self-end' : 'bg-gray-200 self-start'}
      `}
    >
      <Text 
        className={`
          ${isOwn ? 'text-blue-900' : 'text-gray-900'}
        `}
      >
        {message.content}
      </Text>
      {showTimestamp && (
        <Text 
          className={`
            text-xs mt-1 text-gray-500
            ${isOwn ? 'text-right' : 'text-left'}
          `}
        >
          {formatTime(message.createdAt)}
        </Text>
      )}
      {/* TODO: Implement read status indicator */}
    </View>
  );
}
