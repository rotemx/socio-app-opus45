import React, { useState } from 'react';
import { View, Text, Switch, ScrollView, TouchableOpacity } from 'react-native';

/**
 * Settings screen - App preferences and configuration
 */
export function SettingsScreen(): React.JSX.Element {
  const [notifications, setNotifications] = useState(true);
  const [locationSharing, setLocationSharing] = useState(true);
  const [discoverable, setDiscoverable] = useState(true);

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Notifications section */}
      <View className="bg-white mt-4">
        <Text className="px-4 py-3 text-sm font-semibold text-gray-500 uppercase">
          Notifications
        </Text>

        <View className="flex-row items-center justify-between px-4 py-4 border-t border-gray-100">
          <View className="flex-1">
            <Text className="text-gray-900 text-base">Push Notifications</Text>
            <Text className="text-gray-500 text-sm mt-1">
              Receive notifications for new messages
            </Text>
          </View>
          <Switch
            value={notifications}
            onValueChange={setNotifications}
            trackColor={{ false: '#e5e7eb', true: '#d946ef' }}
            accessibilityLabel="Toggle push notifications"
          />
        </View>
      </View>

      {/* Privacy section */}
      <View className="bg-white mt-4">
        <Text className="px-4 py-3 text-sm font-semibold text-gray-500 uppercase">
          Privacy
        </Text>

        <View className="flex-row items-center justify-between px-4 py-4 border-t border-gray-100">
          <View className="flex-1">
            <Text className="text-gray-900 text-base">Location Sharing</Text>
            <Text className="text-gray-500 text-sm mt-1">
              Share your location to discover nearby rooms
            </Text>
          </View>
          <Switch
            value={locationSharing}
            onValueChange={setLocationSharing}
            trackColor={{ false: '#e5e7eb', true: '#d946ef' }}
            accessibilityLabel="Toggle location sharing"
          />
        </View>

        <View className="flex-row items-center justify-between px-4 py-4 border-t border-gray-100">
          <View className="flex-1">
            <Text className="text-gray-900 text-base">Discoverable</Text>
            <Text className="text-gray-500 text-sm mt-1">
              Allow others to find you nearby
            </Text>
          </View>
          <Switch
            value={discoverable}
            onValueChange={setDiscoverable}
            trackColor={{ false: '#e5e7eb', true: '#d946ef' }}
            accessibilityLabel="Toggle discoverability"
          />
        </View>
      </View>

      {/* About section */}
      <View className="bg-white mt-4">
        <Text className="px-4 py-3 text-sm font-semibold text-gray-500 uppercase">
          About
        </Text>

        <TouchableOpacity
          className="flex-row items-center px-4 py-4 border-t border-gray-100"
          onPress={() => {
            // TODO: Navigate to Terms of Service screen
          }}
          accessibilityLabel="View terms of service"
          accessibilityRole="button"
        >
          <Text className="flex-1 text-gray-900 text-base">
            Terms of Service
          </Text>
          <Text className="text-gray-400">&#8250;</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="flex-row items-center px-4 py-4 border-t border-gray-100"
          onPress={() => {
            // TODO: Navigate to Privacy Policy screen
          }}
          accessibilityLabel="View privacy policy"
          accessibilityRole="button"
        >
          <Text className="flex-1 text-gray-900 text-base">Privacy Policy</Text>
          <Text className="text-gray-400">&#8250;</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="flex-row items-center px-4 py-4 border-t border-gray-100"
          onPress={() => {
            // TODO: Navigate to Open Source Licenses screen
          }}
          accessibilityLabel="View open source licenses"
          accessibilityRole="button"
        >
          <Text className="flex-1 text-gray-900 text-base">
            Open Source Licenses
          </Text>
          <Text className="text-gray-400">&#8250;</Text>
        </TouchableOpacity>
      </View>

      {/* Danger zone */}
      <View className="bg-white mt-4 mb-8">
        <Text className="px-4 py-3 text-sm font-semibold text-gray-500 uppercase">
          Account
        </Text>

        <TouchableOpacity
          className="px-4 py-4 border-t border-gray-100"
          onPress={() => {
            // TODO: Implement delete account with confirmation dialog
            // Will be implemented in SOCIO-206 (Auth system)
          }}
          accessibilityLabel="Delete account"
          accessibilityRole="button"
        >
          <Text className="text-error text-base">Delete Account</Text>
          <Text className="text-gray-500 text-sm mt-1">
            Permanently delete your account and all data
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

export default SettingsScreen;
