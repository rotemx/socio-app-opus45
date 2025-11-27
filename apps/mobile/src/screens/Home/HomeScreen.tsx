import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { RootStackScreenProps } from '../../navigation/types';

type Props = RootStackScreenProps<'Home'>;

/**
 * Home screen - Main entry point showing recent rooms and quick actions
 */
export function HomeScreen(): React.JSX.Element {
  const navigation = useNavigation<Props['navigation']>();

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="p-4">
        {/* Welcome section */}
        <View className="mb-6">
          <Text className="text-2xl font-bold text-gray-900">
            Welcome to Socio
          </Text>
          <Text className="text-base text-gray-600 mt-1">
            Discover nearby communities and connect
          </Text>
        </View>

        {/* Quick actions */}
        <View className="flex-row gap-3 mb-6">
          <TouchableOpacity
            className="flex-1 bg-primary-500 rounded-xl p-4 items-center"
            onPress={() => navigation.navigate('Discover')}
            accessibilityLabel="Discover nearby rooms"
            accessibilityRole="button"
          >
            <Text className="text-white font-semibold text-base">
              Discover Rooms
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-1 bg-secondary-500 rounded-xl p-4 items-center"
            onPress={() => navigation.navigate('Profile')}
            accessibilityLabel="View your profile"
            accessibilityRole="button"
          >
            <Text className="text-white font-semibold text-base">Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Recent rooms placeholder */}
        <View className="mb-4">
          <Text className="text-lg font-semibold text-gray-900 mb-3">
            Recent Rooms
          </Text>
          <View className="bg-gray-50 rounded-xl p-6 items-center">
            <Text className="text-gray-500 text-center">
              No recent rooms yet.{'\n'}Discover rooms nearby to get started!
            </Text>
          </View>
        </View>

        {/* Nearby activity placeholder */}
        <View>
          <Text className="text-lg font-semibold text-gray-900 mb-3">
            Nearby Activity
          </Text>
          <View className="bg-gray-50 rounded-xl p-6 items-center">
            <Text className="text-gray-500 text-center">
              Enable location to see activity near you
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

export default HomeScreen;
