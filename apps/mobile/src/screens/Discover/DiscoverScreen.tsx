import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Platform, PermissionsAndroid, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import type { RootStackScreenProps } from '../../navigation/types';
import type { RoomWithDistance, GeoLocation } from '@socio/types';
// import { useRoomDiscovery } from '@socio/shared'; // Uncomment when connecting to backend
import { colors, spacing, radius } from '@socio/ui';
import { RoomDiscoveryMap } from '../RoomDiscovery';

type Props = RootStackScreenProps<'Discover'>;

type ViewMode = 'list' | 'map';

// Placeholder room data (will be replaced with real data from useRoomDiscovery)
const PLACEHOLDER_ROOMS: RoomWithDistance[] = [
  {
    id: '1',
    name: 'Tel Aviv Pride',
    description: 'A welcoming space for the Tel Aviv LGBT community',
    location: { latitude: 32.0853, longitude: 34.7818 },
    distanceMeters: 500,
    memberCount: 127,
    creatorId: 'user-1',
    radiusMeters: 1000,
    isPublic: true,
    isActive: true,
    maxMembers: 500,
    tags: ['Pride', 'Community'],
    settings: { allowMedia: true, requireLocationCheck: true, voiceEnabled: true, videoEnabled: false },
    createdAt: new Date(),
    updatedAt: new Date(),
    lastActivityAt: new Date(),
  },
  {
    id: '2',
    name: 'Rothschild Hangout',
    description: 'Chat with locals around Rothschild Boulevard',
    location: { latitude: 32.0636, longitude: 34.7756 },
    distanceMeters: 2300,
    memberCount: 45,
    creatorId: 'user-2',
    radiusMeters: 500,
    isPublic: true,
    isActive: true,
    maxMembers: 200,
    tags: ['Local', 'Hangout'],
    settings: { allowMedia: true, requireLocationCheck: true, voiceEnabled: true, videoEnabled: true },
    createdAt: new Date(),
    updatedAt: new Date(),
    lastActivityAt: new Date(Date.now() - 30 * 60000),
  },
  {
    id: '3',
    name: 'Beach Vibes',
    description: 'For beach lovers and surfers',
    location: { latitude: 32.0841, longitude: 34.7650 },
    distanceMeters: 3100,
    memberCount: 89,
    creatorId: 'user-3',
    radiusMeters: 800,
    isPublic: true,
    isActive: true,
    maxMembers: 300,
    tags: ['Beach', 'Outdoor'],
    settings: { allowMedia: true, requireLocationCheck: false, voiceEnabled: true, videoEnabled: false },
    createdAt: new Date(),
    updatedAt: new Date(),
    lastActivityAt: new Date(Date.now() - 2 * 60 * 60000),
  },
];

/**
 * Request location permission for room discovery
 */
