import React, { useCallback, useState, useEffect } from 'react';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import type { RootStackParamList } from '../../navigation/types';
import { useNotifications } from '../../hooks/useNotifications';
import { PermissionPrimer, type PermissionFeature, type PermissionPrimerVariant } from './PermissionPrimer';

/** Features to display on the primer screen */
const NOTIFICATION_FEATURES: PermissionFeature[] = [
  {
    icon: '💬',
    text: 'Get notified when you receive new messages',
  },
  {
    icon: '👋',
    text: 'Know when friends join nearby rooms',
  },
  {
    icon: '📢',
    text: 'Stay updated on community announcements',
  },
];

/**
 * NotificationPermissionScreen - Pre-permission primer screen for notifications
 *
 * Shows explanation UI before requesting notification permission.
 * Handles all permission states: granted, denied, blocked, unavailable.
 * Provides deep link to device settings for denied/blocked state.
 */
export function NotificationPermissionScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const {
    permissionStatus,
    isLoading,
    error,
    requestPermission,
    openNotificationSettings,
  } = useNotifications();

  const [isRequesting, setIsRequesting] = useState(false);

  // If permission is already granted, navigate to login
  useEffect(() => {
    if (permissionStatus === 'granted' || permissionStatus === 'limited') {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    }
  }, [permissionStatus, navigation]);

  /**
   * Handle permission request
   */
  const handleAllowNotifications = useCallback(async () => {
    setIsRequesting(true);

    try {
      await requestPermission();
      // Navigation is handled by useEffect when permissionStatus changes
    } catch (err) {
      console.error('Failed to request notification permission:', err);
    } finally {
      setIsRequesting(false);
    }
  }, [requestPermission]);

  /**
   * Handle open settings for blocked/denied permissions
   */
  const handleOpenSettings = useCallback(async () => {
    try {
      await openNotificationSettings();
    } catch (err) {
      console.error('Failed to open notification settings:', err);
    }
  }, [openNotificationSettings]);

  /**
   * Handle skip - proceed to login
   */
  const handleSkip = useCallback(() => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  }, [navigation]);

  /**
   * Get screen content based on permission state
   */
  const getScreenContent = (): {
    variant: PermissionPrimerVariant;
    title: string;
    description: string;
    primaryButtonText: string;
    onPrimaryPress: () => void;
    secondaryButtonText?: string;
    onSecondaryPress?: () => void;
    footerText?: string;
    features?: PermissionFeature[];
  } => {
    // Blocked/denied state - show settings option
    if (permissionStatus === 'blocked' || permissionStatus === 'denied') {
      return {
        variant: 'denied',
        title: 'Notifications Disabled',
        description: 'You have previously denied notification access. To receive message alerts and stay connected with your community, please enable notifications in your device settings.',
        primaryButtonText: 'Open Settings',
        onPrimaryPress: handleOpenSettings,
        secondaryButtonText: 'Skip for Now',
        onSecondaryPress: handleSkip,
        footerText: 'Without notifications, you may miss important messages when the app is closed.',
      };
    }

    // Unavailable state
    if (permissionStatus === 'unavailable') {
      return {
        variant: 'unavailable',
        title: 'Notifications Unavailable',
        description: 'Notifications are not available on this device. You can still use the app, but you won\'t receive alerts for new messages.',
        primaryButtonText: 'Continue',
        onPrimaryPress: handleSkip,
      };
    }

    // Default: Initial primer screen
    return {
      variant: 'initial',
      title: 'Stay Connected',
      description: 'Enable notifications to never miss a message from your community. We\'ll only send you relevant updates.',
      primaryButtonText: 'Enable Notifications',
      onPrimaryPress: handleAllowNotifications,
      secondaryButtonText: 'Maybe Later',
      onSecondaryPress: handleSkip,
      footerText: 'You can change this anytime in Settings.',
      features: NOTIFICATION_FEATURES,
    };
  };

  const content = getScreenContent();

  return (
    <PermissionPrimer
      icon="🔔"
      title={content.title}
      description={content.description}
      features={content.features}
      primaryButtonText={content.primaryButtonText}
      onPrimaryPress={content.onPrimaryPress}
      secondaryButtonText={content.secondaryButtonText}
      onSecondaryPress={content.onSecondaryPress}
      footerText={content.footerText}
      error={error}
      isLoading={isRequesting || isLoading}
      variant={content.variant}
    />
  );
}

export default NotificationPermissionScreen;
