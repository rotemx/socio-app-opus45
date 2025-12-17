import { useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { colors, spacing, radius } from '@socio/ui';

export interface SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onClear: () => void;
  onCancel: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}

/**
 * Search input with clear and cancel buttons
 */
export function SearchInput({
  value,
  onChangeText,
  onClear,
  onCancel,
  placeholder = 'Search...',
  autoFocus = true,
}: SearchInputProps): React.JSX.Element {
  const inputRef = useRef<TextInput>(null);

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [autoFocus]);

  const handleChangeText = useCallback(
    (text: string) => {
      // Immediately update the displayed value
      onChangeText(text);
    },
    [onChangeText]
  );

  const handleClear = useCallback(() => {
    inputRef.current?.clear();
    onClear();
  }, [onClear]);

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        {/* Search Icon */}
        <View style={styles.searchIcon}>
          <SearchIcon />
        </View>

        <TextInput
          ref={inputRef}
          style={styles.input}
          value={value}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.onSurfaceVariant.light}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="never"
          accessibilityLabel="Search input"
          accessibilityHint="Enter search query"
        />

        {/* Clear Button */}
        {value.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClear}
            accessibilityLabel="Clear search"
            accessibilityRole="button"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ClearIcon />
          </TouchableOpacity>
        )}
      </View>

      {/* Cancel Button */}
      <TouchableOpacity
        style={styles.cancelButton}
        onPress={onCancel}
        accessibilityLabel="Cancel search"
        accessibilityRole="button"
      >
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

// Simple icon components using View elements
function SearchIcon(): React.JSX.Element {
  return (
    <View style={iconStyles.searchIcon}>
      <View style={iconStyles.searchCircle} />
      <View style={iconStyles.searchHandle} />
    </View>
  );
}

function ClearIcon(): React.JSX.Element {
  return (
    <View style={iconStyles.clearIcon}>
      <View style={[iconStyles.clearLine, iconStyles.clearLine1]} />
      <View style={[iconStyles.clearLine, iconStyles.clearLine2]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface.light,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant.light,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerHigh.light,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    height: 40,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.onSurface.light,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm : 0,
  },
  clearButton: {
    padding: spacing.xs,
  },
  cancelButton: {
    marginLeft: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  cancelText: {
    color: colors.primary.light,
    fontSize: 16,
    fontWeight: '500',
  },
});

const iconStyles = StyleSheet.create({
  searchIcon: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.onSurfaceVariant.light,
  },
  searchHandle: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 6,
    height: 2,
    backgroundColor: colors.onSurfaceVariant.light,
    transform: [{ rotate: '45deg' }],
  },
  clearIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.onSurfaceVariant.light,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearLine: {
    position: 'absolute',
    width: 10,
    height: 2,
    backgroundColor: colors.surfaceContainerHigh.light,
  },
  clearLine1: {
    transform: [{ rotate: '45deg' }],
  },
  clearLine2: {
    transform: [{ rotate: '-45deg' }],
  },
});

export default SearchInput;
