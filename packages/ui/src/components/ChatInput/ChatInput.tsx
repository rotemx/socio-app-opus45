import { useState, useCallback, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  Text,
  PanResponder,
} from 'react-native';
import { colors, spacing, radius } from '../../tokens';
import type { ChatInputProps, VoiceRecordingData } from './types';
import { CHAT_INPUT_CONSTANTS } from './types';
import { MorphingButton } from './MorphingButton';
import { VoiceRecorder } from './VoiceRecorder';
import { AttachmentSheet } from './AttachmentSheet';

/**
 * ChatInput - Full-featured chat input bar
 *
 * Features:
 * - Auto-expanding text input (up to maxLines)
 * - Attachment button with bottom sheet
 * - Emoji button inside input
 * - Send/Microphone morphing button with animation
 * - Voice recording with press-and-hold
 * - Waveform visualization during recording
 * - Slide-to-cancel for voice recording
 *
 * Design Specs:
 * - Height: 56dp minimum
 * - Input: pill shape, 40dp height
 * - Touch targets: 48dp minimum
 */
export function ChatInput({
  value,
  onChangeText,
  onSend,
  onAttachment,
  onVoiceRecord,
  onEmojiPress,
  placeholder = 'Message...',
  disabled = false,
  maxLines = 4,
  testID,
}: ChatInputProps): React.JSX.Element {
  const [isAttachmentSheetVisible, setIsAttachmentSheetVisible] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [cancelOffset, setCancelOffset] = useState(0);

  const recordingStartTime = useRef<number | null>(null);
  const recordingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRecordingRef = useRef(false);
  const cancelOffsetRef = useRef(0);

  const hasText = value.trim().length > 0;

  // Keep refs in sync with state for PanResponder access
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    cancelOffsetRef.current = cancelOffset;
  }, [cancelOffset]);

  // Cleanup recording timer on unmount
  useEffect(() => {
    return () => {
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
      }
    };
  }, []);

  // Generate mock waveform data during recording
  useEffect(() => {
    if (isRecording) {
      const interval = setInterval(() => {
        setWaveform((prev) => {
          const newAmplitude = 0.2 + Math.random() * 0.6;
          const newWaveform = [...prev, newAmplitude];
          // Keep only last 50 samples
          return newWaveform.slice(-50);
        });
      }, 100);
      return () => clearInterval(interval);
    }
    setWaveform([]);
    return undefined;
  }, [isRecording]);

  const handleAttachmentPress = useCallback(() => {
    if (onAttachment) {
      setIsAttachmentSheetVisible(true);
    }
  }, [onAttachment]);

  const handleAttachmentSelect = useCallback(
    (type: 'gallery' | 'camera' | 'file' | 'location') => {
      try {
        onAttachment?.(type);
      } catch (error) {
        console.error('Error handling attachment selection:', error);
      }
    },
    [onAttachment]
  );

  const startRecording = useCallback(() => {
    if (!onVoiceRecord || disabled) return;

    setIsRecording(true);
    setRecordingDuration(0);
    setCancelOffset(0);
    recordingStartTime.current = Date.now();

    // Start duration timer
    recordingTimer.current = setInterval(() => {
      if (recordingStartTime.current) {
        setRecordingDuration(Date.now() - recordingStartTime.current);
      }
    }, 100);
  }, [onVoiceRecord, disabled]);

  const stopRecording = useCallback(
    (cancelled: boolean) => {
      if (!isRecording) return;

      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
        recordingTimer.current = null;
      }

      const duration = recordingStartTime.current
        ? Date.now() - recordingStartTime.current
        : 0;

      setIsRecording(false);
      setRecordingDuration(0);
      setCancelOffset(0);
      recordingStartTime.current = null;

      // Only call onVoiceRecord if not cancelled and has meaningful duration
      if (!cancelled && duration > 500 && onVoiceRecord) {
        const recordingData: VoiceRecordingData = {
          uri: '', // Would be provided by actual recording implementation
          duration,
        };
        try {
          onVoiceRecord(recordingData);
        } catch (error) {
          console.error('Error handling voice recording:', error);
        }
      }
    },
    [isRecording, onVoiceRecord]
  );

  // Store stopRecording in ref for PanResponder access
  const stopRecordingRef = useRef(stopRecording);
  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);

  // Pan responder for slide-to-cancel (uses refs to avoid stale closures)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: () => isRecordingRef.current,
      onPanResponderMove: (_, gestureState) => {
        const dx = gestureState.dx;
        if (dx < 0) {
          const offset = Math.min(
            1,
            Math.abs(dx) / CHAT_INPUT_CONSTANTS.CANCEL_SLIDE_DISTANCE
          );
          setCancelOffset(offset);
        }
      },
      onPanResponderRelease: () => {
        if (cancelOffsetRef.current > 0.5) {
          stopRecordingRef.current(true);
        } else {
          stopRecordingRef.current(false);
        }
      },
    })
  ).current;

  const handleMorphingButtonPress = useCallback(() => {
    if (hasText) {
      try {
        onSend();
      } catch (error) {
        console.error('Error sending message:', error);
      }
    }
  }, [hasText, onSend]);

  const handleMorphingButtonLongPress = useCallback(() => {
    if (!hasText && onVoiceRecord) {
      startRecording();
    }
  }, [hasText, onVoiceRecord, startRecording]);

  const handleMorphingButtonPressOut = useCallback(() => {
    if (isRecording) {
      stopRecording(cancelOffset > 0.5);
    }
  }, [isRecording, cancelOffset, stopRecording]);

  const handleEmojiPress = useCallback(() => {
    if (onEmojiPress) {
      try {
        onEmojiPress();
      } catch (error) {
        console.error('Error opening emoji picker:', error);
      }
    }
  }, [onEmojiPress]);

  const handleAttachmentSheetClose = useCallback(() => {
    setIsAttachmentSheetVisible(false);
  }, []);

  return (
    <View style={styles.wrapper} testID={testID} {...panResponder.panHandlers}>
      <View style={[styles.container, disabled && styles.containerDisabled]}>
        {/* Voice recorder overlay */}
        <VoiceRecorder
          isRecording={isRecording}
          duration={recordingDuration}
          waveform={waveform}
          cancelOffset={cancelOffset}
          testID={testID ? `${testID}-voice-recorder` : undefined}
        />

        {/* Attachment button */}
        {onAttachment && !isRecording && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleAttachmentPress}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="Attach file"
          >
            <Text style={styles.iconText}>📎</Text>
          </TouchableOpacity>
        )}

        {/* Text input area */}
        {!isRecording && (
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, { maxHeight: maxLines * CHAT_INPUT_CONSTANTS.LINE_HEIGHT }]}
              value={value}
              onChangeText={onChangeText}
              placeholder={placeholder}
              placeholderTextColor={colors.onSurfaceVariant.light}
              multiline
              editable={!disabled}
              accessibilityLabel="Message input"
            />
            {/* Emoji button */}
            {onEmojiPress && (
              <TouchableOpacity
                style={styles.emojiButton}
                onPress={handleEmojiPress}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel="Open emoji picker"
              >
                <Text style={styles.emojiText}>😊</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Send/Mic morphing button */}
        {!isRecording && (
          <MorphingButton
            showSend={hasText}
            onPress={handleMorphingButtonPress}
            onLongPress={handleMorphingButtonLongPress}
            onPressOut={handleMorphingButtonPressOut}
            disabled={disabled}
            testID={testID ? `${testID}-morphing-button` : undefined}
          />
        )}
      </View>

      {/* Attachment sheet */}
      <AttachmentSheet
        visible={isAttachmentSheetVisible}
        onClose={handleAttachmentSheetClose}
        onSelect={handleAttachmentSelect}
        testID={testID ? `${testID}-attachment-sheet` : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.surfaceContainerHigh.light,
    padding: spacing.sm,
    borderRadius: CHAT_INPUT_CONSTANTS.MIN_HEIGHT / 2,
    minHeight: CHAT_INPUT_CONSTANTS.MIN_HEIGHT,
  },
  containerDisabled: {
    opacity: 0.6,
  },
  iconButton: {
    width: CHAT_INPUT_CONSTANTS.TOUCH_TARGET,
    height: CHAT_INPUT_CONSTANTS.TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 24,
    color: colors.onSurfaceVariant.light,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.surface.light,
    borderRadius: radius.full,
    minHeight: CHAT_INPUT_CONSTANTS.INPUT_HEIGHT,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.onSurface.light,
    paddingTop: 0,
    paddingBottom: 0,
    textAlignVertical: 'center',
  },
  emojiButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.xs,
  },
  emojiText: {
    fontSize: 20,
  },
});

export default ChatInput;
