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
import type { UserSearchResult } from './types';

export interface UserSearchResultsProps {
  results: UserSearchResult[];
  isLoading: boolean;
  isError: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
  onUserPress: (user: UserSearchResult) => void;
  query: string;
}

/**
 * User search results list with highlighting
 */
export function UserSearchResults({
  results,
  isLoading,
  isError,
  hasMore,
  onLoadMore,
  onRetry,
  onUserPress,
  query,
}: UserSearchResultsProps): React.JSX.Element {
  const renderItem = ({ item }: { item: UserSearchResult }) => (
    <UserResultCard user={item} onPress={() => onUserPress(item)} />
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
          <Text style={styles.emptyText}>Searching users...</Text>
        </View>
      );
    }

    if (isError) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Something went wrong</Text>
          <Text style={styles.emptyText}>
            Unable to search users. Please try again.
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
          <Text style={styles.emptyTitle}>No users found</Text>
          <Text style={styles.emptyText}>
            Try a different username or display name
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

interface UserResultCardProps {
  user: UserSearchResult;
  onPress: () => void;
}

function UserResultCard({
  user,
  onPress,
}: UserResultCardProps): React.JSX.Element {
  const displayName = user.displayName || user.username;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={`${displayName}, @${user.username}`}
      accessibilityRole="button"
    >
      <Avatar
        src={user.avatarUrl ?? undefined}
        name={displayName}
        size="md"
      />
      <View style={styles.cardContent}>
        <View style={styles.nameRow}>
          {user.highlight.displayName ? (
            <HighlightText
              text={user.highlight.displayName}
              style={styles.displayName}
              numberOfLines={1}
            />
          ) : user.displayName ? (
            <Text style={styles.displayName} numberOfLines={1}>
              {user.displayName}
            </Text>
          ) : null}
          {user.isVerified && (
            <View style={styles.verifiedBadge}>
              <VerifiedIcon />
            </View>
          )}
        </View>

        <View style={styles.usernameRow}>
          <Text style={styles.atSymbol}>@</Text>
          {user.highlight.username ? (
            <HighlightText
              text={user.highlight.username}
              style={styles.username}
              numberOfLines={1}
            />
          ) : (
            <Text style={styles.username} numberOfLines={1}>
              {user.username}
            </Text>
          )}
        </View>

        {user.bio && (
          <Text style={styles.bio} numberOfLines={2}>
            {user.bio}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function VerifiedIcon(): React.JSX.Element {
  return (
    <View style={iconStyles.verifiedIcon}>
      <View style={iconStyles.checkmark} />
    </View>
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
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xxs,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onSurface.light,
    marginRight: spacing.xs,
  },
  verifiedBadge: {
    marginLeft: spacing.xxs,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  atSymbol: {
    fontSize: 14,
    color: colors.onSurfaceVariant.light,
  },
  username: {
    fontSize: 14,
    color: colors.onSurfaceVariant.light,
  },
  bio: {
    fontSize: 13,
    color: colors.onSurfaceVariant.light,
    marginTop: spacing.sm,
    lineHeight: 18,
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

const iconStyles = StyleSheet.create({
  verifiedIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary.light,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    width: 6,
    height: 10,
    borderColor: colors.onPrimary.light,
    borderWidth: 2,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    transform: [{ rotate: '45deg' }, { translateY: -1 }],
  },
});

export default UserSearchResults;
