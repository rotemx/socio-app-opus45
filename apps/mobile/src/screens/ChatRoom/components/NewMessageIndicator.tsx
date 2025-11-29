import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated, Platform, useColorScheme } from 'react-native';
import { colors, spacing, radius } from '@socio/ui';

export interface NewMessageIndicatorProps {
  visible: boolean;
  count: number;
  onPress: () => void;
}

/**
 * Banner indicator shown when new messages arrive while scrolled up
 */
export function NewMessageIndicator({
  visible,
  count,
  onPress,
}: NewMessageIndicatorProps): React.JSX.Element | null {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const translateY = React.useRef(new Animated.Value(-50)).current;
  const [shouldRender, setShouldRender] = React.useState(visible && count > 0);

  React.useEffect(() => {
    const shouldBeVisible = visible && count > 0;

    if (shouldBeVisible) {
      setShouldRender(true);
    }

    const animation = Animated.spring(translateY, {
      toValue: shouldBeVisible ? 0 : -50,
      useNativeDriver: true,
      tension: 100,
      friction: 10,
    });

    animation.start(({ finished }) => {
      if (finished && !shouldBeVisible) {
        setShouldRender(false);
      }
    });

    return () => animation.stop();
  }, [visible, count, translateY]);

  if (!shouldRender) {
    return null;
  }

  const shadowStyle = Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
    },
    android: {
      elevation: 4,
    },
  });

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }] }]}>
      <TouchableOpacity
        style={[
          styles.banner,
          { backgroundColor: isDark ? colors.primary.dark : colors.primary.light },
          shadowStyle,
        ]}
        onPress={onPress}
        activeOpacity={0.9}
        accessibilityLabel={`${count} new message${count > 1 ? 's' : ''}. Tap to scroll to latest.`}
        accessibilityRole="button"
        accessibilityHint="Scrolls to the newest messages"
      >
        <Text style={[styles.text, { color: isDark ? colors.onPrimary.dark : colors.onPrimary.light }]}>
          {count} new message{count > 1 ? 's' : ''}
        </Text>
        <Text style={[styles.arrow, { color: isDark ? colors.onPrimary.dark : colors.onPrimary.light }]}>↓</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.md,
    right: spacing.md,
    zIndex: 20,
    alignItems: 'center',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
  },
  arrow: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default NewMessageIndicator;
