import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';

// Screens
import HomeScreen from '../screens/Home/HomeScreen';
import DiscoverScreen from '../screens/Discover/DiscoverScreen';
import ChatRoomScreen from '../screens/ChatRoom/ChatRoomScreen';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import SettingsScreen from '../screens/Settings/SettingsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Root navigation stack
 * Handles all main app navigation
 */
export function RootNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator
      initialRouteName="Home"
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
      {/* Main screens */}
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
    </Stack.Navigator>
  );
}

export default RootNavigator;
