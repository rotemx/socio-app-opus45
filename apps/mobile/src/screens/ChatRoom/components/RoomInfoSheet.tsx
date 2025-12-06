import { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { colors, spacing, radius, Avatar } from '@socio/ui';
import type { ChatRoom, RoomMember } from '@socio/types';

export interface RoomInfoSheetProps {
  /** Whether the sheet is visible */
  visible: boolean;
  /** Room data */
  room: ChatRoom;
  /** Room members */
  members: RoomMember[];
  /** Online member count */
  onlineCount: number;
  /** Close handler */
  onClose: () => void;
  /** View all members handler */
  onViewMembers: () => void;
  /** Test ID */
  testID?: string;
}

/**
 * RoomInfoSheet - Bottom sheet displaying room information
 *
 * Features:
 * - Room avatar and name
 * - Room description
 * - Member count with online indicator
 * - Quick access to member list
 * - Room settings summary
 */
export function RoomInfoSheet({
  visible,
  room,
  members,
  onlineCount,
  onClose,
  onViewMembers,
  testID,
}: RoomInfoSheetProps): React.JSX.Element {
  const handleViewMembers = useCallback(() => {
    onViewMembers();
  }, [onViewMembers]);

  // Get preview of first 5 members
  const memberPreview = members.slice(0, 5);
  const remainingCount = members.length - memberPreview.length;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      testID={testID}
      accessibilityLabel="Room information"
      accessibilityViewIsModal
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Handle indicator (decorative) */}
          <View
            style={styles.handleContainer}
            accessible={false}
            importantForAccessibility="no"
          >
            <View style={styles.handle} />
          </View>

          <ScrollView
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            accessibilityLabel="Room details"
          >
            {/* Room avatar and name */}
            <View style={styles.headerSection}>
              <Avatar
                src={room.avatarUrl}
                name={room.name}
                size="lg"
              />
              <Text style={styles.roomName}>{room.name}</Text>
              {room.description && (
                <Text style={styles.description}>{room.description}</Text>
              )}
            </View>

            {/* Stats row */}
            <View
              style={styles.statsRow}
              accessibilityRole="summary"
              accessibilityLabel={`${members.length} members, ${onlineCount} online`}
            >
              <View style={styles.stat} accessible={false}>
                <Text style={styles.statValue}>{members.length}</Text>
                <Text style={styles.statLabel}>Members</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat} accessible={false}>
                <View style={styles.onlineValue}>
                  <View style={styles.onlineDot} />
                  <Text style={styles.statValue}>{onlineCount}</Text>
                </View>
                <Text style={styles.statLabel}>Online</Text>
              </View>
            </View>

            {/* Members section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Members</Text>
                <TouchableOpacity
                  onPress={handleViewMembers}
                  accessibilityRole="button"
                  accessibilityLabel="View all members"
                >
                  <Text style={styles.seeAllText}>See all</Text>
                </TouchableOpacity>
              </View>

              {/* Member preview avatars */}
              <View style={styles.memberPreview}>
                {memberPreview.map((member) => (
                  <View key={member.id} style={styles.memberAvatar}>
                    <Avatar
                      src={member.user?.avatarUrl}
                      name={member.user?.displayName ?? member.user?.username ?? 'User'}
                      size="sm"
                    />
                  </View>
                ))}
                {remainingCount > 0 && (
                  <View style={styles.remainingCount}>
                    <Text style={styles.remainingText}>+{remainingCount}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Room settings summary */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Settings</Text>
              <View style={styles.settingsGrid} accessibilityRole="list">
                <View
                  style={styles.settingItem}
                  accessibilityRole="text"
                  accessibilityLabel={`Voice ${room.settings.voiceEnabled ? 'enabled' : 'disabled'}`}
                >
                  <Text style={styles.settingIcon} accessible={false}>
                    {room.settings.voiceEnabled ? '🎤' : '🔇'}
                  </Text>
                  <Text style={styles.settingText} accessible={false}>
                    Voice {room.settings.voiceEnabled ? 'On' : 'Off'}
                  </Text>
                </View>
                <View
                  style={styles.settingItem}
                  accessibilityRole="text"
                  accessibilityLabel={`Video ${room.settings.videoEnabled ? 'enabled' : 'disabled'}`}
                >
                  <Text style={styles.settingIcon} accessible={false}>
                    {room.settings.videoEnabled ? '📹' : '📵'}
                  </Text>
                  <Text style={styles.settingText} accessible={false}>
                    Video {room.settings.videoEnabled ? 'On' : 'Off'}
                  </Text>
                </View>
                <View
                  style={styles.settingItem}
                  accessibilityRole="text"
                  accessibilityLabel={`Media sharing ${room.settings.allowMedia ? 'allowed' : 'disabled'}`}
                >
                  <Text style={styles.settingIcon} accessible={false}>
                    {room.settings.allowMedia ? '🖼️' : '🚫'}
                  </Text>
                  <Text style={styles.settingText} accessible={false}>
                    Media {room.settings.allowMedia ? 'On' : 'Off'}
                  </Text>
                </View>
                <View
                  style={styles.settingItem}
                  accessibilityRole="text"
                  accessibilityLabel={`Room is ${room.isPublic ? 'public' : 'private'}`}
                >
                  <Text style={styles.settingIcon} accessible={false}>
                    {room.isPublic ? '🌐' : '🔒'}
                  </Text>
                  <Text style={styles.settingText} accessible={false}>
                    {room.isPublic ? 'Public' : 'Private'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Tags */}
            {room.tags.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Tags</Text>
                <View
                  style={styles.tagsContainer}
                  accessibilityRole="list"
                  accessibilityLabel={`Tags: ${room.tags.join(', ')}`}
                >
                  {room.tags.map((tag) => (
                    <View
                      key={tag}
                      style={styles.tag}
                      accessibilityRole="text"
                      accessibilityLabel={`Tag ${tag}`}
                    >
                      <Text style={styles.tagText} accessible={false}>#{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Close button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface.light,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '80%',
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.outlineVariant.light,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
  },
  headerSection: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  roomName: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.onSurface.light,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: colors.onSurfaceVariant.light,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.outlineVariant.light,
  },
  stat: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.onSurface.light,
  },
  statLabel: {
    fontSize: 12,
    color: colors.onSurfaceVariant.light,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.outlineVariant.light,
  },
  onlineValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.online,
    marginRight: spacing.xs,
  },
  section: {
    paddingVertical: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurface.light,
  },
  seeAllText: {
    fontSize: 14,
    color: colors.primary.light,
  },
  memberPreview: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberAvatar: {
    marginRight: -spacing.sm,
    borderWidth: 2,
    borderColor: colors.surface.light,
    borderRadius: 18,
  },
  remainingCount: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceContainerHigh.light,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.xs,
  },
  remainingText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant.light,
  },
  settingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLow.light,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  settingIcon: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  settingText: {
    fontSize: 13,
    color: colors.onSurfaceVariant.light,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tag: {
    backgroundColor: colors.primaryContainer.light,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  tagText: {
    fontSize: 13,
    color: colors.onPrimaryContainer.light,
  },
  closeButton: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerHigh.light,
    borderRadius: radius.lg,
  },
  closeText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.onSurfaceVariant.light,
  },
});

export default RoomInfoSheet;
