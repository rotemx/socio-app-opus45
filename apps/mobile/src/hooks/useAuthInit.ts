import { useEffect, useCallback } from 'react';
import { useAuthStore, authService } from '@socio/shared';
import { secureStorage } from '../services';

/**
 * Hook to initialize authentication state from secure storage
 * Call this once in App.tsx to hydrate auth state on app start
 */
export function useAuthInit(): void {
  const { setAuth, setLoading, logout } = useAuthStore();

  const initAuth = useCallback(async () => {
    setLoading(true);
    try {
      // Check for stored tokens
      const tokens = await secureStorage.getTokens();

      if (!tokens) {
        // No stored tokens, user is not authenticated
        setLoading(false);
        return;
      }

      // Set the access token for API calls
      authService.setAccessToken(tokens.accessToken);

      // Try to get current user with stored token
      try {
        const user = await authService.getCurrentUser();
        setAuth(user, tokens);
      } catch (error) {
        console.error('Failed to get current user, attempting token refresh:', error);
        // Token might be expired, try to refresh
        try {
          const newTokens = await authService.refreshToken(tokens.refreshToken);
          // Set the new access token before fetching user
          authService.setAccessToken(newTokens.accessToken);
          const user = await authService.getCurrentUser();

          // Save new tokens
          await secureStorage.saveTokens(newTokens);
          setAuth(user, newTokens);
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          // Refresh failed, clear tokens and log out
          await secureStorage.removeTokens();
          logout();
        }
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      await secureStorage.removeTokens();
      logout();
    }
  }, [setAuth, setLoading, logout]);

  useEffect(() => {
    initAuth();
  }, [initAuth]);
}
