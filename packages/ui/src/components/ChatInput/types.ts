/**
 * ChatInput component types
 * Implements chat input bar with text, attachments, and voice recording
 */

/** Attachment type options */
export type AttachmentType = 'gallery' | 'camera' | 'file' | 'location';

/** Voice recording state */
export type VoiceRecordingState = 'idle' | 'recording' | 'cancelled';

/** Attachment option definition */
export interface AttachmentOption {
  type: AttachmentType;
  label: string;
  icon: string;
}

/** Voice recording data */
export interface VoiceRecordingData {
  uri: string;
  duration: number; // milliseconds
}

/** Main ChatInput props */
export interface ChatInputProps {
  /** Current text value */
  value: string;
  /** Text change handler */
  onChangeText: (text: string) => void;
  /** Send message handler (supports async operations) */
  onSend: () => void | Promise<void>;
  /** Attachment selection handler (supports async operations) */
  onAttachment?: (type: AttachmentType) => void | Promise<void>;
  /** Voice recording completion handler (supports async operations) */
  onVoiceRecord?: (data: VoiceRecordingData) => void | Promise<void>;
  /** Emoji picker open handler */
  onEmojiPress?: () => void | Promise<void>;
  /** Placeholder text */
  placeholder?: string;
  /** Disable input */
  disabled?: boolean;
  /** Maximum number of lines before scrolling (default: 4) */
  maxLines?: number;
  /** Test ID for testing */
  testID?: string;
}

/** AttachmentSheet props */
export interface AttachmentSheetProps {
  /** Whether the sheet is visible */
  visible: boolean;
  /** Close handler */
  onClose: () => void;
  /** Attachment selection handler */
  onSelect: (type: AttachmentType) => void;
  /** Test ID for testing */
  testID?: string;
}

/** VoiceRecorder props */
export interface VoiceRecorderProps {
  /** Whether recording is active */
  isRecording: boolean;
  /** Recording duration in milliseconds */
  duration: number;
  /** Waveform amplitude values (0-1) */
  waveform: number[];
  /** Cancel offset (0-1, where 1 is fully cancelled) */
  cancelOffset: number;
  /** Test ID for testing */
  testID?: string;
}

/** MorphingButton props */
export interface MorphingButtonProps {
  /** Whether to show send icon (true) or mic icon (false) */
  showSend: boolean;
  /** Press handler */
  onPress: () => void;
  /** Long press handler for voice recording */
  onLongPress?: () => void;
  /** Press out handler for voice recording end */
  onPressOut?: () => void;
  /** Pan gesture handler for slide-to-cancel */
  onPanGesture?: (translateX: number) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Test ID for testing */
  testID?: string;
}

/** Default attachment options */
export const ATTACHMENT_OPTIONS: AttachmentOption[] = [
  { type: 'gallery', label: 'Gallery', icon: '🖼️' },
  { type: 'camera', label: 'Camera', icon: '📷' },
  { type: 'file', label: 'File', icon: '📄' },
  { type: 'location', label: 'Location', icon: '📍' },
];

/** Design constants */
export const CHAT_INPUT_CONSTANTS = {
  /** Minimum height of the input container */
  MIN_HEIGHT: 56,
  /** Height of the pill-shaped input */
  INPUT_HEIGHT: 40,
  /** Minimum touch target size */
  TOUCH_TARGET: 48,
  /** Approximate line height for calculating max height */
  LINE_HEIGHT: 20,
  /** Slide distance to cancel voice recording */
  CANCEL_SLIDE_DISTANCE: 100,
  /** Animation duration in ms */
  ANIMATION_DURATION: 200,
} as const;
