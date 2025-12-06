import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { colors, spacing, radius } from '@socio/ui';
import { useLocation } from '../../hooks';
import type { RootStackParamList } from '../../navigation/types';

/**
 * LocationPermissionScreen - Pre-permission primer screen
 *
 * Shows explanation UI before requesting location permission.
 * Handles all permission states: granted, denied, blocked, unavailable.
 * Provides deep link to device settings for denied/blocked state.
 */
export function LocationPermissionScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const {
    permissionStatus,
    isLoading,
    error,
    requestPermission,
    openLocationSettings,
  } = useLocation();

  const [isRequesting, setIsRequesting] = useState(false);

  // If permission is already granted, navigate away immediately
  useEffect(() => {
    if (permissionStatus === 'granted' || permissionStatus === 'limited') {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    }
  }, [permissionStatus, navigation]);

  /**
   * Handle permission request
   */
  const handleAllowLocation = useCallback(async () => {
    setIsRequesting(true);

    try {
      await requestPermission();
      // Navigation is handled by useEffect when permissionStatus changes
    } catch (err) {
      // Error is already handled by useLocation hook
      console.error('Failed to request location permission:', err);
    } finally {
      setIsRequesting(false);
    }
  }, [requestPermission]);

  /**
   * Handle open settings for blocked/denied permissions
   */
  const handleOpenSettings = useCallback(async () => {
    try {
      await openLocationSettings();
    } catch (err) {
      console.error('Failed to open location settings:', err);
    }
  }, [openLocationSettings]);

  /**
   * Handle skip - user can still use app with limited functionality
   */
  const handleSkip = useCallback(() => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  }, [navigation]);

  /**
   * Render content based on permission state
   */
  const renderContent = () => {
    // Show blocked/denied state with settings option
    if (permissionStatus === 'blocked' || permissionStatus === 'denied') {
      return (
        <>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>📍</Text>
          </View>

          <Text style={styles.title}>Location Access Needed</Text>

          <Text style={styles.description}>
            You have previously denied location access. To discover nearby chat rooms and connect with your community, please enable location in your device settings.
          </Text>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleOpenSettings}
            accessibilityRole="button"
            accessibilityLabel="Open settings to enable location"
          >
            <Text style={styles.primaryButtonText}>Open Settings</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleSkip}
            accessibilityRole="button"
            accessibilityLabel="Skip and continue without location"
          >
            <Text style={styles.secondaryButtonText}>Skip for Now</Text>
          </TouchableOpacity>

          <Text style={styles.fallbackText}>
            Without location, you can still browse rooms manually by city or neighborhood.
          </Text>
        </>
      );
    }

    // Show unavailable state
    if (permissionStatus === 'unavailable') {
      return (
        <>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>🚫</Text>
          </View>

          <Text style={styles.title}>Location Unavailable</Text>

          <Text style={styles.description}>
            Location services are not available on this device. You can still use the app by manually selecting your city or neighborhood.
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleSkip}
            accessibilityRole="button"
            accessibilityLabel="Continue to app"
          >
            <Text style={styles.primaryButtonText}>Continue</Text>
          </TouchableOpacity>
        </>
      );
    }

    // Default: Show primer screen for initial request
    return (
      <>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>📍</Text>
        </View>

        <Text style={styles.title}>Discover Nearby Communities</Text>

        <Text style={styles.description}>
          Socio uses your location to show you chat rooms in your area. Connect with people in your neighborhood and join local conversations.
        </Text>

        <View style={styles.featureList}>
          <FeatureItem
            icon="🗺️"
            text="Find rooms near you on the map"
          />
          <FeatureItem
            icon="🔔"
            text="Get notified when new rooms open nearby"
          />
          <FeatureItem
            icon="👥"
            text="Connect with your local community"
          />
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, isRequesting && styles.buttonDisabled]}
          onPress={handleAllowLocation}
          disabled={isRequesting || isLoading}
          accessibilityRole="button"
          accessibilityLabel="Allow location access"
        >
          {isRequesting || isLoading ? (
            <ActivityIndicator color={colors.onPrimary.light} />
          ) : (
            <Text style={styles.primaryButtonText}>Allow Location Access</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleSkip}
          accessibilityRole="button"
          accessibilityLabel="Skip and select location manually"
        >
          <Text style={styles.secondaryButtonText}>Select Manually Instead</Text>
        </TouchableOpacity>

        <Text style={styles.privacyText}>
          Your location is only used to show nearby rooms and is never shared with other users.
        </Text>
      </>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {renderContent()}
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
  privacyText: {
    fontSize: 13,
    color: colors.onSurfaceVariant.light,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  fallbackText: {
    fontSize: 13,
    color: colors.onSurfaceVariant.light,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  errorText: {
    fontSize: 14,
    color: colors.error.light,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
});

export default LocationPermissionScreen;
