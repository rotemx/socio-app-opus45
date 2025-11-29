import type { AuthTokens } from '@socio/types';
import * as Keychain from 'react-native-keychain';

/**
 * Secure storage service for sensitive data like auth tokens
 * Uses react-native-keychain for secure storage on iOS (Keychain) and Android (Keystore).
 */

// Storage keys
const STORAGE_KEYS = {
  TOKENS: 'socio_auth_tokens',
} as const;

/**
 * Save auth tokens securely
 */
export async function saveTokens(tokens: AuthTokens): Promise<void> {
  try {
    await Keychain.setGenericPassword('tokens', JSON.stringify(tokens), {
      service: STORAGE_KEYS.TOKENS,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
    });
  } catch (error) {
    console.error('Failed to save tokens securely:', error);
    throw error;
  }
}

/**
 * Get stored auth tokens
 */
export async function getTokens(): Promise<AuthTokens | null> {
  try {
    const credentials = await Keychain.getGenericPassword({
      service: STORAGE_KEYS.TOKENS,
    });

    if (!credentials || !credentials.password) {
      return null;
    }

    const parsed: unknown = JSON.parse(credentials.password);

    // Validate parsed data has required AuthTokens properties
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('accessToken' in parsed) ||
      !('refreshToken' in parsed) ||
      typeof (parsed as Record<string, unknown>).accessToken !== 'string' ||
      typeof (parsed as Record<string, unknown>).refreshToken !== 'string'
    ) {
      console.error('Invalid token data structure from secure storage');
      return null;
    }

    return parsed as AuthTokens;
  } catch (error) {
    console.error('Failed to get tokens from secure storage:', error);
    return null;
  }
}

/**
 * Remove stored auth tokens
 */
export async function removeTokens(): Promise<void> {
  try {
    await Keychain.resetGenericPassword({ service: STORAGE_KEYS.TOKENS });
  } catch (error) {
    console.error('Failed to remove tokens from secure storage:', error);
    throw error;
  }
}

/**
 * Clear all secure storage
 */
export async function clearSecureStorage(): Promise<void> {
  try {
    await Keychain.resetGenericPassword({ service: STORAGE_KEYS.TOKENS });
  } catch (error) {
    console.error('Failed to clear secure storage:', error);
    throw error;
  }
}

/**
 * Check if user has stored tokens
 */
export async function hasStoredTokens(): Promise<boolean> {
  const tokens = await getTokens();
  return tokens !== null;
}

export const secureStorage = {
  saveTokens,
  getTokens,
  removeTokens,
  clearSecureStorage,
  hasStoredTokens,
};