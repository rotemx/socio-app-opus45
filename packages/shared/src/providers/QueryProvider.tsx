import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Default stale time for queries (30 seconds)
 */
const DEFAULT_STALE_TIME = 30 * 1000;

/**
 * Default cache time (5 minutes)
 */
const DEFAULT_GC_TIME = 5 * 60 * 1000;

/**
 * Create a QueryClient instance with Socio defaults
 */
export const createQueryClient = (): QueryClient => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: DEFAULT_STALE_TIME,
        gcTime: DEFAULT_GC_TIME,
        retry: 2,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 1,
        retryDelay: 1000,
      },
    },
  });
};

/**
 * Singleton QueryClient instance
 * This ensures consistent cache across the app
 */
let queryClientInstance: QueryClient | null = null;

/**
 * Get the singleton QueryClient instance
 */
export const getQueryClient = (): QueryClient => {
  if (!queryClientInstance) {
    queryClientInstance = createQueryClient();
  }
  return queryClientInstance;
};

/**
 * Reset the QueryClient instance (for testing)
 */
export const resetQueryClient = (): void => {
  if (queryClientInstance) {
    queryClientInstance.clear();
    queryClientInstance = null;
  }
};

/**
 * Props for QueryProvider
 */
interface QueryProviderProps {
  children: ReactNode;
  client?: QueryClient;
}

/**
 * Query provider component for Socio applications
 * Wraps the app with TanStack Query's QueryClientProvider
 *
 * @example
 * ```tsx
 * // Using default singleton client
 * <QueryProvider>
 *   <App />
 * </QueryProvider>
 *
 * // Using custom client (e.g., for testing)
 * const testClient = createQueryClient();
 * <QueryProvider client={testClient}>
 *   <App />
 * </QueryProvider>
 * ```
 */
export function QueryProvider({ children, client }: QueryProviderProps) {
  const queryClient = client ?? getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
