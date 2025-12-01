import React, { useRef, useState, useCallback, useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import type { Region } from 'react-native-maps';
import type MapView from 'react-native-maps';
import { PROVIDER_GOOGLE } from 'react-native-maps';
import ClusteredMapView from 'react-native-map-clustering';
import type BottomSheet from '@gorhom/bottom-sheet';
import type { GeoLocation, RoomWithDistance } from '@socio/types';
import { colors, spacing, radius } from '@socio/ui';
import { RoomMarker } from './RoomMarker';
import { RoomPreviewSheet } from './RoomPreviewSheet';

// Default 2-mile radius zoom (approximately 0.029 degrees latitude delta for 2 miles)
const TWO_MILE_DELTA = 0.058;

export interface RoomDiscoveryMapProps {
  rooms: RoomWithDistance[];
  userLocation: GeoLocation | null;
  onJoinRoom: (room: RoomWithDistance) => void;
  onLocateMe?: () => void;
  isLoading?: boolean;
}

/**
 * Map-based room discovery view with clustering and room preview
 */
export function RoomDiscoveryMap({
  rooms,
  userLocation,
  onJoinRoom,
  onLocateMe,
  isLoading = false,
}: RoomDiscoveryMapProps): React.JSX.Element {
  const mapRef = useRef<MapView>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [selectedRoom, setSelectedRoom] = useState<RoomWithDistance | null>(null);
  const [region, setRegion] = useState<Region>({
    latitude: userLocation?.latitude ?? 32.0853, // Default to Tel Aviv
    longitude: userLocation?.longitude ?? 34.7818,
    latitudeDelta: TWO_MILE_DELTA,
    longitudeDelta: TWO_MILE_DELTA,
  });

  // Update region when user location changes
  useEffect(() => {
    if (userLocation) {
      setRegion((prev) => ({
        ...prev,
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
      }));
    }
  }, [userLocation]);

  const handleMarkerPress = useCallback((room: RoomWithDistance) => {
    setSelectedRoom(room);
    bottomSheetRef.current?.snapToIndex(0);

    // Center map on selected room
    mapRef.current?.animateToRegion(
      {
        latitude: room.location.latitude,
        longitude: room.location.longitude,
        latitudeDelta: TWO_MILE_DELTA / 2,
        longitudeDelta: TWO_MILE_DELTA / 2,
      },
      300
    );
  }, []);

  const handleSheetClose = useCallback(() => {
    setSelectedRoom(null);
  }, []);

  const handleLocateMe = useCallback(() => {
    if (userLocation) {
      mapRef.current?.animateToRegion(
        {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: TWO_MILE_DELTA,
          longitudeDelta: TWO_MILE_DELTA,
        },
        500
      );
    }
    onLocateMe?.();
  }, [userLocation, onLocateMe]);

  const renderCluster = useCallback(
    (cluster: { geometry: { coordinates: [number, number] }; properties: { point_count: number } }) => {
      const { properties } = cluster;
      const count = properties.point_count;

      return (
        <View style={styles.clusterContainer}>
          <View style={styles.cluster}>
            <Text style={styles.clusterText}>{count > 99 ? '99+' : count}</Text>
          </View>
        </View>
      );
    },
    []
  );

  return (
    <View style={styles.container}>
      <ClusteredMapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.select({ android: PROVIDER_GOOGLE, default: undefined })}
        initialRegion={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass
        clusterColor={colors.primary.light}
        clusterTextColor={colors.onPrimary.light}
        clusterFontFamily="System"
        radius={50}
        minPoints={3}
        extent={512}
        nodeSize={64}
        renderCluster={renderCluster}
        accessibilityLabel="Map showing nearby chat rooms"
      >
        {rooms.map((room) => (
          <RoomMarker key={room.id} room={room} onPress={handleMarkerPress} />
        ))}
      </ClusteredMapView>

      {/* Locate Me Button */}
      <TouchableOpacity
        style={styles.locateButton}
        onPress={handleLocateMe}
        accessibilityLabel="Center map on my location"
        accessibilityRole="button"
      >
        <View style={styles.locateIcon}>
          <View style={styles.locateIconInner} />
        </View>
      </TouchableOpacity>

      {/* Loading Overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <Text style={styles.loadingText}>Finding rooms...</Text>
        </View>
      )}

      {/* Room Preview Sheet */}
      <RoomPreviewSheet
        ref={bottomSheetRef}
        room={selectedRoom}
        onJoinRoom={onJoinRoom}
        onClose={handleSheetClose}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  locateButton: {
    position: 'absolute',
    bottom: spacing.xxl,
    right: spacing.md,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface.light,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  locateIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary.light,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locateIconInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary.light,
  },
  clusterContainer: {
    alignItems: 'center',
  },
  cluster: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary.light,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.onPrimary.light,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  clusterText: {
    color: colors.onPrimary.light,
    fontSize: 14,
    fontWeight: 'bold',
  },
  loadingOverlay: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.surfaceContainer.light,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  loadingText: {
    color: colors.onSurface.light,
    fontSize: 14,
  },
});

export default RoomDiscoveryMap;
