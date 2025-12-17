import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, radius } from '@socio/ui';
import { Avatar } from '@socio/ui';
import { HighlightText } from './HighlightText';
import type { RoomSearchResult } from './types';
import type { RootStackScreenProps } from '../../navigation/types';

export interface RoomSearchResultsProps {
  results: RoomSearchResult[];
  isLoading: boolean;
  isError: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
  query: string;
}

type NavigationProp = RootStackScreenProps<'ChatRoom'>['navigation'];

/**
 * Room search results list with highlighting
 */
export function RoomSearchResults({
  results,
  isLoading,
  isError,
  hasMore,
  onLoadMore,
  onRetry,
  query,
}: RoomSearchResultsProps): React.JSX.Element {
  const navigation = useNavigation<NavigationProp>();

  const handleRoomPress = (room: RoomSearchResult) => {
    navigation.navigate('ChatRoom', {
      roomId: room.id,
      roomName: room.name,
    });
  };

  const renderItem = ({ item }: { item: RoomSearchResult }) => (
    <RoomResultCard room={item} onPress={() => handleRoomPress(item)} />
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
    if (isLoading && results.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={colors.primary.light} />
          <Text style={styles.emptyText}>Searching rooms...</Text>
        </View>
      );
    }

    if (isError) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Something went wrong</Text>
          <Text style={styles.emptyText}>
            Unable to search rooms. Please try again.
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
          <Text style={styles.emptyTitle}>No rooms found</Text>
          <Text style={styles.emptyText}>
            Try a different search term or browse nearby rooms
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

interface RoomResultCardProps {
  room: RoomSearchResult;
  onPress: () => void;
}

function RoomResultCard({ room, onPress }: RoomResultCardProps): React.JSX.Element {
  const formatMemberCount = (count: number): string => {
    if (count === 1) {return '1 member';}
    return `${count} members`;
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={`${room.name} room, ${formatMemberCount(room.memberCount)}`}
      accessibilityRole="button"
    >
      <Avatar
        src={room.avatarUrl ?? undefined}
        name={room.name}
        size="md"
      />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          {room.highlight.name ? (
            <HighlightText
              text={room.highlight.name}
              style={styles.roomName}
              numberOfLines={1}
            />
          ) : (
            <Text style={styles.roomName} numberOfLines={1}>
              {room.name}
            </Text>
          )}
          {!room.isPublic && (
            <View style={styles.privateBadge}>
              <Text style={styles.privateBadgeText}>Private</Text>
            </View>
          )}
        </View>

        {room.description && (
          room.highlight.description ? (
            <HighlightText
              text={room.highlight.description}
              style={styles.description}
              numberOfLines={2}
            />
          ) : (
            <Text style={styles.description} numberOfLines={2}>
              {room.description}
            </Text>
          )
        )}

        <View style={styles.cardFooter}>
          <Text style={styles.memberCount}>
            {formatMemberCount(room.memberCount)}
          </Text>
          {room.tags.length > 0 && (
            <View style={styles.tags}>
              {room.tags.slice(0, 2).map((tag, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
              {room.tags.length > 2 && (
                <Text style={styles.moreTags}>+{room.tags.length - 2}</Text>
              )}
            </View>
          )}
        </View>
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
    marginLeft: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  roomName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.onSurface.light,
    marginRight: spacing.sm,
  },
  privateBadge: {
    backgroundColor: colors.secondaryContainer.light,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  privateBadgeText: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.onSecondaryContainer.light,
  },
  description: {
    fontSize: 13,
    color: colors.onSurfaceVariant.light,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  memberCount: {
    fontSize: 12,
    color: colors.onSurfaceVariant.light,
  },
  tags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  tag: {
    backgroundColor: colors.surfaceContainerHigh.light,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  tagText: {
    fontSize: 10,
    color: colors.onSurfaceVariant.light,
  },
  moreTags: {
    fontSize: 10,
    color: colors.onSurfaceVariant.light,
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

export default RoomSearchResults;
