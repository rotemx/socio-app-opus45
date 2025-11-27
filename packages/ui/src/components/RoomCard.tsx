import type { RoomWithDistance } from '@socio/types';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { spacing, colors, radius } from '../tokens';

export interface RoomCardProps {
  room: RoomWithDistance;
  onPress?: () => void;
  showDistance?: boolean;
  showMemberCount?: boolean;
  showLastActivity?: boolean;
}

export function RoomCard({
  room,
  onPress,
  showDistance = true,
  showMemberCount = true,
  showLastActivity = true,
}: RoomCardProps) {
  const formatDistance = (meters: number): string => {
    if (meters < 150) {
      return `${Math.round(meters * 3.28084)} ft away`;
    }
    const miles = meters / 1609.34;
    if (miles < 1) {
      return `${miles.toFixed(1)} mi`;
    }
    return `${miles.toFixed(1)} mi`;
  };

  const formatLastActivity = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return new Date(date).toLocaleDateString();
  };

  const styles = StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
      backgroundColor: colors.surface.light,
      borderRadius: radius.md,
      marginVertical: spacing.xs,
      elevation: 1, // For Android shadow
      shadowColor: '#000', // For iOS shadow
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 1.41,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: radius.full,
      backgroundColor: colors.primaryContainer.light, // Placeholder color
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.md,
    },
    avatarText: {
      color: colors.onPrimaryContainer.light,
      fontSize: 20,
      fontWeight: 'bold',
    },
    content: {
      flex: 1,
    },
    name: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.onSurface.light,
    },
    description: {
      fontSize: 12,
      color: colors.onSurfaceVariant.light,
      marginTop: spacing.xs,
    },
    details: {
      flexDirection: 'row',
      marginTop: spacing.xs,
    },
    detailText: {
      fontSize: 10,
      color: colors.onSurfaceVariant.light,
      marginRight: spacing.sm,
    },
    tagsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: spacing.xs,
    },
    tag: {
      backgroundColor: colors.secondaryContainer.light,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.xxs,
      marginRight: spacing.xs,
      marginBottom: spacing.xs,
    },
    tagText: {
      fontSize: 10,
      color: colors.onSecondaryContainer.light,
    },
  });

  const displayDistance = showDistance && room.distanceMeters !== undefined;
  const displayMemberCount = showMemberCount && room.memberCount !== undefined;
  const displayLastActivity = showLastActivity && room.lastActivityAt !== undefined;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.avatar}>
        {/* Placeholder for Avatar Image */}
        <Text style={styles.avatarText}>{room.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={1}>
          {room.name}
        </Text>
        {room.description && (
          <Text style={styles.description} numberOfLines={2}>
            {room.description}
          </Text>
        )}
        <View style={styles.details}>
          {displayDistance && (
            <Text style={styles.detailText}>{formatDistance(room.distanceMeters!)}</Text>
          )}
          {displayMemberCount && <Text style={styles.detailText}>{room.memberCount} members</Text>}
          {displayLastActivity && (
            <Text style={styles.detailText}>
              Last active: {formatLastActivity(room.lastActivityAt!)}
            </Text>
          )}
        </View>
        {room.tags && room.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {room.tags.map((tag: string, index: number) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}
