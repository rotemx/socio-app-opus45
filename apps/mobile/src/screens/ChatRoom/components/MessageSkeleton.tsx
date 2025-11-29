import React from 'react';
import { View, StyleSheet, Animated, useColorScheme } from 'react-native';
import { colors, spacing, radius } from '@socio/ui';

export interface MessageSkeletonProps {
  isOwn?: boolean;
}

/**
 * Skeleton placeholder for loading messages
 * Includes shimmer animation for better UX
 */
export function MessageSkeleton({ isOwn = false }: MessageSkeletonProps): React.JSX.Element {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const shimmerAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const bubbleColor = isOwn
    ? isDark
      ? colors.primaryContainer.dark
      : colors.primaryContainer.light
    : isDark
      ? colors.surfaceContainerHigh.dark
      : colors.surfaceContainerHigh.light;

  return (
    <View
      style={[styles.container, isOwn && styles.containerOwn]}
      accessible
      accessibilityRole="none"
      accessibilityLabel="Loading message"
    >
      <Animated.View
        style={[
          styles.bubble,
          isOwn ? styles.bubbleOwn : styles.bubbleOther,
          { backgroundColor: bubbleColor, opacity },
        ]}
      />
    </View>
  );
}

/**
 * Multiple skeleton messages for loading state
 */
export function MessageSkeletonList(): React.JSX.Element {
  return (
    <View style={styles.list} accessible accessibilityLabel="Loading messages">
      <MessageSkeleton isOwn={false} />
      <MessageSkeleton isOwn />
      <MessageSkeleton isOwn={false} />
      <MessageSkeleton isOwn />
      <MessageSkeleton isOwn={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
    maxWidth: '75%',
  },
  containerOwn: {
    alignSelf: 'flex-end',
  },
  bubble: {
    borderRadius: radius.lg,
    height: 40,
  },
  bubbleOwn: {
    width: 180,
  },
  bubbleOther: {
    width: 200,
  },
  list: {
    flex: 1,
    paddingTop: spacing.md,
  },
});

export default MessageSkeleton;
