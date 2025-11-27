import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { RootStackScreenProps } from '../../navigation/types';

type Props = RootStackScreenProps<'ChatRoom'>;

interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: Date;
  isOwn: boolean;
}

// Placeholder messages
const PLACEHOLDER_MESSAGES: Message[] = [
  {
    id: '1',
    text: 'Welcome to the room!',
    sender: 'System',
    timestamp: new Date(),
    isOwn: false,
  },
  {
    id: '2',
    text: 'Hey everyone!',
    sender: 'User1',
    timestamp: new Date(),
    isOwn: false,
  },
  {
    id: '3',
    text: 'Hello! Nice to meet you all',
    sender: 'You',
    timestamp: new Date(),
    isOwn: true,
  },
];

/**
 * Chat room screen - Real-time messaging interface
 */
export function ChatRoomScreen({ route }: Props): React.JSX.Element {
  const { roomId } = route.params;
  const [message, setMessage] = useState('');
  const [messages, _setMessages] = useState<Message[]>(PLACEHOLDER_MESSAGES);

  const sendMessage = (): void => {
    if (message.trim()) {
      // TODO: Implement actual message sending via WebSocket
      // Will be replaced with WebSocket emit in SOCIO-301
      void Promise.resolve({ roomId, message });
      setMessage('');
    }
  };

  const renderMessage = ({ item }: { item: Message }): React.JSX.Element => (
    <View
      className={`mb-3 max-w-[80%] ${item.isOwn ? 'self-end' : 'self-start'}`}
    >
      {!item.isOwn && (
        <Text className="text-xs text-gray-500 mb-1 ml-1">{item.sender}</Text>
      )}
      <View
        className={`px-4 py-3 rounded-2xl ${
          item.isOwn
            ? 'bg-primary-500 rounded-br-sm'
            : 'bg-gray-100 rounded-bl-sm'
        }`}
      >
        <Text className={item.isOwn ? 'text-white' : 'text-gray-900'}>
          {item.text}
        </Text>
      </View>
      <Text
        className={`text-xs text-gray-400 mt-1 ${
          item.isOwn ? 'text-right mr-1' : 'ml-1'
        }`}
      >
        {item.timestamp.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Messages list */}
      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        className="flex-1"
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        accessibilityLabel="Chat messages"
      />

      {/* Message input */}
      <View className="border-t border-gray-100 px-4 py-3 bg-white">
        <View className="flex-row items-end gap-2">
          <TextInput
            className="flex-1 bg-gray-100 rounded-2xl px-4 py-3 text-base max-h-24"
            placeholder="Type a message..."
            placeholderTextColor="#9ca3af"
            value={message}
            onChangeText={setMessage}
            multiline
            accessibilityLabel="Message input"
          />
          <TouchableOpacity
            className={`w-10 h-10 rounded-full items-center justify-center ${
              message.trim() ? 'bg-primary-500' : 'bg-gray-200'
            }`}
            onPress={sendMessage}
            disabled={!message.trim()}
            accessibilityLabel="Send message"
            accessibilityRole="button"
          >
            <Text
              className={`text-lg ${
                message.trim() ? 'text-white' : 'text-gray-400'
              }`}
            >
              &#10148;
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

export default ChatRoomScreen;
