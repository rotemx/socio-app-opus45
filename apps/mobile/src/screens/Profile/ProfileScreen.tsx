import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { RootStackScreenProps } from '../../navigation/types';

type Props = RootStackScreenProps<'Profile'>;

/**
 * Profile screen - User profile and account information
 */
export function ProfileScreen(): React.JSX.Element {
  const navigation = useNavigation<Props['navigation']>();

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Profile header */}
      <View className="bg-white px-4 py-6 items-center border-b border-gray-100">
        <View className="w-24 h-24 rounded-full bg-primary-100 items-center justify-center mb-4">
          <Text className="text-4xl text-primary-600">U</Text>
        </View>
        <Text className="text-xl font-bold text-gray-900">Guest User</Text>
        <Text className="text-gray-500 mt-1">@guest_user</Text>

        <TouchableOpacity
          className="mt-4 bg-primary-500 px-6 py-2 rounded-full"
          onPress={() => {
            // TODO: Navigate to edit profile screen
          }}
          accessibilityLabel="Edit profile"
          accessibilityRole="button"
        >
          <Text className="text-white font-semibold">Edit Profile</Text>
        </TouchableOpacity>
      </View>

      {/* Stats section */}
      <View className="bg-white mt-4 p-4">
        <View className="flex-row justify-around">
          <View className="items-center">
            <Text className="text-2xl font-bold text-gray-900">0</Text>
            <Text className="text-gray-500 text-sm">Rooms Joined</Text>
          </View>
          <View className="items-center">
            <Text className="text-2xl font-bold text-gray-900">0</Text>
            <Text className="text-gray-500 text-sm">Messages</Text>
          </View>
          <View className="items-center">
            <Text className="text-2xl font-bold text-gray-900">0</Text>
            <Text className="text-gray-500 text-sm">Connections</Text>
          </View>
        </View>
      </View>

      {/* Menu items */}
      <View className="bg-white mt-4">
        <TouchableOpacity
          className="flex-row items-center px-4 py-4 border-b border-gray-100"
          onPress={() => navigation.navigate('Settings')}
          accessibilityLabel="Go to settings"
          accessibilityRole="button"
        >
          <Text className="flex-1 text-gray-900 text-base">Settings</Text>
          <Text className="text-gray-400">&#8250;</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="flex-row items-center px-4 py-4 border-b border-gray-100"
          onPress={() => {
            // TODO: Navigate to privacy settings
          }}
          accessibilityLabel="Privacy settings"
          accessibilityRole="button"
        >
          <Text className="flex-1 text-gray-900 text-base">Privacy</Text>
          <Text className="text-gray-400">&#8250;</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="flex-row items-center px-4 py-4 border-b border-gray-100"
          onPress={() => {
            // TODO: Navigate to help & support
          }}
          accessibilityLabel="Help and support"
          accessibilityRole="button"
        >
          <Text className="flex-1 text-gray-900 text-base">Help & Support</Text>
          <Text className="text-gray-400">&#8250;</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="flex-row items-center px-4 py-4"
          onPress={() => {
            // TODO: Implement sign out (SOCIO-206)
          }}
          accessibilityLabel="Sign out"
          accessibilityRole="button"
        >
          <Text className="flex-1 text-error text-base">Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Version info */}
      <View className="items-center py-6">
        <Text className="text-gray-400 text-sm">Socio v1.0.0</Text>
      </View>
    </ScrollView>
  );
}

export default ProfileScreen;
