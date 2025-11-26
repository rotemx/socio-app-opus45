import { View, Text, Image, StyleSheet } from 'react-native';
import { colors } from '../tokens'; // Only colors token is directly used in styling

// Defined here for now, ideally should be part of tokens/sizes.ts or similar
const avatarSizes = {
  sm: 32,
  md: 48,
  lg: 64,
};

export interface AvatarProps {
  src?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  showOnlineStatus?: boolean;
  isOnline?: boolean;
}

export function Avatar({
  src,
  name,
  size = 'md',
  showOnlineStatus = false,
  isOnline = false,
}: AvatarProps) {
  const sizeValue = avatarSizes[size];
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const styles = StyleSheet.create({
    container: {
      width: sizeValue,
      height: sizeValue,
      borderRadius: sizeValue / 2,
      backgroundColor: colors.primaryContainer.light, // Default background for initials
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden', // Ensures image respects border radius
    },
    image: {
      width: '100%',
      height: '100%',
    },
    initials: {
      color: colors.onPrimaryContainer.light,
      fontSize: sizeValue * 0.4, // Adjust font size based on avatar size
      fontWeight: 'bold',
    },
    statusIndicator: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: sizeValue * 0.25, // Relative size for status indicator
      height: sizeValue * 0.25,
      borderRadius: (sizeValue * 0.25) / 2,
      borderWidth: 2,
      borderColor: colors.surface.light, // Border to stand out against background
      backgroundColor: isOnline ? colors.online : colors.offline,
    },
  });

  return (
    <View style={styles.container}>
      {src ? (
        <Image source={{ uri: src }} style={styles.image} />
      ) : (
        <Text style={styles.initials}>{initials}</Text>
      )}
      {showOnlineStatus && <View style={styles.statusIndicator} />}
    </View>
  );
}
