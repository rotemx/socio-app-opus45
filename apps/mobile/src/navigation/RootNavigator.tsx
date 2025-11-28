import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '@socio/shared';
import type { RootStackParamList } from './types';

// Main Screens
import HomeScreen from '../screens/Home/HomeScreen';
import DiscoverScreen from '../screens/Discover/DiscoverScreen';
import ChatRoomScreen from '../screens/ChatRoom/ChatRoomScreen';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import SettingsScreen from '../screens/Settings/SettingsScreen';

// Auth Screens
import {
  LoginScreen,
  RegisterScreen,
  ForgotPasswordScreen,
  PhoneVerificationScreen,
} from '../screens/Auth';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Root navigation stack
 * Handles all main app navigation including authentication flow
 */
export function RootNavigator(): React.JSX.Element {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading screen while checking auth state
  if (isLoading) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator
      initialRouteName={isAuthenticated ? 'Home' : 'Login'}
      screenOptions={{
        headerShown: true,
        headerTintColor: '#d946ef', // primary-500
        headerStyle: {
          backgroundColor: '#ffffff',
        },
        headerTitleStyle: {
          fontWeight: '600',
        },
        animation: 'slide_from_right',
      }}
    >
      {isAuthenticated ? (
        // Authenticated screens
        <>
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{
              title: 'Socio',
              headerLargeTitle: true,
            }}
          />
          <Stack.Screen
            name="Discover"
            component={DiscoverScreen}
            options={{
              title: 'Discover Rooms',
            }}
          />
          <Stack.Screen
            name="ChatRoom"
            component={ChatRoomScreen}
            options={({ route }) => ({
              title: route.params?.roomName ?? 'Chat Room',
            })}
          />
          <Stack.Screen
            name="Profile"
            component={ProfileScreen}
            options={{
              title: 'Profile',
            }}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{
              title: 'Settings',
            }}
          />
        </>
      ) : (
        // Auth screens
        <>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="Register"
            component={RegisterScreen}
            options={{
              title: 'Create Account',
              headerBackTitle: 'Back',
            }}
          />
          <Stack.Screen
            name="ForgotPassword"
            component={ForgotPasswordScreen}
            options={{
              title: 'Reset Password',
              headerBackTitle: 'Back',
            }}
          />
          <Stack.Screen
            name="PhoneVerification"
            component={PhoneVerificationScreen}
            options={{
              title: 'Phone Verification',
              headerBackTitle: 'Back',
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

export default RootNavigator;
