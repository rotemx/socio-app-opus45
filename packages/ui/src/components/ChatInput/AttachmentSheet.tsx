import { useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { colors, spacing, radius } from '../../tokens';
import type { AttachmentSheetProps, AttachmentType } from './types';
import { ATTACHMENT_OPTIONS, CHAT_INPUT_CONSTANTS } from './types';

/**
 * AttachmentOption - Single attachment option button
 */
function AttachmentOptionButton({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <TouchableOpacity
      style={styles.optionButton}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Attach ${label}`}
    >
      <View style={styles.optionIconContainer}>
        <Text style={styles.optionIcon}>{icon}</Text>
      </View>
      <Text style={styles.optionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

/**
 * AttachmentSheet - Bottom sheet for selecting attachment type
 *
 * Features:
 * - Modal overlay with backdrop
 * - Grid of attachment options (Gallery, Camera, File, Location)
 * - 48dp minimum touch targets
 * - Tap backdrop to dismiss
 */
export function AttachmentSheet({
  visible,
  onClose,
  onSelect,
  testID,
}: AttachmentSheetProps): React.JSX.Element {
  const handleSelect = useCallback(
    (type: AttachmentType) => {
      try {
        onSelect(type);
      } catch (error) {
        console.error('Error handling attachment selection:', error);
      } finally {
        onClose();
      }
    },
    [onSelect, onClose]
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      testID={testID}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Handle indicator (decorative) */}
          <View
            style={styles.handleContainer}
            accessible={false}
            importantForAccessibility="no"
          >
            <View style={styles.handle} />
          </View>

          {/* Title */}
          <Text style={styles.title}>Attach</Text>

          {/* Options grid */}
          <View style={styles.optionsGrid}>
            {ATTACHMENT_OPTIONS.map((option) => (
              <AttachmentOptionButton
                key={option.type}
                icon={option.icon}
                label={option.label}
                onPress={() => handleSelect(option.type)}
              />
            ))}
          </View>

          {/* Cancel button */}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface.light,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing.xl,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.outlineVariant.light,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.onSurface.light,
    textAlign: 'center',
    marginVertical: spacing.md,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    justifyContent: 'space-around',
  },
  optionButton: {
    alignItems: 'center',
    width: 80,
    minHeight: CHAT_INPUT_CONSTANTS.TOUCH_TARGET,
    paddingVertical: spacing.md,
  },
  optionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceContainerHigh.light,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  optionIcon: {
    fontSize: 24,
  },
  optionLabel: {
    fontSize: 13,
    color: colors.onSurfaceVariant.light,
  },
  cancelButton: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerHigh.light,
    borderRadius: radius.lg,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.onSurfaceVariant.light,
  },
});

export default AttachmentSheet;
