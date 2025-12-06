import { StyleSheet, View, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  useDerivedValue,
} from 'react-native-reanimated';
import { colors, spacing } from '../../tokens';
import type { VoiceRecorderProps } from './types';
import { CHAT_INPUT_CONSTANTS } from './types';

/**
 * Format duration from milliseconds to mm:ss
 */
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Waveform visualization component
 */
function Waveform({ amplitudes }: { amplitudes: number[] }): React.JSX.Element {
  const barCount = 20;
  // Use the most recent amplitudes or fill with zeros
  const displayAmplitudes = amplitudes.slice(-barCount);
  while (displayAmplitudes.length < barCount) {
    displayAmplitudes.unshift(0);
  }

  return (
    <View
      style={styles.waveformContainer}
      accessible
      accessibilityLabel="Audio waveform visualization"
      accessibilityRole="image"
    >
      {displayAmplitudes.map((amplitude, index) => (
        <View
          key={index}
          style={[
            styles.waveformBar,
            {
              height: Math.max(4, amplitude * 24),
            },
          ]}
        />
      ))}
    </View>
  );
}

/**
 * VoiceRecorder - Voice recording overlay with waveform visualization
 *
 * Features:
 * - Recording duration timer
 * - Live waveform visualization
 * - "Slide to cancel" indicator with animated arrow
 * - Cancel progress indicator
 */
export function VoiceRecorder({
  isRecording,
  duration,
  waveform,
  cancelOffset,
  testID,
}: VoiceRecorderProps): React.JSX.Element | null {
  // Create derived value from cancelOffset for animations
  const animatedCancelOffset = useDerivedValue(() => cancelOffset);

  const slideTextStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      animatedCancelOffset.value,
      [0, 0.5, 1],
      [1, 0.5, 0],
      Extrapolation.CLAMP
    ),
  }));

  const cancelTextStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      animatedCancelOffset.value,
      [0.3, 0.7],
      [0, 1],
      Extrapolation.CLAMP
    ),
  }));

  // Early return after hooks
  if (!isRecording) {
    return null;
  }

  const isCancelling = cancelOffset > 0.5;

  return (
    <View style={styles.container} testID={testID}>
      {/* Recording indicator */}
      <View
        style={styles.recordingIndicator}
        accessible
        accessibilityLabel={`Recording in progress, duration ${formatDuration(duration)}`}
        accessibilityRole="timer"
      >
        <View style={styles.recordingDot} accessible={false} />
        <Text style={styles.durationText}>{formatDuration(duration)}</Text>
      </View>

      {/* Waveform */}
      <View style={styles.waveformWrapper}>
        <Waveform amplitudes={waveform} />
      </View>

      {/* Slide to cancel / Release to cancel */}
      <View
        style={styles.cancelSection}
        accessible
        accessibilityLabel={isCancelling ? 'Release to cancel recording' : 'Slide left to cancel recording'}
        accessibilityHint="Slide your finger left to cancel the voice recording"
      >
        <Animated.View style={slideTextStyle}>
          <Text style={styles.slideText}>
            <Text style={styles.arrowText}>{'<'} </Text>
            Slide to cancel
          </Text>
        </Animated.View>
        <Animated.View style={[styles.cancelTextWrapper, cancelTextStyle]}>
          <Text style={[styles.slideText, isCancelling && styles.cancellingText]}>
            {isCancelling ? 'Release to cancel' : ''}
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.surfaceContainerHigh.light,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: CHAT_INPUT_CONSTANTS.MIN_HEIGHT / 2,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error.light,
    marginRight: spacing.sm,
  },
  durationText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurface.light,
    fontVariant: ['tabular-nums'],
  },
  waveformWrapper: {
    flex: 1,
    marginHorizontal: spacing.sm,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 24,
    gap: 2,
  },
  waveformBar: {
    width: 3,
    backgroundColor: colors.primary.light,
    borderRadius: 1.5,
  },
  cancelSection: {
    minWidth: 100,
    alignItems: 'flex-end',
  },
  slideText: {
    fontSize: 13,
    color: colors.onSurfaceVariant.light,
  },
  arrowText: {
    fontWeight: 'bold',
  },
  cancelTextWrapper: {
    position: 'absolute',
  },
  cancellingText: {
    color: colors.error.light,
  },
});

export default VoiceRecorder;
