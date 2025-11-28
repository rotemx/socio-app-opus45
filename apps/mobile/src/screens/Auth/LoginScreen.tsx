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
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@socio/shared';
import type { RootStackScreenProps } from '../../navigation/types';

type Props = RootStackScreenProps<'Login'>;

/**
 * Login screen with email/password and social login options
 */
export function LoginScreen(): React.JSX.Element {
  const navigation = useNavigation<Props['navigation']>();
  const { login, isLoading, error, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleEmailLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    try {
      await login({
        email: email.trim(),
        password,
        authProvider: 'email',
      });
      navigation.navigate('Home');
    } catch {
      // Error is already set in the store
    }
  };

  const handleGoogleLogin = async () => {
    try {
      // TODO: Implement Google Sign-In SDK integration
      // For now, show placeholder alert
      Alert.alert(
        'Google Sign-In',
        'Google Sign-In requires native SDK setup. Please use email/password for now.'
      );
      // When implemented:
      // const idToken = await GoogleSignin.signIn();
      // await oauthLogin('google', idToken);
    } catch {
      // Error handled by useAuth
    }
  };

  const handleAppleLogin = async () => {
    try {
      // TODO: Implement Apple Sign-In SDK integration
      Alert.alert(
        'Apple Sign-In',
        'Apple Sign-In requires native SDK setup. Please use email/password for now.'
      );
      // When implemented:
      // const appleCredential = await appleAuth.performRequest();
      // await oauthLogin('apple', appleCredential.identityToken);
    } catch {
      // Error handled by useAuth
    }
  };

  const handlePhoneLogin = () => {
    navigation.navigate('PhoneVerification', { mode: 'login' });
  };

  React.useEffect(() => {
    // Clear error when component unmounts
    return () => clearError();
  }, [clearError]);

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
            Welcome Back
          </Text>
          <Text className="text-base text-gray-600 text-center mt-2">
            Sign in to continue to Socio
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
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-1">Email</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-white"
            placeholder="Enter your email"
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
            accessibilityLabel="Email input"
          />
        </View>

        {/* Password Input */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-1">Password</Text>
          <View className="relative">
            <TextInput
              className="border border-gray-300 rounded-lg px-4 py-3 pr-12 text-base text-gray-900 bg-white"
              placeholder="Enter your password"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
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
        </View>

        {/* Forgot Password */}
        <TouchableOpacity
          className="mb-6"
          onPress={() => navigation.navigate('ForgotPassword')}
          accessibilityLabel="Forgot password"
          accessibilityRole="link"
        >
          <Text className="text-primary-500 text-right font-medium">
            Forgot Password?
          </Text>
        </TouchableOpacity>

        {/* Login Button */}
        <TouchableOpacity
          className={`rounded-lg py-4 items-center ${
            isLoading ? 'bg-primary-300' : 'bg-primary-500'
          }`}
          onPress={handleEmailLogin}
          disabled={isLoading}
          accessibilityLabel="Sign in with email"
          accessibilityRole="button"
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-white font-semibold text-base">Sign In</Text>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View className="flex-row items-center my-6">
          <View className="flex-1 h-px bg-gray-200" />
          <Text className="mx-4 text-gray-500">or continue with</Text>
          <View className="flex-1 h-px bg-gray-200" />
        </View>

        {/* Social Login Buttons */}
        <View className="flex-row gap-3 mb-6">
          <TouchableOpacity
            className="flex-1 border border-gray-300 rounded-lg py-3 items-center"
            onPress={handleGoogleLogin}
            disabled={isLoading}
            accessibilityLabel="Sign in with Google"
            accessibilityRole="button"
          >
            <Text className="text-gray-700 font-medium">Google</Text>
          </TouchableOpacity>
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              className="flex-1 border border-gray-300 rounded-lg py-3 items-center"
              onPress={handleAppleLogin}
              disabled={isLoading}
              accessibilityLabel="Sign in with Apple"
              accessibilityRole="button"
            >
              <Text className="text-gray-700 font-medium">Apple</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Phone Login */}
        <TouchableOpacity
          className="border border-gray-300 rounded-lg py-3 items-center mb-6"
          onPress={handlePhoneLogin}
          disabled={isLoading}
          accessibilityLabel="Sign in with phone"
          accessibilityRole="button"
        >
          <Text className="text-gray-700 font-medium">Sign in with Phone</Text>
        </TouchableOpacity>

        {/* Register Link */}
        <View className="flex-row justify-center">
          <Text className="text-gray-600">{"Don't have an account? "}</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Register')}
            accessibilityLabel="Create account"
            accessibilityRole="link"
          >
            <Text className="text-primary-500 font-semibold">Sign Up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default LoginScreen;
