import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { RoomWithDistance } from '@socio/types';
import { formatDistance, useSettingsStore } from '@socio/shared';
import { colors, spacing, radius } from '@socio/ui';

export interface RoomListCardProps {
  room: RoomWithDistance;
  onPress: () => void;
}

/**
 * Room card component for the discovery list
 * Displays avatar, name, member count, distance, and activity indicator
 */
export function RoomListCard({ room, onPress }: RoomListCardProps): React.JSX.Element {
  const distanceUnit = useSettingsStore((state) => state.distanceUnit);

  const formatLastActivity = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) {
      return 'Active now';
    }
    if (minutes < 60) {
      return `${minutes}m ago`;
    }
    if (minutes < 1440) {
      return `${Math.floor(minutes / 60)}h ago`;
    }
    return new Date(date).toLocaleDateString();
  };

  const isRecentlyActive = (): boolean => {
    const diff = Date.now() - new Date(room.lastActivityAt).getTime();
    const minutes = Math.floor(diff / 60000);
    return minutes < 30; // Active within last 30 minutes
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={`${room.name} room, ${formatDistance(room.distanceMeters, distanceUnit)} away, ${room.memberCount} members`}
      accessibilityRole="button"
    >
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{room.name.charAt(0).toUpperCase()}</Text>
        </View>
        {/* Online Activity Indicator */}
        {isRecentlyActive() && <View style={styles.activityIndicator} />}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.name} numberOfLines={1}>
            {room.name}
          </Text>
          <View style={styles.distanceBadge}>
            <Text style={styles.distanceText}>
              {formatDistance(room.distanceMeters, distanceUnit)}
            </Text>
          </View>
        </View>

        {room.description && (
          <Text style={styles.description} numberOfLines={2}>
            {room.description}
          </Text>
        )}

        <View style={styles.footer}>
          <View style={styles.memberInfo}>
            <View style={[styles.memberDot, isRecentlyActive() && styles.memberDotActive]} />
            <Text style={styles.memberCount}>
              {room.memberCount} {room.memberCount === 1 ? 'member' : 'members'}
            </Text>
          </View>
          <Text style={styles.lastActivity}>{formatLastActivity(room.lastActivityAt)}</Text>
        </View>

        {/* Tags */}
        {room.tags && room.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {room.tags.slice(0, 3).map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
            {room.tags.length > 3 && (
              <Text style={styles.moreTagsText}>+{room.tags.length - 3}</Text>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
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
  avatarContainer: {
    position: 'relative',
    marginRight: spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryContainer.light,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: colors.onPrimaryContainer.light,
    fontSize: 22,
    fontWeight: 'bold',
  },
  activityIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.online,
    borderWidth: 2,
    borderColor: colors.surface.light,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onSurface.light,
    flex: 1,
    marginRight: spacing.sm,
  },
  distanceBadge: {
    backgroundColor: colors.primaryContainer.light,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.full,
  },
  distanceText: {
    color: colors.onPrimaryContainer.light,
    fontSize: 12,
    fontWeight: '500',
  },
  description: {
    fontSize: 13,
    color: colors.onSurfaceVariant.light,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.offline,
    marginRight: spacing.xs,
  },
  memberDotActive: {
    backgroundColor: colors.online,
  },
  memberCount: {
    fontSize: 13,
    color: colors.onSurfaceVariant.light,
  },
  lastActivity: {
    fontSize: 12,
    color: colors.onSurfaceVariant.light,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  tag: {
    backgroundColor: colors.secondaryContainer.light,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginRight: spacing.xs,
  },
  tagText: {
    fontSize: 11,
    color: colors.onSecondaryContainer.light,
  },
  moreTagsText: {
    fontSize: 11,
    color: colors.onSurfaceVariant.light,
    marginLeft: spacing.xxs,
  },
});

export default RoomListCard;
