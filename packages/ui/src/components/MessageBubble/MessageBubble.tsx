import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import type { MessageBubbleProps, GroupPosition } from './types';
import { ReadReceipt } from './ReadReceipt';
import { ReplyPreview } from './ReplyPreview';
import { colors, spacing } from '../../tokens';

/**
 * Design specs:
 * - Border radius: 16dp (4dp on grouped corners)
 * - Padding: 8dp vertical, 12dp horizontal
 * - Max width: 75% viewport
 * - Timestamp: 11sp, 60% opacity
 */
const BORDER_RADIUS = 16;
const BORDER_RADIUS_GROUPED = 4;

/**
 * MessageBubble component following Telegram-style design
 *
 * Features:
 * - Sent messages: right-aligned, primary-container color
 * - Received messages: left-aligned, surface-variant color
 * - Message grouping with adjusted corners
 * - Timestamp inside bubble (bottom-right)
 * - Read receipt indicators
 * - Reply preview support
 */
export function MessageBubble({
  message,
  isSent,
  groupPosition = 'single',
  showTimestamp = true,
  readStatus,
  onReplyPress,
  senderName,
  showSenderName = false,
}: MessageBubbleProps): React.JSX.Element {
  const { width: windowWidth } = useWindowDimensions();
  const maxWidth = windowWidth * 0.75;

  const formatTime = (date: Date): string => {
    try {
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '--:--';
    }
  };

  const getBorderRadius = (position: GroupPosition, sent: boolean) => {
    const baseRadius = BORDER_RADIUS;
    const groupedRadius = BORDER_RADIUS_GROUPED;

    // For sent messages, group the bottom-right corner
    // For received messages, group the bottom-left corner
    if (sent) {
      switch (position) {
        case 'first':
          return {
            borderTopLeftRadius: baseRadius,
            borderTopRightRadius: baseRadius,
            borderBottomLeftRadius: baseRadius,
            borderBottomRightRadius: groupedRadius,
          };
        case 'middle':
          return {
            borderTopLeftRadius: baseRadius,
            borderTopRightRadius: groupedRadius,
            borderBottomLeftRadius: baseRadius,
            borderBottomRightRadius: groupedRadius,
          };
        case 'last':
          return {
            borderTopLeftRadius: baseRadius,
            borderTopRightRadius: groupedRadius,
            borderBottomLeftRadius: baseRadius,
            borderBottomRightRadius: baseRadius,
          };
        default: // single
          return {
            borderTopLeftRadius: baseRadius,
            borderTopRightRadius: baseRadius,
            borderBottomLeftRadius: baseRadius,
            borderBottomRightRadius: baseRadius,
          };
      }
    } else {
      switch (position) {
        case 'first':
          return {
            borderTopLeftRadius: baseRadius,
            borderTopRightRadius: baseRadius,
            borderBottomLeftRadius: groupedRadius,
            borderBottomRightRadius: baseRadius,
          };
        case 'middle':
          return {
            borderTopLeftRadius: groupedRadius,
            borderTopRightRadius: baseRadius,
            borderBottomLeftRadius: groupedRadius,
            borderBottomRightRadius: baseRadius,
          };
        case 'last':
          return {
            borderTopLeftRadius: groupedRadius,
            borderTopRightRadius: baseRadius,
            borderBottomLeftRadius: baseRadius,
            borderBottomRightRadius: baseRadius,
          };
        default: // single
          return {
            borderTopLeftRadius: baseRadius,
            borderTopRightRadius: baseRadius,
            borderBottomLeftRadius: baseRadius,
            borderBottomRightRadius: baseRadius,
          };
      }
    }
  };

  const bubbleStyle = [
    styles.bubble,
    isSent ? styles.bubbleSent : styles.bubbleReceived,
    getBorderRadius(groupPosition, isSent),
    { maxWidth },
    // Adjust margin for grouped messages
    groupPosition !== 'single' && groupPosition !== 'first' && styles.groupedMargin,
  ];

  const showSender = showSenderName && !isSent && (groupPosition === 'single' || groupPosition === 'first');

  return (
    <View
      style={[styles.container, isSent ? styles.containerSent : styles.containerReceived]}
      accessibilityLabel={`${isSent ? 'Sent' : 'Received'} message: ${message.content}`}
    >
      <View style={bubbleStyle}>
        {/* Sender name for group chats */}
        {showSender && senderName && (
          <Text style={styles.senderName}>{senderName}</Text>
        )}

        {/* Reply preview */}
        {message.replyTo && (
          <ReplyPreview
            replyTo={message.replyTo}
            isSent={isSent}
            onPress={onReplyPress ? () => {
              const replyId = message.replyTo?.id;
              if (replyId) onReplyPress(replyId);
            } : undefined}
          />
        )}

        {/* Message content */}
        <Text style={[styles.content, isSent ? styles.contentSent : styles.contentReceived]}>
          {message.content}
        </Text>

        {/* Timestamp and read status row */}
        {(showTimestamp || (isSent && readStatus)) && (
          <View style={styles.metaRow}>
            {message.isEdited && (
              <Text style={[styles.edited, isSent ? styles.editedSent : styles.editedReceived]}>
                edited
              </Text>
            )}
            {showTimestamp && (
              <Text style={[styles.timestamp, isSent ? styles.timestampSent : styles.timestampReceived]}>
                {formatTime(message.createdAt)}
              </Text>
            )}
            {isSent && readStatus && <ReadReceipt status={readStatus} />}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: 1,
  },
  containerSent: {
    alignItems: 'flex-end',
  },
  containerReceived: {
    alignItems: 'flex-start',
  },
  bubble: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md - 4, // 12dp
  },
  bubbleSent: {
    backgroundColor: colors.primaryContainer.light,
  },
  bubbleReceived: {
    backgroundColor: colors.surfaceVariant.light,
  },
  groupedMargin: {
    marginTop: 1,
  },
  senderName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary.light,
    marginBottom: spacing.xxs,
  },
  content: {
    fontSize: 15,
    lineHeight: 20,
  },
  contentSent: {
    color: colors.onPrimaryContainer.light,
  },
  contentReceived: {
    color: colors.onSurfaceVariant.light,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: spacing.xxs,
  },
  timestamp: {
    fontSize: 11,
    opacity: 0.6,
  },
  timestampSent: {
    color: colors.onPrimaryContainer.light,
  },
  timestampReceived: {
    color: colors.onSurfaceVariant.light,
  },
  edited: {
    fontSize: 11,
    fontStyle: 'italic',
    marginRight: spacing.xs,
    opacity: 0.6,
  },
  editedSent: {
    color: colors.onPrimaryContainer.light,
  },
  editedReceived: {
    color: colors.onSurfaceVariant.light,
  },
});

export default MessageBubble;
