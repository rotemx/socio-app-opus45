import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { colors, spacing, radius } from '@socio/ui';
import { Avatar } from '@socio/ui';
import { HighlightText } from './HighlightText';
import type { MessageSearchResult } from './types';

export interface MessageSearchResultsProps {
  results: MessageSearchResult[];
  isLoading: boolean;
  isError: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
  onMessagePress: (message: MessageSearchResult) => void;
  query: string;
  roomId?: string;
}

/**
 * Message search results list with highlighting
 * Note: Message search requires a roomId to search within a specific room
 */
export function MessageSearchResults({
  results,
  isLoading,
  isError,
  hasMore,
  onLoadMore,
  onRetry,
  onMessagePress,
  query,
  roomId,
}: MessageSearchResultsProps): React.JSX.Element {
  const renderItem = ({ item }: { item: MessageSearchResult }) => (
    <MessageResultCard message={item} onPress={() => onMessagePress(item)} />
  );

  const renderFooter = () => {
    if (!hasMore) {return null;}
    if (isLoading) {
      return (
        <View style={styles.footer}>
          <ActivityIndicator size="small" color={colors.primary.light} />
        </View>
      );
    }
    return null;
  };

  const renderEmpty = () => {
    if (!roomId) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Select a room</Text>
          <Text style={styles.emptyText}>
            To search messages, select a room from the Rooms tab first
          </Text>
        </View>
      );
    }

    if (isLoading && results.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={colors.primary.light} />
          <Text style={styles.emptyText}>Searching messages...</Text>
        </View>
      );
    }

    if (isError) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Something went wrong</Text>
          <Text style={styles.emptyText}>
            Unable to search messages. Please try again.
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={onRetry}
            accessibilityRole="button"
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (query.length >= 3) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No messages found</Text>
          <Text style={styles.emptyText}>
            Try a different search term
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          Enter at least 3 characters to search
        </Text>
      </View>
    );
  };

  return (
    <FlatList
      data={results}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      ListEmptyComponent={renderEmpty}
      ListFooterComponent={renderFooter}
      onEndReached={hasMore && !isLoading ? onLoadMore : undefined}
      onEndReachedThreshold={0.5}
      showsVerticalScrollIndicator={false}
    />
  );
}

interface MessageResultCardProps {
  message: MessageSearchResult;
  onPress: () => void;
}

function MessageResultCard({
  message,
  onPress,
}: MessageResultCardProps): React.JSX.Element {
  const formatTime = (date: Date): string => {
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (diffDays === 1) {
      return 'Yesterday';
    }
    if (diffDays < 7) {
      return d.toLocaleDateString([], { weekday: 'short' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const displayName = message.sender.displayName || message.sender.username;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={`Message from ${displayName}`}
      accessibilityRole="button"
    >
      <Avatar
        src={message.sender.avatarUrl ?? undefined}
        name={displayName}
        size="sm"
      />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.senderName} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.timestamp}>{formatTime(message.createdAt)}</Text>
        </View>

        {message.highlight.content ? (
          <HighlightText
            text={message.highlight.content}
            style={styles.messageContent}
            numberOfLines={3}
          />
        ) : (
          <Text style={styles.messageContent} numberOfLines={3}>
            {message.content}
          </Text>
        )}

        {message.isEdited && (
          <Text style={styles.editedLabel}>edited</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: spacing.md,
    flexGrow: 1,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface.light,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.outlineVariant.light,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardContent: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  senderName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurface.light,
    marginRight: spacing.sm,
  },
  timestamp: {
    fontSize: 12,
    color: colors.onSurfaceVariant.light,
  },
  messageContent: {
    fontSize: 14,
    color: colors.onSurfaceVariant.light,
    lineHeight: 20,
  },
  editedLabel: {
    fontSize: 11,
    color: colors.onSurfaceVariant.light,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  footer: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.onSurface.light,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.onSurfaceVariant.light,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  retryButton: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary.light,
    borderRadius: radius.lg,
  },
  retryText: {
    color: colors.onPrimary.light,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default MessageSearchResults;
