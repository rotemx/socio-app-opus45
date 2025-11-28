import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@socio/shared';
import type { RootStackScreenProps } from '../../navigation/types';

type Props = RootStackScreenProps<'Register'>;

interface FormErrors {
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

/**
 * Register screen with form validation
 */
export function RegisterScreen(): React.JSX.Element {
  const navigation = useNavigation<Props['navigation']>();
  const { register, isLoading, error, clearError } = useAuth();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    // Username validation
    if (!username.trim()) {
      errors.username = 'Username is required';
    } else if (username.length < 3) {
      errors.username = 'Username must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      errors.username = 'Username can only contain letters, numbers, and underscores';
    }

    // Email validation
    if (!email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      errors.password = 'Password must contain uppercase, lowercase, and number';
    }

    // Confirm password validation
    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      await register({
        username: username.trim(),
        email: email.trim(),
        password,
        displayName: displayName.trim() || undefined,
      });
      navigation.navigate('Home');
    } catch {
      // Error is already set in the store
    }
  };

  React.useEffect(() => {
    return () => clearError();
  }, [clearError]);

  const renderInputError = (error?: string) =>
    error ? <Text className="text-red-500 text-xs mt-1">{error}</Text> : null;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-grow p-6"
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="mb-8">
          <Text className="text-3xl font-bold text-gray-900 text-center">
            Create Account
          </Text>
          <Text className="text-base text-gray-600 text-center mt-2">
            Join Socio and connect with your community
          </Text>
        </View>

        {/* API Error Message */}
        {error && (
          <View
            className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4"
            accessibilityRole="alert"
            accessibilityLabel={`Error: ${error}`}
          >
            <Text className="text-red-600 text-center">{error}</Text>
          </View>
        )}

        {/* Username Input */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-1">
            Username <Text className="text-red-500">*</Text>
          </Text>
          <TextInput
            className={`border rounded-lg px-4 py-3 text-base text-gray-900 bg-white ${
              formErrors.username ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Choose a username"
            placeholderTextColor="#9CA3AF"
            value={username}
            onChangeText={(text) => {
              setUsername(text);
              if (formErrors.username) {
                setFormErrors((prev) => ({ ...prev, username: undefined }));
              }
            }}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
            accessibilityLabel="Username input"
          />
          {renderInputError(formErrors.username)}
        </View>

        {/* Display Name Input (Optional) */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-1">
            Display Name <Text className="text-gray-400">(optional)</Text>
          </Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-white"
            placeholder="Your display name"
            placeholderTextColor="#9CA3AF"
            value={displayName}
            onChangeText={setDisplayName}
            editable={!isLoading}
            accessibilityLabel="Display name input"
          />
        </View>

        {/* Email Input */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-1">
            Email <Text className="text-red-500">*</Text>
          </Text>
          <TextInput
            className={`border rounded-lg px-4 py-3 text-base text-gray-900 bg-white ${
              formErrors.email ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Enter your email"
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (formErrors.email) {
                setFormErrors((prev) => ({ ...prev, email: undefined }));
              }
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
            accessibilityLabel="Email input"
          />
          {renderInputError(formErrors.email)}
        </View>

        {/* Password Input */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-1">
            Password <Text className="text-red-500">*</Text>
          </Text>
          <View className="relative">
            <TextInput
              className={`border rounded-lg px-4 py-3 pr-12 text-base text-gray-900 bg-white ${
                formErrors.password ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Create a password"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (formErrors.password) {
                  setFormErrors((prev) => ({ ...prev, password: undefined }));
                }
              }}
              secureTextEntry={!showPassword}
              editable={!isLoading}
              accessibilityLabel="Password input"
            />
            <TouchableOpacity
              className="absolute right-3 top-3"
              onPress={() => setShowPassword(!showPassword)}
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              accessibilityRole="button"
            >
              <Text className="text-primary-500 font-medium">
                {showPassword ? 'Hide' : 'Show'}
              </Text>
            </TouchableOpacity>
          </View>
          {renderInputError(formErrors.password)}
          <Text className="text-xs text-gray-500 mt-1">
            At least 8 characters with uppercase, lowercase, and number
          </Text>
        </View>

        {/* Confirm Password Input */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-gray-700 mb-1">
            Confirm Password <Text className="text-red-500">*</Text>
          </Text>
          <TextInput
            className={`border rounded-lg px-4 py-3 text-base text-gray-900 bg-white ${
              formErrors.confirmPassword ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Confirm your password"
            placeholderTextColor="#9CA3AF"
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              if (formErrors.confirmPassword) {
                setFormErrors((prev) => ({ ...prev, confirmPassword: undefined }));
              }
            }}
            secureTextEntry={!showPassword}
            editable={!isLoading}
            accessibilityLabel="Confirm password input"
          />
          {renderInputError(formErrors.confirmPassword)}
        </View>

        {/* Register Button */}
        <TouchableOpacity
          className={`rounded-lg py-4 items-center ${
            isLoading ? 'bg-primary-300' : 'bg-primary-500'
          }`}
          onPress={handleRegister}
          disabled={isLoading}
          accessibilityLabel="Create account"
          accessibilityRole="button"
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-white font-semibold text-base">Create Account</Text>
          )}
        </TouchableOpacity>

        {/* Terms */}
        <Text className="text-xs text-gray-500 text-center mt-4">
          By creating an account, you agree to our{' '}
          <Text className="text-primary-500">Terms of Service</Text> and{' '}
          <Text className="text-primary-500">Privacy Policy</Text>
        </Text>

        {/* Login Link */}
        <View className="flex-row justify-center mt-6">
          <Text className="text-gray-600">Already have an account? </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
            accessibilityLabel="Sign in"
            accessibilityRole="link"
          >
            <Text className="text-primary-500 font-semibold">Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default RegisterScreen;
