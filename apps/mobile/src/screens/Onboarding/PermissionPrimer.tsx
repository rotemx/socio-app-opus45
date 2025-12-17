import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { colors, spacing, radius } from '@socio/ui';

/** Feature item for the primer screen */
export interface PermissionFeature {
  icon: string;
  text: string;
}

/** Permission primer screen variant */
export type PermissionPrimerVariant = 'initial' | 'denied' | 'blocked' | 'unavailable';

export interface PermissionPrimerProps {
  /** Main icon for the permission */
  icon: string;
  /** Title text */
  title: string;
  /** Description text */
  description: string;
  /** List of features/benefits */
  features?: PermissionFeature[];
  /** Primary button text */
  primaryButtonText: string;
  /** Primary button handler */
  onPrimaryPress: () => void;
  /** Secondary/skip button text */
  secondaryButtonText?: string;
  /** Secondary button handler */
  onSecondaryPress?: () => void;
  /** Privacy/footer text */
  footerText?: string;
  /** Error message to display */
  error?: string | null;
  /** Whether primary button should show loading */
  isLoading?: boolean;
  /** Whether buttons should be disabled */
  disabled?: boolean;
  /** Current screen variant */
  variant?: PermissionPrimerVariant;
}

/**
 * PermissionPrimer - Reusable permission explanation screen
 *
 * Shows a primer screen before requesting native permission dialogs.
 * Explains why the permission is needed and handles all permission states.
 */
export function PermissionPrimer({
  icon,
  title,
  description,
  features,
  primaryButtonText,
  onPrimaryPress,
  secondaryButtonText,
  onSecondaryPress,
  footerText,
  error,
  isLoading = false,
  disabled = false,
  variant = 'initial',
}: PermissionPrimerProps): React.JSX.Element {
  // Determine icon based on variant
  const displayIcon = variant === 'unavailable' ? '🚫' : icon;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          <Text
            style={styles.icon}
            accessibilityLabel={`${title} icon`}
          >
            {displayIcon}
          </Text>
        </View>

        {/* Title */}
        <Text
          style={styles.title}
          accessibilityRole="header"
        >
          {title}
        </Text>

        {/* Description */}
        <Text style={styles.description}>
          {description}
        </Text>

        {/* Error */}
        {error && (
          <Text
            style={styles.errorText}
            accessibilityRole="alert"
          >
            {error}
          </Text>
        )}

        {/* Features list */}
        {features && features.length > 0 && (
          <View style={styles.featureList}>
            {features.map((feature, index) => (
              <FeatureItem
                key={index}
                icon={feature.icon}
                text={feature.text}
              />
            ))}
          </View>
        )}

        {/* Primary button */}
        <TouchableOpacity
          style={[
            styles.primaryButton,
            (isLoading || disabled) && styles.buttonDisabled,
          ]}
          onPress={onPrimaryPress}
          disabled={isLoading || disabled}
          accessibilityRole="button"
          accessibilityLabel={primaryButtonText}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.onPrimary.light} />
          ) : (
            <Text style={styles.primaryButtonText}>{primaryButtonText}</Text>
          )}
        </TouchableOpacity>

        {/* Secondary button */}
        {secondaryButtonText && onSecondaryPress && (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onSecondaryPress}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={secondaryButtonText}
          >
            <Text style={styles.secondaryButtonText}>{secondaryButtonText}</Text>
          </TouchableOpacity>
        )}

        {/* Footer text */}
        {footerText && (
          <Text style={styles.footerText}>
            {footerText}
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

/**
 * Feature item component for the primer screen
 */
interface FeatureItemProps {
  icon: string;
  text: string;
}

function FeatureItem({ icon, text }: FeatureItemProps): React.JSX.Element {
  return (
    <View
      style={styles.featureItem}
      accessibilityRole="text"
      accessibilityLabel={text}
    >
      <Text style={styles.featureIcon} accessible={false}>{icon}</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.light,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primaryContainer.light,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  icon: {
    fontSize: 56,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.onSurface.light,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.onSurfaceVariant.light,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  errorText: {
    fontSize: 14,
    color: colors.error.light,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  featureList: {
    width: '100%',
    marginBottom: spacing.xl,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  featureIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  featureText: {
    fontSize: 15,
    color: colors.onSurface.light,
    flex: 1,
  },
  primaryButton: {
    width: '100%',
    backgroundColor: colors.primary.light,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
    minHeight: 52,
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onPrimary.light,
  },
  secondaryButton: {
    width: '100%',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.primary.light,
  },
  footerText: {
    fontSize: 13,
    color: colors.onSurfaceVariant.light,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default PermissionPrimer;
