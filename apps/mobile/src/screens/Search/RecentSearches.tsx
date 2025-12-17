import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from 'react-native';
import { colors, spacing, radius } from '@socio/ui';
import type { RecentSearch, SearchTab } from './types';

export interface RecentSearchesProps {
  searches: RecentSearch[];
  onSearchPress: (search: RecentSearch) => void;
  onClearAll: () => void;
  onRemoveSearch: (search: RecentSearch) => void;
}

/**
 * Recent searches list component
 */
export function RecentSearches({
  searches,
  onSearchPress,
  onClearAll,
  onRemoveSearch,
}: RecentSearchesProps): React.JSX.Element {
  if (searches.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No recent searches</Text>
        <Text style={styles.emptyText}>
          Your search history will appear here
        </Text>
      </View>
    );
  }

  const renderItem = ({ item }: { item: RecentSearch }) => (
    <RecentSearchItem
      search={item}
      onPress={() => onSearchPress(item)}
      onRemove={() => onRemoveSearch(item)}
    />
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Recent Searches</Text>
        <TouchableOpacity
          onPress={onClearAll}
          accessibilityLabel="Clear all recent searches"
          accessibilityRole="button"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.clearAllText}>Clear All</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={searches}
        renderItem={renderItem}
        keyExtractor={(item) => `${item.query}-${item.timestamp}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

interface RecentSearchItemProps {
  search: RecentSearch;
  onPress: () => void;
  onRemove: () => void;
}

function RecentSearchItem({
  search,
  onPress,
  onRemove,
}: RecentSearchItemProps): React.JSX.Element {
  const getTabLabel = (tab: SearchTab): string => {
    switch (tab) {
      case 'rooms':
        return 'Rooms';
      case 'messages':
        return 'Messages';
      case 'users':
        return 'Users';
    }
  };

  const formatTimeAgo = (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) {return 'Just now';}
    if (minutes < 60) {return `${minutes}m ago`;}
    if (minutes < 1440) {return `${Math.floor(minutes / 60)}h ago`;}
    if (minutes < 10080) {return `${Math.floor(minutes / 1440)}d ago`;}
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <TouchableOpacity
      style={styles.item}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={`Search for ${search.query} in ${getTabLabel(search.tab)}`}
      accessibilityRole="button"
    >
      <View style={styles.itemIcon}>
        <ClockIcon />
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemQuery} numberOfLines={1}>
          {search.query}
        </Text>
        <View style={styles.itemMeta}>
          <View style={styles.tabBadge}>
            <Text style={styles.tabBadgeText}>{getTabLabel(search.tab)}</Text>
          </View>
          <Text style={styles.itemTime}>{formatTimeAgo(search.timestamp)}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.removeButton}
        onPress={onRemove}
        accessibilityLabel={`Remove ${search.query} from recent searches`}
        accessibilityRole="button"
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <CloseIcon />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function ClockIcon(): React.JSX.Element {
  return (
    <View style={iconStyles.clockIcon}>
      <View style={iconStyles.clockFace} />
      <View style={iconStyles.clockHourHand} />
      <View style={iconStyles.clockMinuteHand} />
    </View>
  );
}

function CloseIcon(): React.JSX.Element {
  return (
    <View style={iconStyles.closeIcon}>
      <View style={[iconStyles.closeLine, iconStyles.closeLine1]} />
      <View style={[iconStyles.closeLine, iconStyles.closeLine2]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant.light,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onSurface.light,
  },
  clearAllText: {
    fontSize: 14,
    color: colors.primary.light,
    fontWeight: '500',
  },
  listContent: {
    paddingVertical: spacing.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  itemIcon: {
    marginRight: spacing.sm,
  },
  itemContent: {
    flex: 1,
  },
  itemQuery: {
    fontSize: 15,
    color: colors.onSurface.light,
    marginBottom: spacing.xxs,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tabBadge: {
    backgroundColor: colors.surfaceContainerHigh.light,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  tabBadgeText: {
    fontSize: 11,
    color: colors.onSurfaceVariant.light,
    fontWeight: '500',
  },
  itemTime: {
    fontSize: 12,
    color: colors.onSurfaceVariant.light,
  },
  removeButton: {
    padding: spacing.sm,
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
  },
  emptyText: {
    fontSize: 14,
    color: colors.onSurfaceVariant.light,
    textAlign: 'center',
  },
});

const iconStyles = StyleSheet.create({
  clockIcon: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clockFace: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.onSurfaceVariant.light,
  },
  clockHourHand: {
    position: 'absolute',
    width: 2,
    height: 4,
    backgroundColor: colors.onSurfaceVariant.light,
    top: 6,
  },
  clockMinuteHand: {
    position: 'absolute',
    width: 2,
    height: 6,
    backgroundColor: colors.onSurfaceVariant.light,
    top: 4,
    left: 10,
    transform: [{ rotate: '90deg' }],
  },
  closeIcon: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeLine: {
    position: 'absolute',
    width: 12,
    height: 2,
    backgroundColor: colors.onSurfaceVariant.light,
    borderRadius: 1,
  },
  closeLine1: {
    transform: [{ rotate: '45deg' }],
  },
  closeLine2: {
    transform: [{ rotate: '-45deg' }],
  },
});

export default RecentSearches;
