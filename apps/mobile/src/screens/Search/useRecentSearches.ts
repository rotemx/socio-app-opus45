import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RecentSearch, SearchTab } from './types';

const STORAGE_KEY = '@socio/recent_searches';
const MAX_RECENT_SEARCHES = 20;

/**
 * Hook for managing recent searches in AsyncStorage
 */
export function useRecentSearches() {
  const [searches, setSearches] = useState<RecentSearch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load searches from storage on mount
  useEffect(() => {
    const loadSearches = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as RecentSearch[];
          // Filter out old searches (older than 30 days)
          const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
          const filtered = parsed.filter((s) => s.timestamp > thirtyDaysAgo);
          setSearches(filtered);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to load recent searches:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSearches();
  }, []);

  const saveSearches = useCallback(async (newSearches: RecentSearch[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSearches));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to save recent searches:', error);
    }
  }, []);

  const addSearch = useCallback(
    async (query: string, tab: SearchTab) => {
      if (query.trim().length < 3) {return;}

      const newSearch: RecentSearch = {
        query: query.trim(),
        timestamp: Date.now(),
        tab,
      };

      // Remove duplicates and add new search at the beginning
      const filtered = searches.filter(
        (s) => !(s.query.toLowerCase() === query.toLowerCase() && s.tab === tab)
      );
      const updated = [newSearch, ...filtered].slice(0, MAX_RECENT_SEARCHES);

      setSearches(updated);
      await saveSearches(updated);
    },
    [searches, saveSearches]
  );

  const removeSearch = useCallback(
    async (search: RecentSearch) => {
      const filtered = searches.filter(
        (s) =>
          !(s.query === search.query && s.timestamp === search.timestamp)
      );
      setSearches(filtered);
      await saveSearches(filtered);
    },
    [searches, saveSearches]
  );

  const clearAll = useCallback(async () => {
    setSearches([]);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    searches,
    isLoading,
    addSearch,
    removeSearch,
    clearAll,
  };
}

export default useRecentSearches;
