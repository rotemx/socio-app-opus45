import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { colors, spacing, radius } from '@socio/ui';

export interface DateSeparatorProps {
  date: Date;
}

/**
 * Validate if a date is valid
 */
function isValidDate(d: Date): boolean {
  return d instanceof Date && !isNaN(d.getTime());
}

/**
 * Date separator pill shown between messages on different days
 * or when there's a significant time gap
 */
export function DateSeparator({ date }: DateSeparatorProps): React.JSX.Element {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const formatDate = (d: Date): string => {
    // Validate date input
    if (!isValidDate(d)) {
      return 'Invalid date';
    }

    const now = new Date();
    const messageDate = new Date(d);

    // Compare dates by resetting time to midnight in local timezone
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageMidnight = new Date(
      messageDate.getFullYear(),
      messageDate.getMonth(),
      messageDate.getDate()
    );

    const diffMs = todayMidnight.getTime() - messageMidnight.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays > 0 && diffDays < 7) {
      return messageDate.toLocaleDateString(undefined, { weekday: 'long' });
    } else {
      return messageDate.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: messageDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    }
  };

  const formattedDate = formatDate(date);

  return (
    <View style={styles.container} accessible accessibilityRole="text">
      <View
        style={[
          styles.pill,
          { backgroundColor: isDark ? colors.surfaceContainerHigh.dark : colors.surfaceContainerHigh.light },
        ]}
      >
        <Text
          style={[styles.text, { color: isDark ? colors.onSurfaceVariant.dark : colors.onSurfaceVariant.light }]}
          accessibilityLabel={`Messages from ${formattedDate}`}
        >
          {formattedDate}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default DateSeparator;
