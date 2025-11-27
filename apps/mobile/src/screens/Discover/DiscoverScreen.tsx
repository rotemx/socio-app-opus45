import React from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { RootStackScreenProps } from '../../navigation/types';

type Props = RootStackScreenProps<'Discover'>;

// Placeholder room data
const PLACEHOLDER_ROOMS = [
  {
    id: '1',
    name: 'Tel Aviv Pride',
    description: 'A welcoming space for the Tel Aviv LGBT community',
    distance: '0.5 km',
    members: 127,
  },
  {
    id: '2',
    name: 'Rothschild Hangout',
    description: 'Chat with locals around Rothschild Boulevard',
    distance: '2.3 km',
    members: 45,
  },
  {
    id: '3',
    name: 'Beach Vibes',
    description: 'For beach lovers and surfers',
    distance: '3.1 km',
    members: 89,
  },
];

/**
 * Discover screen - Browse and discover nearby chat rooms
 */
export function DiscoverScreen(): React.JSX.Element {
  const navigation = useNavigation<Props['navigation']>();

  const renderRoom = ({
    item,
  }: {
    item: (typeof PLACEHOLDER_ROOMS)[0];
  }): React.JSX.Element => (
    <TouchableOpacity
      className="bg-white rounded-xl p-4 mb-3 border border-gray-100 shadow-sm"
      onPress={() =>
        navigation.navigate('ChatRoom', { roomId: item.id, roomName: item.name })
      }
      accessibilityLabel={`Join ${item.name} room`}
      accessibilityRole="button"
    >
      <View className="flex-row justify-between items-start mb-2">
        <Text className="text-lg font-semibold text-gray-900 flex-1">
          {item.name}
        </Text>
        <View className="bg-primary-100 px-2 py-1 rounded-full">
          <Text className="text-primary-700 text-xs font-medium">
            {item.distance}
          </Text>
        </View>
      </View>
      <Text className="text-gray-600 text-sm mb-2" numberOfLines={2}>
        {item.description}
      </Text>
      <View className="flex-row items-center">
        <View className="w-2 h-2 rounded-full bg-green-500 mr-2" />
        <Text className="text-gray-500 text-sm">
          {item.members} members online
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-gray-50">
      {/* Search/filter header */}
      <View className="bg-white px-4 py-3 border-b border-gray-100">
        <View
          className="bg-gray-100 rounded-lg px-4 py-3"
          accessibilityRole="search"
          accessibilityLabel="Search rooms input"
        >
          <Text className="text-gray-500">Search rooms...</Text>
        </View>
      </View>

      {/* Room list */}
      <FlatList
        data={PLACEHOLDER_ROOMS}
        renderItem={renderRoom}
        keyExtractor={(item) => item.id}
        className="flex-1"
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
        accessibilityLabel="Nearby rooms list"
        ListEmptyComponent={
          <View className="items-center py-12">
            <Text className="text-gray-500 text-center">
              No rooms found nearby.{'\n'}Try expanding your search radius.
            </Text>
          </View>
        }
      />
    </View>
  );
}

export default DiscoverScreen;
