import React, { useCallback, useRef, useEffect } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  View,
} from 'react-native';
import { colors, spacing } from '@socio/ui';
import type { Interest } from './interests';

export interface InterestChipProps {
  interest: Interest;
  isSelected: boolean;
  onPress: (interest: Interest) => void;
  disabled?: boolean;
}

/**
 * Selectable chip component for interest selection
 * Provides animated visual feedback on selection state change
 */
export function InterestChip({
  interest,
  isSelected,
  onPress,
  disabled = false,
}: InterestChipProps): React.JSX.Element {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const backgroundAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;

  useEffect(() => {
    // Animate background color on selection change
    Animated.timing(backgroundAnim, {
      toValue: isSelected ? 1 : 0,
      duration: 200,
      useNativeDriver: false, // backgroundColor cannot use native driver
    }).start();
  }, [isSelected, backgroundAnim]);

  const handlePress = useCallback(() => {
    if (disabled) {
      return;
    }

    // Scale animation for haptic feedback
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    onPress(interest);
    // scaleAnim is a ref and stable, included to satisfy exhaustive-deps
  }, [disabled, interest, onPress, scaleAnim]);

  const backgroundColor = backgroundAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.surfaceContainerHigh.light, colors.primaryContainer.light],
  });

  const borderColor = backgroundAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.outline.light, colors.primary.light],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ scale: scaleAnim }],
          backgroundColor,
          borderColor,
        },
        disabled && styles.disabled,
      ]}
    >
      <TouchableOpacity
        onPress={handlePress}
        disabled={disabled}
        activeOpacity={0.8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isSelected, disabled }}
        accessibilityLabel={`${interest.label} interest`}
        accessibilityHint={isSelected ? 'Double tap to deselect' : 'Double tap to select'}
      >
        <View style={styles.content}>
          <Text style={styles.icon}>{interest.icon}</Text>
          <Text
            style={[
              styles.label,
              isSelected && styles.labelSelected,
            ]}
          >
            {interest.label}
          </Text>
          {isSelected && (
            <View style={styles.checkmark}>
              <Text style={styles.checkmarkText}>✓</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    borderWidth: 1.5,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  icon: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.onSurface.light,
  },
  labelSelected: {
    color: colors.primary.light,
    fontWeight: '600',
  },
  checkmark: {
    marginLeft: spacing.xs,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    color: colors.onPrimary.light,
    fontSize: 10,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.5,
  },
});
