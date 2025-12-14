import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { colors, spacing } from '@socio/ui';

interface AvatarPickerProps {
  avatarUri: string | null;
  onAvatarChange: (uri: string | null) => void;
  disabled?: boolean;
}

const AVATAR_SIZE = 120;

/**
 * Avatar picker component with camera/gallery options
 * Shows a placeholder icon when no avatar is selected
 */
export function AvatarPicker({
  avatarUri,
  onAvatarChange,
  disabled = false,
}: AvatarPickerProps): React.JSX.Element {
  const [isLoading, setIsLoading] = useState(false);

  const handlePickImage = async (_source: 'camera' | 'gallery') => {
    try {
      setIsLoading(true);

      // In a production app, you would use react-native-image-picker:
      // import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
      // const result = _source === 'camera'
      //   ? await launchCamera({ mediaType: 'photo', quality: 0.8 })
      //   : await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });

      // For now, simulate image selection with a placeholder
      // This would be replaced with actual image picker integration
      await new Promise<void>(resolve => setTimeout(resolve, 500));

      // Simulate a selected image URI
      const mockUri = `https://ui-avatars.com/api/?name=User&size=256&background=0088CC&color=fff`;
      onAvatarChange(mockUri);
    } catch (error) {
      console.error('[AvatarPicker] Error picking image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const showImageOptions = () => {
    Alert.alert(
      'Choose Avatar',
      'Select how you want to add your profile photo',
      [
        {
          text: 'Take Photo',
          onPress: () => handlePickImage('camera'),
        },
        {
          text: 'Choose from Gallery',
          onPress: () => handlePickImage('gallery'),
        },
        ...(avatarUri
          ? [
              {
                text: 'Remove Photo',
                style: 'destructive' as const,
                onPress: () => onAvatarChange(null),
              },
            ]
          : []),
        {
          text: 'Cancel',
          style: 'cancel' as const,
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.avatarContainer, disabled && styles.disabled]}
        onPress={showImageOptions}
        disabled={disabled || isLoading}
        accessibilityLabel="Select profile photo"
        accessibilityRole="button"
      >
        {avatarUri ? (
          <Image
            source={{ uri: avatarUri }}
            style={styles.avatar}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderIcon}>👤</Text>
          </View>
        )}

        {/* Edit badge */}
        <View style={styles.editBadge}>
          <Text style={styles.editIcon}>📷</Text>
        </View>
      </TouchableOpacity>

      <Text style={styles.helperText}>
        Tap to add a profile photo
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  avatarContainer: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainerHigh.light,
    borderWidth: 3,
    borderColor: colors.primary.light,
  },
  disabled: {
    opacity: 0.6,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primaryContainer.light,
  },
  placeholderIcon: {
    fontSize: 48,
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary.light,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.surface.light,
  },
  editIcon: {
    fontSize: 16,
  },
  helperText: {
    marginTop: spacing.sm,
    fontSize: 14,
    color: colors.onSurfaceVariant.light,
  },
});
