import type { AuthTokens } from '@socio/types';

/**
 * Secure storage service for sensitive data like auth tokens
 *
 * NOTE: For production, this should use react-native-keychain for secure storage.
 * Currently uses a simple in-memory fallback for development.
 *
 * To enable secure storage:
 * 1. Install: pnpm add react-native-keychain
 * 2. For iOS: cd ios && pod install
 * 3. Uncomment the Keychain implementation below
 */

// Storage keys
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'socio_access_token',
  REFRESH_TOKEN: 'socio_refresh_token',
  TOKENS: 'socio_auth_tokens',
} as const;

// In-memory fallback storage (NOT secure, for development only)
const memoryStorage: Map<string, string> = new Map();

/**
 * Secure storage interface
 */
export interface SecureStorage {
  setItem: (key: string, value: string) => Promise<void>;
  getItem: (key: string) => Promise<string | null>;
  removeItem: (key: string) => Promise<void>;
  clear: () => Promise<void>;
}

/**
 * In-memory storage implementation (development fallback)
 * WARNING: Not secure, data is lost on app restart
 */
const memoryStorageImpl: SecureStorage = {
  async setItem(key: string, value: string) {
    memoryStorage.set(key, value);
  },
  async getItem(key: string) {
    return memoryStorage.get(key) ?? null;
  },
  async removeItem(key: string) {
    memoryStorage.delete(key);
  },
  async clear() {
    memoryStorage.clear();
  },
};

// TODO: Implement Keychain storage when react-native-keychain is installed
// import * as Keychain from 'react-native-keychain';
//
// const keychainStorageImpl: SecureStorage = {
//   async setItem(key: string, value: string) {
//     await Keychain.setGenericPassword(key, value, { service: key });
//   },
//   async getItem(key: string) {
//     const credentials = await Keychain.getGenericPassword({ service: key });
//     return credentials ? credentials.password : null;
//   },
//   async removeItem(key: string) {
//     await Keychain.resetGenericPassword({ service: key });
//   },
//   async clear() {
//     // Clear all known keys
//     await Promise.all(
//       Object.values(STORAGE_KEYS).map((key) =>
//         Keychain.resetGenericPassword({ service: key })
//       )
//     );
//   },
// };

// Use memory storage for now (replace with keychainStorageImpl in production)
const storage: SecureStorage = memoryStorageImpl;

// Warn if using insecure storage in production
if (typeof __DEV__ !== 'undefined' && !__DEV__) {
  console.warn(
    'WARNING: Using insecure in-memory storage. ' +
      'Please install and configure react-native-keychain for secure storage.'
  );
}

/**
 * Save auth tokens securely
 */
export async function saveTokens(tokens: AuthTokens): Promise<void> {
  try {
    await storage.setItem(STORAGE_KEYS.TOKENS, JSON.stringify(tokens));
  } catch (error) {
    console.error('Failed to save tokens:', error);
    throw error;
  }
}

/**
 * Get stored auth tokens
 */
export async function getTokens(): Promise<AuthTokens | null> {
  try {
    const tokensJson = await storage.getItem(STORAGE_KEYS.TOKENS);
    if (!tokensJson) {return null;}

    const parsed: unknown = JSON.parse(tokensJson);

    // Validate parsed data has required AuthTokens properties
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('accessToken' in parsed) ||
      !('refreshToken' in parsed) ||
      typeof (parsed as Record<string, unknown>).accessToken !== 'string' ||
      typeof (parsed as Record<string, unknown>).refreshToken !== 'string'
    ) {
      console.error('Invalid token data structure');
      return null;
    }

    return parsed as AuthTokens;
  } catch (error) {
    console.error('Failed to get tokens:', error);
    return null;
  }
}

/**
 * Remove stored auth tokens
 */
export async function removeTokens(): Promise<void> {
  try {
    await storage.removeItem(STORAGE_KEYS.TOKENS);
  } catch (error) {
    console.error('Failed to remove tokens:', error);
    throw error;
  }
}

/**
 * Clear all secure storage
 */
export async function clearSecureStorage(): Promise<void> {
  try {
    await storage.clear();
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
