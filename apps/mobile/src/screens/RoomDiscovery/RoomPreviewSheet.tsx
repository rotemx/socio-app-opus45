import { forwardRef, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import type { RoomWithDistance } from '@socio/types';
import { colors, spacing, radius } from '@socio/ui';

export interface RoomPreviewSheetProps {
  room: RoomWithDistance | null;
  onJoinRoom: (room: RoomWithDistance) => void;
  onClose: () => void;
}

/**
 * Bottom sheet component for room preview when tapping a map pin
 */
export const RoomPreviewSheet = forwardRef<BottomSheet, RoomPreviewSheetProps>(
  function RoomPreviewSheet({ room, onJoinRoom, onClose }, ref) {
    const snapPoints = useMemo(() => ['25%', '40%'], []);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          pressBehavior="close"
        />
      ),
      []
    );

    const formatDistance = (meters: number): string => {
      if (meters < 150) {
        return `${Math.round(meters * 3.28084)} ft away`;
      }
      const miles = meters / 1609.34;
      return `${miles.toFixed(1)} mi away`;
    };

    const formatLastActivity = (date: Date): string => {
      const now = new Date();
      const diff = now.getTime() - new Date(date).getTime();
      const minutes = Math.floor(diff / 60000);

      if (minutes < 1) {
        return 'Active now';
      }
      if (minutes < 60) {
        return `Active ${minutes}m ago`;
      }
      if (minutes < 1440) {
        return `Active ${Math.floor(minutes / 60)}h ago`;
      }
      return new Date(date).toLocaleDateString();
    };

    if (!room) {
      return null;
    }

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        onClose={onClose}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.handleIndicator}
      >
        <BottomSheetView style={styles.contentContainer}>
          {/* Room Header */}
          <View style={styles.header}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{room.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.roomName} numberOfLines={1}>
                {room.name}
              </Text>
              <View style={styles.metaRow}>
                <Text style={styles.metaText}>{formatDistance(room.distanceMeters)}</Text>
                <View style={styles.dot} />
                <Text style={styles.metaText}>{room.memberCount} members</Text>
              </View>
            </View>
          </View>

          {/* Room Description */}
          {room.description && (
            <Text style={styles.description} numberOfLines={3}>
              {room.description}
            </Text>
          )}

          {/* Tags */}
          {room.tags && room.tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {room.tags.slice(0, 4).map((tag, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Activity Status */}
          <View style={styles.activityRow}>
            <View style={styles.activityDot} />
            <Text style={styles.activityText}>
              {formatLastActivity(room.lastActivityAt)}
            </Text>
          </View>

          {/* Join Button */}
          <TouchableOpacity
            style={styles.joinButton}
            onPress={() => onJoinRoom(room)}
            accessibilityLabel={`Join ${room.name} room`}
            accessibilityRole="button"
          >
            <Text style={styles.joinButtonText}>Join Room</Text>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheet>
    );
  }
);

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: colors.surface.light,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  handleIndicator: {
    backgroundColor: colors.outline.light,
    width: 40,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryContainer.light,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    color: colors.onPrimaryContainer.light,
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerInfo: {
    flex: 1,
  },
  roomName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.onSurface.light,
    marginBottom: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 14,
    color: colors.onSurfaceVariant.light,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.onSurfaceVariant.light,
    marginHorizontal: spacing.sm,
  },
  description: {
    fontSize: 14,
    color: colors.onSurfaceVariant.light,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },
  tag: {
    backgroundColor: colors.secondaryContainer.light,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  tagText: {
    fontSize: 12,
    color: colors.onSecondaryContainer.light,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.online,
    marginRight: spacing.sm,
  },
  activityText: {
    fontSize: 14,
    color: colors.online,
  },
  joinButton: {
    backgroundColor: colors.primary.light,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: 'auto',
  },
  joinButtonText: {
    color: colors.onPrimary.light,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default RoomPreviewSheet;
