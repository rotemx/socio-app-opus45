import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated, Platform, useColorScheme } from 'react-native';
import { colors, spacing, radius } from '@socio/ui';

export interface ScrollToBottomButtonProps {
  visible: boolean;
  onPress: () => void;
  unreadCount?: number;
}

/**
 * Floating action button that appears when user scrolls up in the chat
 * Shows unread count badge if there are new messages
 */
export function ScrollToBottomButton({
  visible,
  onPress,
  unreadCount = 0,
}: ScrollToBottomButtonProps): React.JSX.Element | null {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const opacity = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(20)).current;
  const [shouldRender, setShouldRender] = React.useState(visible);

  React.useEffect(() => {
    if (visible) {
      setShouldRender(true);
    }

    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: visible ? 0 : 20,
        duration: 200,
        useNativeDriver: true,
      }),
    ]);

    animation.start(({ finished }) => {
      if (finished && !visible) {
        setShouldRender(false);
      }
    });

    return () => animation.stop();
  }, [visible, opacity, translateY]);

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

  const accessibilityLabel =
    unreadCount > 0
      ? `Scroll to bottom. ${unreadCount > 99 ? '99+' : unreadCount} unread messages`
      : 'Scroll to bottom';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <TouchableOpacity
        style={[
          styles.button,
          { backgroundColor: isDark ? colors.surfaceContainerHigh.dark : colors.surfaceContainerHigh.light },
          shadowStyle,
        ]}
        onPress={onPress}
        activeOpacity={0.8}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityHint="Scrolls to the bottom of the chat"
      >
        <Text style={[styles.arrow, { color: isDark ? colors.primary.dark : colors.primary.light }]}>↓</Text>
        {unreadCount > 0 && (
          <Text
            style={[
              styles.badge,
              {
                backgroundColor: isDark ? colors.primary.dark : colors.primary.light,
                color: isDark ? colors.onPrimary.dark : colors.onPrimary.light,
              },
            ]}
            accessibilityElementsHidden
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: spacing.md,
    right: spacing.md,
    zIndex: 10,
  },
  button: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrow: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 4,
    overflow: 'hidden',
  },
});

export default ScrollToBottomButton;
