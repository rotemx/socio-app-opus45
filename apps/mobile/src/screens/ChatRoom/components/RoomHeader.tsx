import { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
} from 'react-native';
import { colors, spacing, Avatar } from '@socio/ui';
import type { ChatRoom, RoomMember } from '@socio/types';
import { RoomInfoSheet } from './RoomInfoSheet';
import { MemberListSheet } from './MemberListSheet';

/** Design constants */
const HEADER_HEIGHT = 56;
const TOUCH_TARGET = 48;

export interface RoomHeaderProps {
  /** Room data */
  room: ChatRoom;
  /** Room members */
  members: RoomMember[];
  /** Online member count */
  onlineCount: number;
  /** Back button handler */
  onBack: () => void;
  /** Search button handler */
  onSearch?: () => void;
  /** More menu handler */
  onMore?: () => void;
  /** Test ID */
  testID?: string;
}

/**
 * RoomHeader - Chat room header with room info and member list access
 *
 * Features:
 * - Back button navigation
 * - Room avatar (40dp)
 * - Room name + member count (tappable)
 * - Online member indicators
 * - Action buttons: search, more menu
 * - Tap header to open room info sheet
 */
export function RoomHeader({
  room,
  members,
  onlineCount,
  onBack,
  onSearch,
  onMore,
  testID,
}: RoomHeaderProps): React.JSX.Element {
  const [isInfoSheetVisible, setIsInfoSheetVisible] = useState(false);
  const [isMemberListVisible, setIsMemberListVisible] = useState(false);

  const handleHeaderPress = useCallback(() => {
    setIsInfoSheetVisible(true);
  }, []);

  const handleInfoSheetClose = useCallback(() => {
    setIsInfoSheetVisible(false);
  }, []);

  const handleMemberListOpen = useCallback(() => {
    setIsInfoSheetVisible(false);
    setIsMemberListVisible(true);
  }, []);

  const handleMemberListClose = useCallback(() => {
    setIsMemberListVisible(false);
  }, []);

  const handleBackPress = useCallback(() => {
    onBack();
  }, [onBack]);

  const handleSearchPress = useCallback(() => {
    onSearch?.();
  }, [onSearch]);

  const handleMorePress = useCallback(() => {
    onMore?.();
  }, [onMore]);

  return (
    <>
      <View style={styles.container} testID={testID}>
        {/* Status bar spacer for iOS */}
        {Platform.select({ ios: <View style={styles.statusBarSpacer} />, default: null })}

        <View style={styles.header}>
          {/* Back button */}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleBackPress}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>

          {/* Room info (tappable area) */}
          <TouchableOpacity
            style={styles.roomInfo}
            onPress={handleHeaderPress}
            accessibilityRole="button"
            accessibilityLabel={`${room.name}, ${members.length} members, ${onlineCount} online. Tap for room info`}
          >
            <Avatar
              src={room.avatarUrl}
              name={room.name}
              size="sm"
            />
            <View style={styles.roomDetails}>
              <Text style={styles.roomName} numberOfLines={1}>
                {room.name}
              </Text>
              <View style={styles.memberInfo}>
                <Text style={styles.memberCount}>
                  {members.length} members
                </Text>
                {onlineCount > 0 && (
                  <>
                    <View style={styles.dot} />
                    <View style={styles.onlineIndicator}>
                      <View style={styles.onlineDot} />
                      <Text style={styles.onlineCount}>{onlineCount}</Text>
                    </View>
                  </>
                )}
              </View>
            </View>
          </TouchableOpacity>

          {/* Action buttons */}
          <View style={styles.actions}>
            {onSearch && (
              <TouchableOpacity
                style={styles.iconButton}
                onPress={handleSearchPress}
                accessibilityRole="button"
                accessibilityLabel="Search messages"
              >
                <Text style={styles.actionIcon}>🔍</Text>
              </TouchableOpacity>
            )}
            {onMore && (
              <TouchableOpacity
                style={styles.iconButton}
                onPress={handleMorePress}
                accessibilityRole="button"
                accessibilityLabel="More options"
              >
                <Text style={styles.actionIcon}>⋮</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Room Info Sheet */}
      <RoomInfoSheet
        visible={isInfoSheetVisible}
        room={room}
        members={members}
        onlineCount={onlineCount}
        onClose={handleInfoSheetClose}
        onViewMembers={handleMemberListOpen}
      />

      {/* Member List Sheet */}
      <MemberListSheet
        visible={isMemberListVisible}
        members={members}
        onClose={handleMemberListClose}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface.light,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant.light,
  },
  statusBarSpacer: {
    height: StatusBar.currentHeight ?? 44,
  },
  header: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  iconButton: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 24,
    color: colors.onSurface.light,
  },
  roomInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    height: TOUCH_TARGET,
  },
  roomDetails: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  roomName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onSurface.light,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  memberCount: {
    fontSize: 12,
    color: colors.onSurfaceVariant.light,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.onSurfaceVariant.light,
    marginHorizontal: spacing.xs,
  },
  onlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.online,
    marginRight: 4,
  },
  onlineCount: {
    fontSize: 12,
    color: colors.online,
  },
  actions: {
    flexDirection: 'row',
  },
  actionIcon: {
    fontSize: 20,
    color: colors.onSurfaceVariant.light,
  },
});

export default RoomHeader;
