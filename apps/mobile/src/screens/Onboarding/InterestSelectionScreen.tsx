import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing } from '@socio/ui';
import type { RootStackScreenProps } from '../../navigation/types';
// import { onboardingStorage } from '../../services'; // TODO: Implement onboardingStorage
import { InterestChip } from './InterestChip';
import {
  INTEREST_CATEGORIES,
  MIN_INTERESTS_REQUIRED,
  type Interest,
} from './interests';

type NavigationProp = RootStackScreenProps<'InterestSelection'>['navigation'];

/**
 * Interest selection screen for personalizing room recommendations
 * Part of the onboarding flow after profile setup
 */
export function InterestSelectionScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  const [selectedInterests, setSelectedInterests] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedCount = selectedInterests.size;
  const canContinue = selectedCount >= MIN_INTERESTS_REQUIRED;

  const handleToggleInterest = useCallback((interest: Interest) => {
    setSelectedInterests(prev => {
      const newSet = new Set(prev);
      if (newSet.has(interest.id)) {
        newSet.delete(interest.id);
      } else {
        newSet.add(interest.id);
      }
      return newSet;
    });
  }, []);

  const handleContinue = useCallback(async () => {
    if (!canContinue) {
      return;
    }

    try {
      setIsSubmitting(true);

      // In production, this would call the API:
      // await userService.updateInterests(Array.from(selectedInterests));

      // Simulate API call
      await new Promise<void>(resolve => setTimeout(resolve, 500));

      // Mark onboarding profile setup as complete
      // TODO: Implement onboardingStorage.setCompleted
      // await onboardingStorage.setCompleted(true);
      navigation.navigate('LocationPermission');
    } catch (error) {
      console.error('[InterestSelectionScreen] Error saving interests:', error);
      Alert.alert('Error', 'Failed to save your interests. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [canContinue, navigation]);

  const handleSkip = useCallback(() => {
    Alert.alert(
      'Skip Interest Selection?',
      'You can set your interests later in Settings. Without them, room recommendations may be less personalized.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip',
          onPress: async () => {
            try {
              // Mark onboarding profile setup as complete even when skipping
              // TODO: Implement onboardingStorage.setCompleted
              // await onboardingStorage.setCompleted(true);
              navigation.navigate('LocationPermission');
            } catch (error) {
              console.error('[InterestSelectionScreen] Error skipping:', error);
              Alert.alert('Error', 'Something went wrong. Please try again.');
            }
          },
        },
      ],
    );
  }, [navigation]);

  const selectionStatus = useMemo(() => {
    if (selectedCount === 0) {
      return `Select at least ${MIN_INTERESTS_REQUIRED} interests`;
    }
    if (selectedCount < MIN_INTERESTS_REQUIRED) {
      const remaining = MIN_INTERESTS_REQUIRED - selectedCount;
      return `Select ${remaining} more interest${remaining > 1 ? 's' : ''}`;
    }
    return `${selectedCount} interest${selectedCount > 1 ? 's' : ''} selected`;
  }, [selectedCount]);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>What interests you?</Text>
          <Text style={styles.subtitle}>
            Choose topics you care about to help us recommend the best rooms for you
          </Text>
        </View>

        {/* Selection Status */}
        <View style={styles.statusContainer}>
          <Text
            style={[
              styles.statusText,
              canContinue && styles.statusTextValid,
            ]}
          >
            {selectionStatus}
          </Text>
        </View>

        {/* Interest Categories */}
        {INTEREST_CATEGORIES.map(category => (
          <View key={category.id} style={styles.categoryContainer}>
            <Text style={styles.categoryName}>{category.name}</Text>
            <View style={styles.chipsContainer}>
              {category.interests.map(interest => (
                <InterestChip
                  key={interest.id}
                  interest={interest}
                  isSelected={selectedInterests.has(interest.id)}
                  onPress={handleToggleInterest}
                  disabled={isSubmitting}
                />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Bottom Buttons */}
      <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            !canContinue && styles.buttonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!canContinue || isSubmitting}
          accessibilityLabel="Continue"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canContinue || isSubmitting }}
        >
          <Text style={styles.continueButtonText}>
            {isSubmitting ? 'Saving...' : 'Continue'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
          disabled={isSubmitting}
          accessibilityLabel="Skip interest selection"
          accessibilityRole="button"
          accessibilityState={{ disabled: isSubmitting }}
        >
          <Text style={styles.skipButtonText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.light,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.onSurface.light,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.onSurfaceVariant.light,
    textAlign: 'center',
    lineHeight: 22,
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceContainerLow.light,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.onSurfaceVariant.light,
  },
  statusTextValid: {
    color: colors.primary.light,
  },
  categoryContainer: {
    marginBottom: spacing.lg,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onSurface.light,
    marginBottom: spacing.sm,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  bottomContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant.light,
    backgroundColor: colors.surface.light,
  },
  continueButton: {
    backgroundColor: colors.primary.light,
    paddingVertical: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  buttonDisabled: {
    backgroundColor: colors.outline.light,
  },
  continueButtonText: {
    color: colors.onPrimary.light,
    fontSize: 18,
    fontWeight: '600',
  },
  skipButton: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  skipButtonText: {
    color: colors.primary.light,
    fontSize: 16,
    fontWeight: '500',
  },
});
