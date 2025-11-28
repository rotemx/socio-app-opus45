import React, { useState, useRef, useEffect } from 'react';
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
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '@socio/shared';
import type { RootStackScreenProps } from '../../navigation/types';

type Props = RootStackScreenProps<'PhoneVerification'>;

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60; // seconds

/**
 * Phone verification screen with OTP input
 */
export function PhoneVerificationScreen(): React.JSX.Element {
  const navigation = useNavigation<Props['navigation']>();
  const route = useRoute<Props['route']>();
  const { sendPhoneOtp, verifyPhoneOtp, isLoading, error, clearError } = useAuth();

  const mode = route.params?.mode ?? 'login';

  // Phone input state
  const [countryCode] = useState('+972'); // Default to Israel
  const [phoneNumber, setPhoneNumber] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');

  // OTP input state
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const otpInputRefs = useRef<(TextInput | null)[]>([]);

  // Resend cooldown
  const [resendCooldown, setResendCooldown] = useState(0);

  const fullPhoneNumber = `${countryCode}${phoneNumber.replace(/^0+/, '')}`;

  // Countdown timer for resend
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [resendCooldown]);

  useEffect(() => {
    return () => clearError();
  }, [clearError]);

  const handleSendOtp = async () => {
    if (!phoneNumber.trim() || phoneNumber.length < 9) {
      return;
    }

    try {
      await sendPhoneOtp(fullPhoneNumber);
      setStep('otp');
      setResendCooldown(RESEND_COOLDOWN);
      // Focus first OTP input
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
    } catch {
      // Error handled by useAuth
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) {return;}

    try {
      await sendPhoneOtp(fullPhoneNumber);
      setResendCooldown(RESEND_COOLDOWN);
      setOtp(Array(OTP_LENGTH).fill(''));
      otpInputRefs.current[0]?.focus();
    } catch {
      // Error handled by useAuth
    }
  };

  const handleOtpChange = (value: string, index: number) => {
    // Only allow digits
    const digit = value.replace(/[^0-9]/g, '');
    if (digit.length > 1) {return;}

    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    // Auto-advance to next input
    if (digit && index < OTP_LENGTH - 1) {
      otpInputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when complete
    if (digit && index === OTP_LENGTH - 1) {
      const otpCode = newOtp.join('');
      if (otpCode.length === OTP_LENGTH) {
        handleVerifyOtp(otpCode);
      }
    }
  };

  const handleOtpKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async (otpCode?: string) => {
    const code = otpCode ?? otp.join('');
    if (code.length !== OTP_LENGTH) {return;}

    try {
      await verifyPhoneOtp(fullPhoneNumber, code);
      navigation.navigate('Home');
    } catch {
      // Error handled by useAuth
      setOtp(Array(OTP_LENGTH).fill(''));
      otpInputRefs.current[0]?.focus();
    }
  };

  const renderPhoneStep = () => (
    <>
      <View className="mb-8">
        <Text className="text-3xl font-bold text-gray-900 text-center">
          Phone Verification
        </Text>
        <Text className="text-base text-gray-600 text-center mt-2">
          {mode === 'login'
            ? 'Sign in with your phone number'
            : 'Verify your phone number'}
        </Text>
      </View>

      {/* Country Code + Phone Input */}
      <View className="mb-4">
        <Text className="text-sm font-medium text-gray-700 mb-1">Phone Number</Text>
        <View className="flex-row gap-2">
          {/* Country Code Picker */}
          <TouchableOpacity
            className="border border-gray-300 rounded-lg px-4 py-3 min-w-[80px] items-center justify-center"
            accessibilityLabel="Select country code"
            accessibilityRole="button"
          >
            <Text className="text-base text-gray-900">{countryCode}</Text>
          </TouchableOpacity>

          {/* Phone Number Input */}
          <TextInput
            className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-white"
            placeholder="Phone number"
            placeholderTextColor="#9CA3AF"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            editable={!isLoading}
            accessibilityLabel="Phone number input"
          />
        </View>
      </View>

      <TouchableOpacity
        className={`rounded-lg py-4 items-center mt-4 ${
          isLoading || phoneNumber.length < 9 ? 'bg-primary-300' : 'bg-primary-500'
        }`}
        onPress={handleSendOtp}
        disabled={isLoading || phoneNumber.length < 9}
        accessibilityLabel="Send verification code"
        accessibilityRole="button"
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text className="text-white font-semibold text-base">Send Code</Text>
        )}
      </TouchableOpacity>
    </>
  );

  const renderOtpStep = () => (
    <>
      <View className="mb-8">
        <Text className="text-3xl font-bold text-gray-900 text-center">
          Enter Code
        </Text>
        <Text className="text-base text-gray-600 text-center mt-2">
          We sent a verification code to{'\n'}
          <Text className="font-medium text-gray-900">{fullPhoneNumber}</Text>
        </Text>
      </View>

      {/* OTP Inputs */}
      <View className="flex-row justify-center gap-2 mb-6">
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => {
              otpInputRefs.current[index] = ref;
            }}
            className={`w-12 h-14 border-2 rounded-lg text-center text-xl font-bold ${
              digit ? 'border-primary-500 bg-primary-50' : 'border-gray-300 bg-white'
            }`}
            value={digit}
            onChangeText={(value) => handleOtpChange(value, index)}
            onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, index)}
            keyboardType="number-pad"
            maxLength={1}
            editable={!isLoading}
            selectTextOnFocus
            accessibilityLabel={`Digit ${index + 1} of verification code`}
          />
        ))}
      </View>

      {/* Verify Button */}
      <TouchableOpacity
        className={`rounded-lg py-4 items-center ${
          isLoading || otp.join('').length !== OTP_LENGTH
            ? 'bg-primary-300'
            : 'bg-primary-500'
        }`}
        onPress={() => handleVerifyOtp()}
        disabled={isLoading || otp.join('').length !== OTP_LENGTH}
        accessibilityLabel="Verify code"
        accessibilityRole="button"
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text className="text-white font-semibold text-base">Verify</Text>
        )}
      </TouchableOpacity>

      {/* Resend Code */}
      <View className="flex-row justify-center mt-4">
        <Text className="text-gray-600">{"Didn't receive the code? "}</Text>
        {resendCooldown > 0 ? (
          <Text className="text-gray-400">Resend in {resendCooldown}s</Text>
        ) : (
          <TouchableOpacity
            onPress={handleResendOtp}
            disabled={isLoading}
            accessibilityLabel="Resend verification code"
            accessibilityRole="button"
          >
            <Text className="text-primary-500 font-semibold">Resend</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Change Number */}
      <TouchableOpacity
        className="mt-4"
        onPress={() => {
          setStep('phone');
          setOtp(Array(OTP_LENGTH).fill(''));
          clearError();
        }}
        accessibilityLabel="Change phone number"
        accessibilityRole="button"
      >
        <Text className="text-gray-600 text-center">Change phone number</Text>
      </TouchableOpacity>
    </>
  );

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

        {step === 'phone' ? renderPhoneStep() : renderOtpStep()}

        {/* Back to Login */}
        <TouchableOpacity
          className="mt-6"
          onPress={() => navigation.navigate('Login')}
          accessibilityLabel="Back to login"
          accessibilityRole="link"
        >
          <Text className="text-gray-600 text-center">
            Back to <Text className="text-primary-500 font-semibold">Sign In</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default PhoneVerificationScreen;
