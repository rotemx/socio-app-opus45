import { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  FlatList,
  StyleSheet,
} from 'react-native';
import { colors, spacing, radius, Avatar } from '@socio/ui';
import type { RoomMember, UserRole } from '@socio/types';

export interface MemberListSheetProps {
  /** Whether the sheet is visible */
  visible: boolean;
  /** Room members */
  members: RoomMember[];
  /** Close handler */
  onClose: () => void;
  /** Member tap handler */
  onMemberPress?: (member: RoomMember) => void;
  /** Test ID */
  testID?: string;
}

/** Role badge labels */
const ROLE_CONFIG: Record<UserRole, { label: string }> = {
  creator: { label: 'Creator' },
  admin: { label: 'Admin' },
  moderator: { label: 'Mod' },
  member: { label: '' },
};

/** Get role badge style based on role */
const getRoleBadgeStyle = (role: UserRole) => {
  switch (role) {
    case 'creator':
      return styles.creatorBadge;
    case 'admin':
      return styles.adminBadge;
    case 'moderator':
      return styles.moderatorBadge;
    default:
      return null;
  }
};

interface MemberItemProps {
  member: RoomMember;
  onPress?: (member: RoomMember) => void;
}

/**
 * MemberItem - Single member row in the list
 */
function MemberItem({ member, onPress }: MemberItemProps): React.JSX.Element {
  const displayName = member.user?.displayName ?? member.user?.username ?? 'Unknown';
  const roleConfig = ROLE_CONFIG[member.role];

  const handlePress = useCallback(() => {
    onPress?.(member);
  }, [member, onPress]);

  // Check if user was active in last 5 minutes
  const isOnline = member.user?.lastActiveAt
    ? new Date().getTime() - new Date(member.user.lastActiveAt).getTime() < 5 * 60 * 1000
    : false;

  return (
    <TouchableOpacity
      style={styles.memberItem}
      onPress={handlePress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${displayName}${roleConfig.label ? `, ${roleConfig.label}` : ''}${isOnline ? ', online' : ''}`}
    >
      <View style={styles.avatarContainer}>
        <Avatar
          src={member.user?.avatarUrl}
          name={displayName}
          size="md"
          showOnlineStatus
          isOnline={isOnline}
        />
      </View>
      <View style={styles.memberInfo}>
        <Text style={styles.memberName} numberOfLines={1}>
          {displayName}
        </Text>
        {member.user?.bio && (
          <Text style={styles.memberBio} numberOfLines={1}>
            {member.user.bio}
          </Text>
        )}
      </View>
      {roleConfig.label && (
        <View style={[styles.roleBadge, getRoleBadgeStyle(member.role)]}>
          <Text style={styles.roleText}>{roleConfig.label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

/**
 * MemberListSheet - Bottom sheet with scrollable member list
 *
 * Features:
 * - Full member list with search
 * - Online status indicators
 * - Role badges (Creator, Admin, Mod)
 * - Tap member for profile
 */
export function MemberListSheet({
  visible,
  members,
  onClose,
  onMemberPress,
  testID,
}: MemberListSheetProps): React.JSX.Element {
  // Sort members by role priority, then alphabetically by name
  const sortedMembers = useMemo(() => {
    const roleOrder: Record<UserRole, number> = {
      creator: 0,
      admin: 1,
      moderator: 2,
      member: 3,
    };

    return [...members].sort((a, b) => {
      // First by role
      const roleComparison = roleOrder[a.role] - roleOrder[b.role];
      if (roleComparison !== 0) {
        return roleComparison;
      }

      // Then by name
      const nameA = a.user?.displayName ?? a.user?.username ?? '';
      const nameB = b.user?.displayName ?? b.user?.username ?? '';
      return nameA.localeCompare(nameB);
    });
  }, [members]);

  const renderMember = useCallback(
    ({ item }: { item: RoomMember }) => (
      <MemberItem member={item} onPress={onMemberPress} />
    ),
    [onMemberPress]
  );

  const keyExtractor = useCallback((item: RoomMember) => item.id, []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      testID={testID}
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

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Members ({members.length})</Text>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close member list"
            >
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Member list */}
          <FlatList
            data={sortedMembers}
            renderItem={renderMember}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant.light,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.onSurface.light,
  },
  closeIcon: {
    fontSize: 20,
    color: colors.onSurfaceVariant.light,
    padding: spacing.xs,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  avatarContainer: {
    marginRight: spacing.md,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.onSurface.light,
  },
  memberBio: {
    fontSize: 13,
    color: colors.onSurfaceVariant.light,
    marginTop: 2,
  },
  roleBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.sm,
  },
  creatorBadge: {
    backgroundColor: colors.primary.light,
  },
  adminBadge: {
    backgroundColor: '#FF9800',
  },
  moderatorBadge: {
    backgroundColor: '#9C27B0',
  },
  roleText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onPrimary.light,
  },
  separator: {
    height: 1,
    backgroundColor: colors.outlineVariant.light,
    marginLeft: spacing.lg + 48 + spacing.md, // Avatar width + margin
  },
});

export default MemberListSheet;
