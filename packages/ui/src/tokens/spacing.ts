/**
 * Spacing tokens following 8dp baseline grid
 * Based on Material Design 3 specifications
 */

export const spacing = {
  xxs: 4,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const avatarSizes = {
  sm: 32,
  md: 48,
  lg: 72,
} as const;

export const iconSizes = {
  sm: 16,
  md: 24,
  lg: 32,
} as const;

export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radius;
export type AvatarSize = keyof typeof avatarSizes;
export type IconSize = keyof typeof iconSizes;
