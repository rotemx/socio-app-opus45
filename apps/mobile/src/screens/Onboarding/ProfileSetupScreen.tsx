import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing } from '@socio/ui';
import type { RootStackScreenProps } from '../../navigation/types';
import { onboardingStorage } from '../../services';
import { UsernameInput } from './UsernameInput';
import { AvatarPicker } from './AvatarPicker';

type NavigationProp = RootStackScreenProps<'ProfileSetup'>['navigation'];

const BIO_MAX_LENGTH = 160;

/**
 * Profile setup screen for new users to complete their profile
 */
export function ProfileSetupScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  const [isUsernameAvailable, setIsUsernameAvailable] = useState<boolean | null>(null);
  const [isUsernameChecking, setIsUsernameChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isFormValid = username.length >= 3 && isUsernameAvailable === true && !isUsernameChecking;

  const handleUsernameAvailabilityChange = useCallback((available: boolean | null) => {
    setIsUsernameAvailable(available);
  }, []);

  const handleUsernameCheckingChange = useCallback((checking: boolean) => {
    setIsUsernameChecking(checking);
  }, []);

  const handleSubmit = async () => {
    if (!isFormValid) {
      return;
    }

    try {
      setIsSubmitting(true);

      // In production, this would call the API:
      // await profileService.updateProfile({
      //   username,
      //   displayName: displayName || undefined,
      //   bio: bio || undefined,
      //   avatarUrl: avatarUri || undefined,
      // });

      // Simulate API call
      await new Promise<void>(resolve => setTimeout(resolve, 1000));

      // Mark onboarding as complete and navigate to login
      await onboardingStorage.setCompleted(true);
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.error('[ProfileSetupScreen] Error saving profile:', error);
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    Alert.alert(
      'Skip Profile Setup?',
      'You can always complete your profile later in Settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip',
          onPress: async () => {
            try {
              // Mark onboarding as complete even when skipping
              await onboardingStorage.setCompleted(true);
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            } catch (error) {
              console.error('[ProfileSetupScreen] Error skipping profile setup:', error);
              Alert.alert('Error', 'Something went wrong. Please try again.');
            }
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + spacing.lg },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Complete Your Profile</Text>
          <Text style={styles.subtitle}>
            Let others know who you are
          </Text>
        </View>

        {/* Avatar Picker */}
        <AvatarPicker
          avatarUri={avatarUri}
          onAvatarChange={setAvatarUri}
          disabled={isSubmitting}
        />

        {/* Form Fields */}
        <View style={styles.form}>
          {/* Username */}
          <UsernameInput
            value={username}
            onChangeText={setUsername}
            onAvailabilityChange={handleUsernameAvailabilityChange}
            onCheckingChange={handleUsernameCheckingChange}
            disabled={isSubmitting}
          />

          {/* Display Name */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>
              Display Name <Text style={styles.optional}>(optional)</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="How should we call you?"
              placeholderTextColor={colors.outline.light}
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={50}
              editable={!isSubmitting}
            />
          </View>

          {/* Bio */}
          <View style={styles.fieldContainer}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>
                Bio <Text style={styles.optional}>(optional)</Text>
              </Text>
              <Text style={styles.charCount}>
                {bio.length}/{BIO_MAX_LENGTH}
              </Text>
            </View>
            <TextInput
              style={[styles.input, styles.bioInput]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell us a bit about yourself..."
              placeholderTextColor={colors.outline.light}
              multiline
              numberOfLines={3}
              maxLength={BIO_MAX_LENGTH}
              textAlignVertical="top"
              editable={!isSubmitting}
            />
          </View>
        </View>
      </ScrollView>

      {/* Bottom Buttons */}
      <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            !isFormValid && styles.buttonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!isFormValid || isSubmitting}
          accessibilityLabel="Continue"
          accessibilityRole="button"
        >
          <Text style={styles.continueButtonText}>
            {isSubmitting ? 'Saving...' : 'Continue'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
          disabled={isSubmitting}
          accessibilityLabel="Skip profile setup"
          accessibilityRole="button"
        >
          <Text style={styles.skipButtonText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.onSurface.light,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    color: colors.onSurfaceVariant.light,
    textAlign: 'center',
  },
  form: {
    flex: 1,
  },
  fieldContainer: {
    marginBottom: spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.onSurface.light,
    marginBottom: spacing.xs,
  },
  optional: {
    fontWeight: '400',
    color: colors.onSurfaceVariant.light,
  },
  charCount: {
    fontSize: 12,
    color: colors.onSurfaceVariant.light,
  },
  input: {
    backgroundColor: colors.surfaceContainerHigh.light,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.outline.light,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.onSurface.light,
  },
  bioInput: {
    minHeight: 100,
    paddingTop: spacing.md,
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
