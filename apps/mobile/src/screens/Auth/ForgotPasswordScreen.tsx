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
import type { RootStackScreenProps } from '../../navigation/types';

type Props = RootStackScreenProps<'ForgotPassword'>;

/**
 * Forgot password screen for password reset
 */
export function ForgotPasswordScreen(): React.JSX.Element {
  const navigation = useNavigation<Props['navigation']>();

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    if (!validateEmail(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // TODO: Implement password reset API call
      // await api.post('/auth/forgot-password', { email: email.trim() });

      // Simulate API call
      await new Promise<void>((resolve) => setTimeout(resolve, 1500));
      setIsSubmitted(true);
    } catch {
      setError('Failed to send reset email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <View className="flex-1 bg-white p-6 justify-center">
        <View className="items-center">
          <View className="w-16 h-16 bg-green-100 rounded-full items-center justify-center mb-4">
            <Text className="text-3xl">✓</Text>
          </View>
          <Text className="text-2xl font-bold text-gray-900 text-center mb-2">
            Check Your Email
          </Text>
          <Text className="text-base text-gray-600 text-center mb-6">
            We sent a password reset link to{'\n'}
            <Text className="font-medium text-gray-900">{email}</Text>
          </Text>
          <Text className="text-sm text-gray-500 text-center mb-8">
            Didn&apos;t receive the email? Check your spam folder or try again.
          </Text>

          <TouchableOpacity
            className="bg-primary-500 rounded-lg py-4 px-8 mb-4"
            onPress={() => navigation.navigate('Login')}
            accessibilityLabel="Back to login"
            accessibilityRole="button"
          >
            <Text className="text-white font-semibold text-base">Back to Sign In</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setIsSubmitted(false);
              setEmail('');
            }}
            accessibilityLabel="Try different email"
            accessibilityRole="button"
          >
            <Text className="text-primary-500 font-medium">Try a different email</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-grow p-6 justify-center"
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="mb-8">
          <Text className="text-3xl font-bold text-gray-900 text-center">
            Reset Password
          </Text>
          <Text className="text-base text-gray-600 text-center mt-2">
            Enter your email and we&apos;ll send you a link to reset your password
          </Text>
        </View>

        {/* Error Message */}
        {error && (
          <View
            className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4"
            accessibilityRole="alert"
            accessibilityLabel={`Error: ${error}`}
          >
            <Text className="text-red-600 text-center">{error}</Text>
          </View>
        )}

        {/* Email Input */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-gray-700 mb-1">Email</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-white"
            placeholder="Enter your email"
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (error) {setError(null);}
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
            accessibilityLabel="Email input"
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          className={`rounded-lg py-4 items-center ${
            isLoading ? 'bg-primary-300' : 'bg-primary-500'
          }`}
          onPress={handleSubmit}
          disabled={isLoading}
          accessibilityLabel="Send reset link"
          accessibilityRole="button"
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-white font-semibold text-base">Send Reset Link</Text>
          )}
        </TouchableOpacity>

        {/* Back to Login */}
        <TouchableOpacity
          className="mt-6"
          onPress={() => navigation.navigate('Login')}
          accessibilityLabel="Back to login"
          accessibilityRole="link"
        >
          <Text className="text-gray-600 text-center">
            Remember your password?{' '}
            <Text className="text-primary-500 font-semibold">Sign In</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default ForgotPasswordScreen;
