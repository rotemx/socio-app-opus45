import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import type { RoomWithDistance } from '@socio/types';
import { colors, spacing } from '@socio/ui';

export interface RoomMarkerProps {
  room: RoomWithDistance;
  onPress: (room: RoomWithDistance) => void;
}

/**
 * Custom map marker for room pins
 * Uses brand primary color (#0088CC) with 32dp size
 */
export function RoomMarker({ room, onPress }: RoomMarkerProps): React.JSX.Element {
  return (
    <Marker
      coordinate={{
        latitude: room.location.latitude,
        longitude: room.location.longitude,
      }}
      onPress={() => onPress(room)}
      tracksViewChanges={false}
      accessibilityLabel={`Room: ${room.name}. Tap to view details.`}
    >
      <View style={styles.markerContainer}>
        <View style={styles.pin}>
          <Text style={styles.pinText}>{room.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.pinTip} />
      </View>
    </Marker>
  );
}

const MARKER_SIZE = 32;

const styles = StyleSheet.create({
  markerContainer: {
    alignItems: 'center',
  },
  pin: {
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    borderRadius: MARKER_SIZE / 2,
    backgroundColor: colors.primary.light,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.onPrimary.light,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  pinText: {
    color: colors.onPrimary.light,
    fontSize: 14,
    fontWeight: 'bold',
  },
  pinTip: {
    width: 0,
    height: 0,
    borderLeftWidth: spacing.sm,
    borderRightWidth: spacing.sm,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.primary.light,
    marginTop: -2,
  },
});

export default RoomMarker;
