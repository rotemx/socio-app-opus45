import { View, Text, StyleSheet } from 'react-native';
import type { ReadStatus } from './types';
import { colors } from '../../tokens';

export interface ReadReceiptProps {
  status: ReadStatus;
}

/**
 * Read receipt indicator showing message delivery status
 * - Sending: clock icon (dots)
 * - Sent: single checkmark
 * - Delivered: double checkmark (outline)
 * - Read: double checkmark (filled blue)
 */
export function ReadReceipt({ status }: ReadReceiptProps): React.JSX.Element {
  if (status === 'sending') {
    return (
      <View style={styles.container} accessibilityLabel="Sending">
        <Text style={styles.sendingDots}>•••</Text>
      </View>
    );
  }

  if (status === 'sent') {
    return (
      <View style={styles.container} accessibilityLabel="Sent">
        <Text style={styles.checkmark}>✓</Text>
      </View>
    );
  }

  if (status === 'delivered') {
    return (
      <View style={styles.container} accessibilityLabel="Delivered">
        <View style={styles.doubleCheck}>
          <Text style={styles.checkmark}>✓</Text>
          <Text style={[styles.checkmark, styles.secondCheck]}>✓</Text>
        </View>
      </View>
    );
  }

  // Read status
  return (
    <View style={styles.container} accessibilityLabel="Read">
      <View style={styles.doubleCheck}>
        <Text style={styles.checkmarkRead}>✓</Text>
        <Text style={[styles.checkmarkRead, styles.secondCheck]}>✓</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginLeft: 4,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 16,
  },
  sendingDots: {
    fontSize: 8,
    color: colors.onSurfaceVariant.light,
    opacity: 0.6,
    letterSpacing: 1,
  },
  checkmark: {
    fontSize: 12,
    color: colors.onSurfaceVariant.light,
    opacity: 0.6,
    fontWeight: '600',
  },
  checkmarkRead: {
    fontSize: 12,
    color: colors.primary.light,
    fontWeight: '600',
  },
  doubleCheck: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  secondCheck: {
    marginLeft: -6,
  },
});

export default ReadReceipt;
