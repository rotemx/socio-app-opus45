import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { colors, spacing } from '@socio/ui';

interface UsernameInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onAvailabilityChange: (isAvailable: boolean | null) => void;
  onCheckingChange?: (isChecking: boolean) => void;
  disabled?: boolean;
}

const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;
const MIN_LENGTH = 3;
const MAX_LENGTH = 30;
const DEBOUNCE_MS = 300;

/**
 * Username input with real-time availability checking
 */
export function UsernameInput({
  value,
  onChangeText,
  onAvailabilityChange,
  onCheckingChange,
  disabled = false,
}: UsernameInputProps): React.JSX.Element {
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [checkError, setCheckError] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Notify parent when checking state changes
  useEffect(() => {
    onCheckingChange?.(isChecking);
  }, [isChecking, onCheckingChange]);

  const validateUsername = useCallback((username: string): string | null => {
    if (username.length === 0) {
      return null; // No error for empty - just not validated
    }
    if (username.length < MIN_LENGTH) {
      return `Username must be at least ${MIN_LENGTH} characters`;
    }
    if (username.length > MAX_LENGTH) {
      return `Username must be at most ${MAX_LENGTH} characters`;
    }
    if (!USERNAME_REGEX.test(username)) {
      return 'Username can only contain letters, numbers, and underscores';
    }
    return null;
  }, []);

  const checkAvailability = useCallback(async (username: string) => {
    try {
      setIsChecking(true);
      setCheckError(false);
      // Simulated API call - in production, use profileService.checkUsernameAvailability
      // const result = await profileService.checkUsernameAvailability(username);
      // For now, simulate a check
      await new Promise<void>(resolve => setTimeout(resolve, 500));
      // Note: Server should also validate reserved usernames - this is just a client-side hint
      const available = !['admin', 'root', 'system', 'socio'].includes(username.toLowerCase());
      setIsAvailable(available);
      onAvailabilityChange(available);
    } catch (error) {
      console.error('[UsernameInput] Error checking availability:', error);
      setIsAvailable(null);
      setCheckError(true);
      onAvailabilityChange(null);
    } finally {
      setIsChecking(false);
    }
  }, [onAvailabilityChange]);

  useEffect(() => {
    // Clear previous timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Validate first
    const error = validateUsername(value);
    setValidationError(error);
    setCheckError(false);

    if (error || value.length === 0) {
      setIsAvailable(null);
      onAvailabilityChange(null);
      return;
    }

    // Debounce availability check
    debounceRef.current = setTimeout(() => {
      checkAvailability(value);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, validateUsername, checkAvailability, onAvailabilityChange]);

  const getStatusIcon = () => {
    if (isChecking) {
      return <ActivityIndicator size="small" color={colors.primary.light} />;
    }
    if (validationError || value.length === 0) {
      return null;
    }
    if (isAvailable === true) {
      return <Text style={styles.availableIcon}>✓</Text>;
    }
    if (isAvailable === false) {
      return <Text style={styles.unavailableIcon}>✗</Text>;
    }
    return null;
  };

  const getHelperText = () => {
    if (validationError) {
      return validationError;
    }
    if (checkError) {
      return 'Could not verify username. Please try again.';
    }
    if (isAvailable === false) {
      return 'This username is already taken';
    }
    if (isAvailable === true) {
      return 'Username is available';
    }
    return 'Letters, numbers, and underscores only';
  };

  const helperTextStyle = useMemo(() => [
    styles.helperText,
    (validationError || checkError) && styles.errorText,
    isAvailable === false && styles.errorText,
    isAvailable === true && styles.successText,
  ], [validationError, checkError, isAvailable]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Username</Text>
      <View style={styles.inputContainer}>
        <Text style={styles.atSymbol}>@</Text>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder="johndoe"
          placeholderTextColor={colors.outline.light}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          maxLength={MAX_LENGTH}
          editable={!disabled}
        />
        <View style={styles.statusIcon}>{getStatusIcon()}</View>
      </View>
      <Text style={helperTextStyle}>{getHelperText()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.onSurface.light,
    marginBottom: spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerHigh.light,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.outline.light,
  },
  atSymbol: {
    fontSize: 16,
    color: colors.onSurfaceVariant.light,
    paddingLeft: spacing.md,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.onSurface.light,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  statusIcon: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  availableIcon: {
    fontSize: 18,
    color: colors.online,
    fontWeight: 'bold',
  },
  unavailableIcon: {
    fontSize: 18,
    color: colors.error.light,
    fontWeight: 'bold',
  },
  helperText: {
    fontSize: 12,
    color: colors.onSurfaceVariant.light,
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  },
  errorText: {
    color: colors.error.light,
  },
  successText: {
    color: colors.online,
  },
});
