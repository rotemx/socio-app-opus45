import type { Message } from '@socio/types';

/**
 * Read status for sent messages
 * - 'sending': Message is being sent
 * - 'sent': Message delivered to server (single check)
 * - 'delivered': Message delivered to recipient (double check)
 * - 'read': Message read by recipient (filled double check)
 */
export type ReadStatus = 'sending' | 'sent' | 'delivered' | 'read';

/**
 * Grouping position within consecutive messages from same sender
 * - 'single': Standalone message
 * - 'first': First in a group
 * - 'middle': Middle of a group
 * - 'last': Last in a group
 */
export type GroupPosition = 'single' | 'first' | 'middle' | 'last';

/**
 * Extended message with reply information
 */
export interface MessageWithReply extends Message {
  replyTo?: {
    id: string;
    senderId: string;
    senderName: string;
    content: string;
    contentType: Message['contentType'];
  };
}

/**
 * Props for the MessageBubble component
 */
export interface MessageBubbleProps {
  /** The message to display */
  message: MessageWithReply;
  /** Whether this message was sent by the current user */
  isSent: boolean;
  /** Position in message group (for corner rounding) */
  groupPosition?: GroupPosition;
  /** Whether to show the timestamp */
  showTimestamp?: boolean;
  /** Read status for sent messages */
  readStatus?: ReadStatus;
  /** Callback when reply preview is tapped */
  onReplyPress?: (messageId: string) => void;
  /** Sender's display name (for received messages) */
  senderName?: string;
  /** Whether to show sender name (for group chats) */
  showSenderName?: boolean;
}

/**
 * Check if two messages should be grouped
 * Messages are grouped if:
 * - Same sender
 * - Within 60 seconds of each other
 */
export function shouldGroupMessages(
  currentMessage: Message,
  previousMessage: Message | null
): boolean {
  if (!previousMessage) {
    return false;
  }

  if (currentMessage.senderId !== previousMessage.senderId) {
    return false;
  }

  const timeDiff =
    new Date(currentMessage.createdAt).getTime() -
    new Date(previousMessage.createdAt).getTime();

  // Within 60 seconds
  return timeDiff <= 60000;
}

/**
 * Determine group position for a message
 */
export function getGroupPosition(
  message: Message,
  previousMessage: Message | null,
  nextMessage: Message | null
): GroupPosition {
  const groupWithPrev = shouldGroupMessages(message, previousMessage);
  const groupWithNext = nextMessage ? shouldGroupMessages(nextMessage, message) : false;

  if (!groupWithPrev && !groupWithNext) {
    return 'single';
  }
  if (!groupWithPrev && groupWithNext) {
    return 'first';
  }
  if (groupWithPrev && groupWithNext) {
    return 'middle';
  }
  return 'last';
}
