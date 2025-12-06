import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { MessageWithReply } from './types';
import { colors, spacing, radius } from '../../tokens';

export interface ReplyPreviewProps {
  replyTo: NonNullable<MessageWithReply['replyTo']>;
  isSent: boolean;
  onPress?: () => void;
}

/**
 * Reply preview shown at the top of a message bubble
 * Shows the sender name and a truncated version of the replied message
 */
export function ReplyPreview({ replyTo, isSent, onPress }: ReplyPreviewProps): React.JSX.Element {
  const getContentPreview = (): string => {
    switch (replyTo.contentType) {
      case 'image':
        return '📷 Photo';
      case 'video':
        return '🎥 Video';
      case 'audio':
        return '🎵 Audio';
      case 'file':
        return '📎 File';
      case 'location':
        return '📍 Location';
      default:
        return replyTo.content;
    }
  };

  const containerStyle = [
    styles.container,
    isSent ? styles.containerSent : styles.containerReceived,
  ];

  const accentStyle = [
    styles.accent,
    isSent ? styles.accentSent : styles.accentReceived,
  ];

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
      accessibilityLabel={`Reply to ${replyTo.senderName}: ${getContentPreview()}`}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <View style={accentStyle} />
      <View style={styles.content}>
        <Text
          style={[styles.senderName, isSent ? styles.textSent : styles.textReceived]}
          numberOfLines={1}
        >
          {replyTo.senderName}
        </Text>
        <Text
          style={[styles.preview, isSent ? styles.previewSent : styles.previewReceived]}
          numberOfLines={1}
        >
          {getContentPreview()}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: radius.sm,
    marginBottom: spacing.xs,
    overflow: 'hidden',
  },
  containerSent: {
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
  },
  containerReceived: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  accent: {
    width: 3,
  },
  accentSent: {
    backgroundColor: colors.onPrimaryContainer.light,
  },
  accentReceived: {
    backgroundColor: colors.primary.light,
  },
  content: {
    flex: 1,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  textSent: {
    color: colors.onPrimaryContainer.light,
  },
  textReceived: {
    color: colors.primary.light,
  },
  preview: {
    fontSize: 13,
  },
  previewSent: {
    color: colors.onPrimaryContainer.light,
    opacity: 0.8,
  },
  previewReceived: {
    color: colors.onSurfaceVariant.light,
  },
});

export default ReplyPreview;
