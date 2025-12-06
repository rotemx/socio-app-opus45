import { useEffect } from 'react';
import { StyleSheet, Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { colors, radius } from '../../tokens';
import type { MorphingButtonProps } from './types';
import { CHAT_INPUT_CONSTANTS } from './types';

/**
 * Send icon component
 */
function SendIcon({ color }: { color: string }): React.JSX.Element {
  return (
    <View style={styles.iconContainer}>
      <Animated.Text style={[styles.iconText, { color }]}>
        ➤
      </Animated.Text>
    </View>
  );
}

/**
 * Microphone icon component
 */
function MicIcon({ color }: { color: string }): React.JSX.Element {
  return (
    <View style={styles.iconContainer}>
      <Animated.Text style={[styles.iconText, { color }]}>
        🎤
      </Animated.Text>
    </View>
  );
}

/**
 * MorphingButton - Animated button that morphs between send and microphone icons
 *
 * Features:
 * - Smooth transition animation between states
 * - Support for long press (voice recording)
 * - Pan gesture support for slide-to-cancel
 * - 48dp minimum touch target
 */
export function MorphingButton({
  showSend,
  onPress,
  onLongPress,
  onPressOut,
  disabled = false,
}: MorphingButtonProps): React.JSX.Element {
  const progress = useSharedValue(showSend ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(showSend ? 1 : 0, {
      duration: CHAT_INPUT_CONSTANTS.ANIMATION_DURATION,
    });
  }, [showSend, progress]);

  const sendIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        scale: interpolate(progress.value, [0, 1], [0.5, 1], Extrapolation.CLAMP),
      },
      {
        rotate: `${interpolate(progress.value, [0, 1], [-90, 0], Extrapolation.CLAMP)}deg`,
      },
    ],
  }));

  const micIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [1, 0], Extrapolation.CLAMP),
    transform: [
      {
        scale: interpolate(progress.value, [0, 1], [1, 0.5], Extrapolation.CLAMP),
      },
    ],
  }));

  const buttonBackgroundStyle = useAnimatedStyle(() => ({
    backgroundColor: progress.value > 0.5
      ? colors.primary.light
      : colors.surfaceContainerHigh.light,
  }));

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressOut={onPressOut}
      disabled={disabled}
      delayLongPress={200}
      accessibilityRole="button"
      accessibilityLabel={showSend ? 'Send message' : 'Record voice message'}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.touchTarget,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Animated.View style={[styles.button, buttonBackgroundStyle]}>
        <Animated.View style={[styles.iconWrapper, sendIconStyle]}>
          <SendIcon color={colors.onPrimary.light} />
        </Animated.View>
        <Animated.View style={[styles.iconWrapper, styles.iconAbsolute, micIconStyle]}>
          <MicIcon color={colors.onSurfaceVariant.light} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  touchTarget: {
    width: CHAT_INPUT_CONSTANTS.TOUCH_TARGET,
    height: CHAT_INPUT_CONSTANTS.TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  button: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconAbsolute: {
    position: 'absolute',
  },
  iconContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default MorphingButton;
