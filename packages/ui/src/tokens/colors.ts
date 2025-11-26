/**
 * Material Design 3 color tokens for Socio
 * Based on the UX/UI spec with Telegram-like blue primary
 */

export const colors = {
  // Primary
  primary: {
    light: '#0088CC',
    dark: '#80D4FF',
  },
  onPrimary: {
    light: '#FFFFFF',
    dark: '#003344',
  },
  primaryContainer: {
    light: '#CCE8FF',
    dark: '#004466',
  },
  onPrimaryContainer: {
    light: '#001F33',
    dark: '#CCE8FF',
  },

  // Secondary
  secondary: {
    light: '#5A6067',
    dark: '#C2C9D1',
  },
  secondaryContainer: {
    light: '#DEE3EB',
    dark: '#42484F',
  },

  // Surface
  surface: {
    light: '#FFF8F6',
    dark: '#1A1110',
  },
  surfaceVariant: {
    light: '#E0E3E9',
    dark: '#43474E',
  },
  onSurface: {
    light: '#1A1C1E',
    dark: '#E3E2E6',
  },
  onSurfaceVariant: {
    light: '#43474E',
    dark: '#C4C6CF',
  },

  // Surface containers (for elevation)
  surfaceContainerLow: {
    light: '#F5F3F7',
    dark: '#1D1B1F',
  },
  surfaceContainer: {
    light: '#EFEDF1',
    dark: '#211F23',
  },
  surfaceContainerHigh: {
    light: '#E9E7EC',
    dark: '#2C2A2E',
  },

  // Outline
  outline: {
    light: '#74777E',
    dark: '#8E9199',
  },
  outlineVariant: {
    light: '#C4C6CF',
    dark: '#43474E',
  },

  // Error
  error: {
    light: '#BA1A1A',
    dark: '#FFB4AB',
  },
  onError: {
    light: '#FFFFFF',
    dark: '#690005',
  },

  // Status
  online: '#4CAF50',
  idle: '#FFC107',
  offline: '#9E9E9E',
} as const;

export type ColorToken = keyof typeof colors;