async function requestLocationPermission(): Promise<boolean> {
  return Platform.select({
    ios: async () => {
      // iOS handles this automatically with Geolocation.requestAuthorization
      return true;
    },
    android: async () => {
      try {
        const permission = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
        if (!permission) {
          return false;
        }
        const granted = await PermissionsAndroid.request(permission, {
          title: 'Location Permission',
          message: 'Socio needs access to your location to find nearby chat rooms.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        });
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (error) {
        console.warn('Failed to request location permission:', error);
        return false;
      }
    },
    default: async () => false,
  })();
}

/**
 * Format distance in meters to human-readable string
 */
function formatDistance(meters: number): string {
  if (meters < 150) {
    return `${Math.round(meters * 3.28084)} ft`;
  }
  const miles = meters / 1609.34;
  return `${miles.toFixed(1)} mi`;
}

/**
 * Discover screen - Browse and discover nearby chat rooms
 * Supports both list and map views
 */
export function DiscoverScreen(): React.JSX.Element {
  const navigation = useNavigation<Props['navigation']>();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [userLocation, setUserLocation] = useState<GeoLocation | null>(null);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);

  // For now, use placeholder data. In production, use useRoomDiscovery hook:
  // const { data: rooms, isLoading } = useRoomDiscovery({
  //   location: userLocation ?? { latitude: 0, longitude: 0 },
  //   radiusKm: 5,
  // });
  const rooms = PLACEHOLDER_ROOMS;
  const isLoading = false;

  useEffect(() => {
    const initLocation = async () => {
      const granted = await requestLocationPermission();
      setHasLocationPermission(granted);

      if (granted) {
        // Use default Tel Aviv location for now
        // In production, use Geolocation.getCurrentPosition
        setUserLocation({ latitude: 32.0853, longitude: 34.7818 });
      }
    };

    initLocation();
  }, []);

  const handleJoinRoom = useCallback(
    (room: RoomWithDistance) => {
      navigation.navigate('ChatRoom', { roomId: room.id, roomName: room.name });
    },
    [navigation]
  );

  const handleLocateMe = useCallback(() => {
    if (!hasLocationPermission) {
      Alert.alert(
        'Location Access Required',
        'Please enable location access in settings to use this feature.',
        [{ text: 'OK' }]
      );
    }
    // In production, refresh user location here
  }, [hasLocationPermission]);

  const renderRoom = ({ item }: { item: RoomWithDistance }): React.JSX.Element => (
    <TouchableOpacity
      style={styles.roomCard}
      onPress={() => handleJoinRoom(item)}
      accessibilityLabel={`Join ${item.name} room`}
      accessibilityRole="button"
    >
      <View style={styles.roomHeader}>
        <Text style={styles.roomName} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.distanceBadge}>
          <Text style={styles.distanceText}>{formatDistance(item.distanceMeters)}</Text>
        </View>
      </View>
      <Text style={styles.roomDescription} numberOfLines={2}>
        {item.description}
      </Text>
      <View style={styles.roomFooter}>
        <View style={styles.onlineDot} />
        <Text style={styles.memberCount}>{item.memberCount} members online</Text>
      </View>
    </TouchableOpacity>
  );

  const renderListView = () => (
    <FlatList
      data={rooms}
      renderItem={renderRoom}
      keyExtractor={(item) => item.id}
      style={styles.list}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      accessibilityLabel="Nearby rooms list"
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            No rooms found nearby.{'\n'}Try expanding your search radius.
          </Text>
        </View>
      }
    />
  );

  const renderMapView = () => (
    <GestureHandlerRootView style={styles.mapContainer}>
      <RoomDiscoveryMap
        rooms={rooms}
        userLocation={userLocation}
        onJoinRoom={handleJoinRoom}
        onLocateMe={handleLocateMe}
        isLoading={isLoading}
      />
    </GestureHandlerRootView>
  );

  return (
    <View style={styles.container}>
      {/* Header with search and toggle */}
      <View style={styles.header}>
        <View style={styles.searchBar} accessibilityRole="search" accessibilityLabel="Search rooms input">
          <Text style={styles.searchPlaceholder}>Search rooms...</Text>
        </View>

        {/* View Mode Toggle */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'list' && styles.toggleButtonActive]}
            onPress={() => setViewMode('list')}
            accessibilityLabel="Switch to list view"
            accessibilityRole="button"
            accessibilityState={{ selected: viewMode === 'list' }}
          >
            <Text style={[styles.toggleText, viewMode === 'list' && styles.toggleTextActive]}>List</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'map' && styles.toggleButtonActive]}
            onPress={() => setViewMode('map')}
            accessibilityLabel="Switch to map view"
            accessibilityRole="button"
            accessibilityState={{ selected: viewMode === 'map' }}
          >
            <Text style={[styles.toggleText, viewMode === 'map' && styles.toggleTextActive]}>Map</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      {viewMode === 'list' ? renderListView() : renderMapView()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLow.light,
  },
  header: {
    backgroundColor: colors.surface.light,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant.light,
  },
  searchBar: {
    backgroundColor: colors.surfaceContainer.light,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    marginBottom: spacing.sm,
  },
  searchPlaceholder: {
    color: colors.onSurfaceVariant.light,
    fontSize: 16,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainer.light,
    borderRadius: radius.md,
    padding: spacing.xs,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  toggleButtonActive: {
    backgroundColor: colors.primary.light,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.onSurfaceVariant.light,
  },
  toggleTextActive: {
    color: colors.onPrimary.light,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: spacing.md,
  },
  roomCard: {
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
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  roomName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.onSurface.light,
    flex: 1,
    marginRight: spacing.sm,
  },
  distanceBadge: {
    backgroundColor: colors.primaryContainer.light,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  distanceText: {
    color: colors.onPrimaryContainer.light,
    fontSize: 12,
    fontWeight: '500',
  },
  roomDescription: {
    fontSize: 14,
    color: colors.onSurfaceVariant.light,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  roomFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.online,
    marginRight: spacing.sm,
  },
  memberCount: {
    fontSize: 14,
    color: colors.onSurfaceVariant.light,
  },
  mapContainer: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    color: colors.onSurfaceVariant.light,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
});

export default DiscoverScreen;
