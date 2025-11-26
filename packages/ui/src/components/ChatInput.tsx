import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
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

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      backgroundColor: colors.surfaceContainerHigh.light,
      padding: spacing.sm,
      borderRadius: radius.full,
      minHeight: 56, // approximates original height
    },
    input: {
      flex: 1,
      minHeight: 40,
      maxHeight: maxLines * 20, // Approximate line height for maxLines
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: 'transparent', // No background for input itself
      color: colors.onSurface.light,
      fontSize: 16,
    },
    button: {
      justifyContent: 'center',
      alignItems: 'center',
      width: 40,
      height: 40,
      borderRadius: radius.full,
      marginLeft: spacing.xs,
    },
    sendButton: {
      backgroundColor: colors.primary.light,
    },
    buttonText: {
      color: colors.onPrimary.light,
      fontSize: 18,
      fontWeight: 'bold',
    },
    attachmentButton: {
      backgroundColor: 'transparent',
    },
    attachmentText: {
      color: colors.onSurfaceVariant.light,
      fontSize: 24, // Placeholder for icon
    },
  });

  return (
    <View style={styles.container}>
      {onAttachment && (
        <TouchableOpacity style={styles.button} onPress={onAttachment} disabled={disabled}>
          <Text style={styles.attachmentText}>📎</Text>
        </TouchableOpacity>
      )}
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.onSurfaceVariant.light}
        multiline
        editable={!disabled}
      />
      {hasText ? (
        <TouchableOpacity style={[styles.button, styles.sendButton]} onPress={onSend} disabled={disabled}>
          <Text style={styles.buttonText}>➤</Text>
        </TouchableOpacity>
      ) : (
        onVoiceRecord && (
          <TouchableOpacity style={styles.button} onPress={onVoiceRecord} disabled={disabled}>
            <Text style={styles.attachmentText}>🎤</Text>
          </TouchableOpacity>
        )
      )}
    </View>
  );
}
