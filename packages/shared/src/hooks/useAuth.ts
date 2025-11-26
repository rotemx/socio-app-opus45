import { useAuthStore } from '../stores/authStore';

export function useAuth() {
  const { user, tokens, isAuthenticated, isLoading, setUser, setTokens, logout } =
    useAuthStore();

  return {
    user,
    tokens,
    isAuthenticated,
    isLoading,
    setUser,
    setTokens,
    logout,
  };
}
