import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  View,
  StyleSheet,
  ActivityIndicator,
  useColorScheme,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  type ListRenderItemInfo,
} from 'react-native';
import type { Message } from '@socio/types';
import { MessageBubble } from '@socio/ui';
import { colors, spacing } from '@socio/ui';
import { DateSeparator } from './DateSeparator';
import { ScrollToBottomButton } from './ScrollToBottomButton';
import { NewMessageIndicator } from './NewMessageIndicator';
import { MessageSkeletonList } from './MessageSkeleton';
import { EmptyState } from './EmptyState';

/** Minimum time gap in ms to show date separator (5 minutes) */
const DATE_SEPARATOR_GAP_MS = 5 * 60 * 1000;

/** Scroll threshold to show "scroll to bottom" button */
const SCROLL_THRESHOLD = 200;

export interface MessageListItem {
  type: 'message' | 'date-separator';
  id: string;
  data: Message | Date;
}

export interface MessageListProps {
  messages: Message[];
  currentUserId: string;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  onLoadMore: () => void;
  optimisticMessages?: Message[];
}

/**
 * Message list with inverted FlatList for natural chat scrolling behavior.
 * Supports infinite scroll, date separators, and optimistic updates.
 */
export function MessageList({
  messages,
  currentUserId,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  onLoadMore,
  optimisticMessages = [],
}: MessageListProps): React.JSX.Element {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const flatListRef = useRef<FlatList>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const previousMessageCount = useRef(messages.length);
  const isAtBottom = useRef(true);

  // Combine real messages with optimistic ones
  const allMessages = useMemo(() => {
    // Optimistic messages appear at the beginning (newest first due to inverted list)
    return [...optimisticMessages, ...messages];
  }, [messages, optimisticMessages]);

  // Build list items with date separators
  const listItems = useMemo((): MessageListItem[] => {
    if (allMessages.length === 0) {
      return [];
    }

    const items: MessageListItem[] = [];

    // Process messages (already sorted newest first for inverted list)
    for (let i = 0; i < allMessages.length; i++) {
      const message = allMessages[i];
      const prevMessage = allMessages[i + 1]; // Previous in time (next in array due to inversion)

      // Skip if message is undefined (should not happen due to loop bounds)
      if (!message) {
        continue;
      }

      items.push({
        type: 'message',
        id: message.id,
        data: message,
      });

      // Add date separator if:
      // 1. It's the last message (oldest), or
      // 2. There's a significant time gap, or
      // 3. Messages are on different days
      if (prevMessage) {
        const currentDate = new Date(message.createdAt);
        const prevDate = new Date(prevMessage.createdAt);
        // Use absolute value to handle clock skew or unsorted messages
        const timeDiff = Math.abs(currentDate.getTime() - prevDate.getTime());
        const isDifferentDay =
          currentDate.toDateString() !== prevDate.toDateString();

        if (isDifferentDay || timeDiff > DATE_SEPARATOR_GAP_MS) {
          items.push({
            type: 'date-separator',
            id: `separator-${message.id}`,
            data: currentDate,
          });
        }
      } else {
        // Add separator for the oldest message
        items.push({
          type: 'date-separator',
          id: `separator-${message.id}`,
          data: new Date(message.createdAt),
        });
      }
    }

    return items;
  }, [allMessages]);

  // Track new messages when scrolled up
  React.useEffect(() => {
    const diff = messages.length - previousMessageCount.current;
    // Only increment for new messages (positive diff), not removals
    if (diff > 0 && !isAtBottom.current) {
      setNewMessageCount((prev) => prev + diff);
    }
    // Reset count if we're at bottom or if messages were removed
    if (isAtBottom.current || diff < 0) {
      setNewMessageCount(0);
    }
    previousMessageCount.current = messages.length;
  }, [messages.length]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    // In inverted list, offsetY > 0 means scrolled up (towards older messages)
    const scrolledUp = offsetY > SCROLL_THRESHOLD;
    setIsScrolledUp(scrolledUp);
    isAtBottom.current = offsetY < 50;

    if (isAtBottom.current) {
      setNewMessageCount(0);
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    setNewMessageCount(0);
    isAtBottom.current = true;
  }, []);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      onLoadMore();
    }
  }, [hasNextPage, isFetchingNextPage, onLoadMore]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<MessageListItem>): React.JSX.Element => {
      if (item.type === 'date-separator') {
        return <DateSeparator date={item.data as Date} />;
      }

      const message = item.data as Message;
      const isOwn = message.senderId === currentUserId;
      const isOptimistic = optimisticMessages.some((m) => m.id === message.id);

      return (
        <View style={[styles.messageContainer, isOwn && styles.ownMessage]}>
          <MessageBubble
            message={message}
            isOwn={isOwn}
            showTimestamp
          />
          {isOptimistic && (
            <View style={styles.optimisticIndicator}>
              <ActivityIndicator
                size="small"
                color={isDark ? colors.onSurfaceVariant.dark : colors.onSurfaceVariant.light}
              />
            </View>
          )}
        </View>
      );
    },
    [currentUserId, optimisticMessages, isDark]
  );

  const keyExtractor = useCallback((item: MessageListItem) => item.id, []);

  const ListFooterComponent = useMemo(() => {
    if (isFetchingNextPage) {
      return (
        <View style={styles.loadingFooter}>
          <ActivityIndicator
            size="small"
            color={isDark ? colors.primary.dark : colors.primary.light}
          />
        </View>
      );
    }
    return null;
  }, [isFetchingNextPage, isDark]);

  if (isLoading) {
    return <MessageSkeletonList />;
  }

  // Show empty state when no messages
  if (listItems.length === 0) {
    return <EmptyState />;
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? colors.surface.dark : colors.surface.light },
      ]}
    >
      <NewMessageIndicator
        visible={newMessageCount > 0 && isScrolledUp}
        count={newMessageCount}
        onPress={scrollToBottom}
      />

      <FlatList
        ref={flatListRef}
        data={listItems}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        inverted
        style={styles.list}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={ListFooterComponent}
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
          autoscrollToTopThreshold: 100,
        }}
        accessibilityLabel="Chat messages"
      />

      <ScrollToBottomButton
        visible={isScrolledUp}
        onPress={scrollToBottom}
        unreadCount={newMessageCount}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: spacing.xxs,
  },
  ownMessage: {
    justifyContent: 'flex-end',
  },
  optimisticIndicator: {
    marginLeft: spacing.xs,
    marginBottom: spacing.xs,
  },
  loadingFooter: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
});

export default MessageList;
