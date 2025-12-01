import { useCallback, useMemo } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet, ActivityIndicator } from 'react-native';
import type { RoomWithDistance, GeoLocation } from '@socio/types';
import { useRoomDiscovery } from '@socio/shared';
import { colors, spacing } from '@socio/ui';
import { RoomListCard } from './RoomListCard';

export interface RoomDiscoveryListProps {
  userLocation: GeoLocation | null;
  onRoomPress: (room: RoomWithDistance) => void;
  /** Optional placeholder rooms when location is not available */
  placeholderRooms?: RoomWithDistance[];
}

/**
 * Room discovery list with pull-to-refresh
 * Fetches rooms using TanStack Query and displays them sorted by distance
 */
export function RoomDiscoveryList({
  userLocation,
  onRoomPress,
  placeholderRooms = [],
}: RoomDiscoveryListProps): React.JSX.Element {
  const {
    data: fetchedRooms,
    isLoading,
    isRefetching,
    refetch,
    error,
  } = useRoomDiscovery({
    location: userLocation ?? { latitude: 0, longitude: 0 },
    radiusKm: 8, // ~5 miles
  });

  // Use fetched rooms if available, otherwise use placeholder
  const rooms = fetchedRooms ?? placeholderRooms;

  // Sort rooms by distance (ascending)
  const sortedRooms = useMemo(() => {
    return [...rooms].sort((a, b) => a.distanceMeters - b.distanceMeters);
  }, [rooms]);

  const handleRefresh = useCallback(() => {
    if (userLocation) {
      refetch();
    }
  }, [refetch, userLocation]);

  const renderItem = useCallback(
    ({ item }: { item: RoomWithDistance }) => (
      <RoomListCard room={item} onPress={() => onRoomPress(item)} />
    ),
    [onRoomPress]
  );

  const keyExtractor = useCallback((item: RoomWithDistance) => item.id, []);

  const renderEmptyComponent = useCallback(() => {
    if (isLoading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary.light} />
          <Text style={styles.loadingText}>Finding nearby rooms...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.errorTitle}>Unable to load rooms</Text>
          <Text style={styles.errorMessage}>
            Pull down to refresh or check your connection
          </Text>
        </View>
      );
    }

    if (!userLocation) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyTitle}>Location Required</Text>
          <Text style={styles.emptyMessage}>
            Enable location services to discover nearby chat rooms
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyTitle}>No rooms nearby</Text>
        <Text style={styles.emptyMessage}>
          There are no chat rooms in your area yet.{'\n'}
          Be the first to create one!
        </Text>
      </View>
    );
  }, [isLoading, error, userLocation]);

  const renderHeader = useCallback(() => {
    if (sortedRooms.length === 0) {
      return null;
    }

    return (
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Nearby Rooms</Text>
        <Text style={styles.headerSubtitle}>
          {sortedRooms.length} {sortedRooms.length === 1 ? 'room' : 'rooms'} found
        </Text>
      </View>
    );
  }, [sortedRooms.length]);

  return (
    <FlatList
      data={sortedRooms}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      style={styles.list}
      contentContainerStyle={[
        styles.listContent,
        sortedRooms.length === 0 && styles.emptyListContent,
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={handleRefresh}
          colors={[colors.primary.light]}
          tintColor={colors.primary.light}
        />
      }
      ListHeaderComponent={renderHeader}
      ListEmptyComponent={renderEmptyComponent}
      accessibilityLabel="Nearby rooms list"
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={5}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLow.light,
  },
  listContent: {
    padding: spacing.md,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  header: {
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.onSurface.light,
    marginBottom: spacing.xxs,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.onSurfaceVariant.light,
  },
  centerContainer: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  loadingText: {
    fontSize: 16,
    color: colors.onSurfaceVariant.light,
    marginTop: spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.onSurface.light,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 14,
    color: colors.onSurfaceVariant.light,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.error.light,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: colors.onSurfaceVariant.light,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default RoomDiscoveryList;
