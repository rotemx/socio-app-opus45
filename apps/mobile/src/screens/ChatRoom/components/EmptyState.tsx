import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { colors, spacing } from '@socio/ui';

/**
 * Empty state shown when there are no messages in the chat room
 */
export function EmptyState(): React.JSX.Element {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="text"
      accessibilityLabel="No messages yet. Be the first to say hello!"
    >
      <Text style={styles.emoji} accessibilityElementsHidden>
        💬
      </Text>
      <Text style={[styles.title, { color: isDark ? colors.onSurface.dark : colors.onSurface.light }]}>
        No messages yet
      </Text>
      <Text
        style={[styles.subtitle, { color: isDark ? colors.onSurfaceVariant.dark : colors.onSurfaceVariant.light }]}
      >
        Be the first to say hello!
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
});

export default EmptyState;
