import { useChatStore } from '../stores/chatStore';
import type { Message, TypingIndicator } from '@socio/types';

export function useChat(roomId: string) {
  const { messages, typingUsers, addMessage, setMessages, setTyping, clearRoom } =
    useChatStore();

  const roomMessages = messages[roomId] || [];
  const roomTypingUsers = typingUsers[roomId] || [];

  const sendMessage = (message: Message) => {
    addMessage(roomId, message);
  };

  const handleTyping = (indicator: TypingIndicator) => {
    setTyping(roomId, indicator);
  };

  const loadMessages = (msgs: Message[]) => {
    setMessages(roomId, msgs);
  };

  const clear = () => {
    clearRoom(roomId);
  };

  return {
    messages: roomMessages,
    typingUsers: roomTypingUsers,
    sendMessage,
    handleTyping,
    loadMessages,
    clear,
  };
}
