import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { colors, spacing, radius } from '@socio/ui';
import type { RootStackScreenProps } from '../../navigation/types';
import { MessageList } from './components';
import { useChatRoom } from './hooks';

type Props = RootStackScreenProps<'ChatRoom'>;

/** Debounce time for typing indicator stop in ms */
const TYPING_DEBOUNCE_MS = 1500;

/** Throttle time for typing indicator start in ms */
const TYPING_THROTTLE_MS = 2000;

/**
 * Chat room screen - Real-time messaging interface
 * Implements infinite scroll, optimistic updates, and real-time WebSocket sync.
 */
export function ChatRoomScreen({ route }: Props): React.JSX.Element {
  const { roomId } = route.params;
  const [message, setMessage] = useState('');
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const lastTypingSentRef = useRef<number>(0);

  const {
    messages,
    optimisticMessages,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    loadMore,
    sendMessage: sendChatMessage,
    currentUserId,
    typingUsers,
    sendTyping,
  } = useChatRoom(roomId);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Handle text change with typing indicator (throttled to prevent spam)
  const handleTextChange = useCallback(
    (text: string) => {
      setMessage(text);

      // Clear previous stop timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Send typing indicator (throttled)
      if (text.length > 0) {
        const now = Date.now();
        // Only send "start typing" if enough time has passed since last send
        if (now - lastTypingSentRef.current > TYPING_THROTTLE_MS) {
          sendTyping(true);
          lastTypingSentRef.current = now;
        }

        // Schedule stop typing after debounce
        typingTimeoutRef.current = setTimeout(() => {
          sendTyping(false);
          lastTypingSentRef.current = 0;
        }, TYPING_DEBOUNCE_MS);
      } else {
        sendTyping(false);
        lastTypingSentRef.current = 0;
      }
    },
    [sendTyping]
  );

  // Send message handler
  const handleSend = useCallback(() => {
    if (message.trim()) {
      sendChatMessage(message.trim());
      setMessage('');
      sendTyping(false);

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  }, [message, sendChatMessage, sendTyping]);

  // Filter out current user from typing indicators
  const otherTypingUsers = typingUsers.filter(
    (t) => t.userId !== currentUserId && t.isTyping
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Messages list */}
      <MessageList
        messages={messages}
        optimisticMessages={optimisticMessages}
        currentUserId={currentUserId}
        isLoading={isLoading}
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={hasNextPage}
        onLoadMore={loadMore}
      />

      {/* Typing indicator */}
      {otherTypingUsers.length > 0 && (
        <View style={styles.typingContainer}>
          <Text style={styles.typingText}>
            {otherTypingUsers.length === 1
              ? 'Someone is typing...'
              : `${otherTypingUsers.length} people are typing...`}
          </Text>
        </View>
      )}

      {/* Message input */}
      <View style={styles.inputContainer}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={colors.onSurfaceVariant.light}
            value={message}
            onChangeText={handleTextChange}
            multiline
            maxLength={4000}
            accessibilityLabel="Message input"
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              message.trim() ? styles.sendButtonActive : styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!message.trim()}
            accessibilityLabel="Send message"
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.sendButtonText,
                message.trim() ? styles.sendButtonTextActive : styles.sendButtonTextDisabled,
              ]}
            >
              ➤
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.light,
  },
  typingContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceContainerLow.light,
  },
  typingText: {
    fontSize: 12,
    color: colors.onSurfaceVariant.light,
    fontStyle: 'italic',
  },
  inputContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant.light,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface.light,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceContainerHigh.light,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    maxHeight: 100,
    color: colors.onSurface.light,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonActive: {
    backgroundColor: colors.primary.light,
  },
  sendButtonDisabled: {
    backgroundColor: colors.surfaceContainerHigh.light,
  },
  sendButtonText: {
    fontSize: 18,
  },
  sendButtonTextActive: {
    color: colors.onPrimary.light,
  },
  sendButtonTextDisabled: {
    color: colors.onSurfaceVariant.light,
  },
});

export default ChatRoomScreen;
