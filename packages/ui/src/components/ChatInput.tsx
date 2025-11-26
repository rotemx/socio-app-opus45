import React from 'react';
import { colors, spacing, radius } from '../tokens';

export interface ChatInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onAttachment?: () => void;
  onVoiceRecord?: () => void;
  placeholder?: string;
  disabled?: boolean;
  maxLines?: number;
}

export function ChatInput({
  value,
  onChangeText,
  onSend,
  onAttachment,
  onVoiceRecord,
  placeholder = 'Message...',
  disabled = false,
  maxLines = 4,
}: ChatInputProps) {
  const hasText = value.trim().length > 0;

  // This is a placeholder - actual implementation will differ for web vs mobile
  return {
    type: 'ChatInput',
    props: {
      value,
      placeholder,
      disabled,
      maxLines,
      hasText,
      showSendButton: hasText,
      showVoiceButton: !hasText && !!onVoiceRecord,
      showAttachmentButton: !!onAttachment,
      height: 56,
      inputHeight: 40,
      backgroundColor: colors.surfaceContainerHigh.light,
      borderRadius: radius.full,
      padding: spacing.sm,
      onChangeText,
      onSend,
      onAttachment,
      onVoiceRecord,
    },
  };
}
