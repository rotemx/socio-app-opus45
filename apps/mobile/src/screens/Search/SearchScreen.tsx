import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, StyleSheet, Keyboard } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useSearchRooms,
  useSearchMessages,
  useSearchUsers,
  type RoomSearchResult,
  type MessageSearchResult as SharedMessageSearchResult,
  type UserSearchResult,
} from '@socio/shared';
import { colors } from '@socio/ui';
import { SearchInput } from './SearchInput';
import { SearchTabs } from './SearchTabs';
import { RoomSearchResults } from './RoomSearchResults';
import { MessageSearchResults } from './MessageSearchResults';
import { UserSearchResults } from './UserSearchResults';
import { RecentSearches } from './RecentSearches';
import { useRecentSearches } from './useRecentSearches';
import type { SearchTab, MessageSearchResult, RecentSearch } from './types';
import type { RootStackScreenProps } from '../../navigation/types';

type NavigationProp = RootStackScreenProps<'Search'>['navigation'];

const DEBOUNCE_MS = 300;

/**
 * Global search screen with rooms, messages, and users tabs
 */
export function SearchScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp>();

  // State
  const [inputValue, setInputValue] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTab>('rooms');

  // For message search, we need a roomId - initially none
  // Note: Currently not exposing room selection in UI, will be added in SOC-100
  const [messageSearchRoomId] = useState<string | undefined>();

  // Refs
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hooks
  const recentSearches = useRecentSearches();

  // Search queries
  const roomsQuery = useSearchRooms({ q: debouncedQuery });
  const messagesQuery = useSearchMessages({
    q: debouncedQuery,
    roomId: messageSearchRoomId ?? ''
  });
  const usersQuery = useSearchUsers({ q: debouncedQuery });

  // Debounce search input
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(inputValue.trim());
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [inputValue]);

  // Memoized result counts
  const resultCounts = useMemo(() => ({
    rooms: roomsQuery.data?.pages.reduce((sum: number, page) => sum + page.results.length, 0),
    messages: messagesQuery.data?.pages.reduce((sum: number, page) => sum + page.results.length, 0),
    users: usersQuery.data?.pages.reduce((sum: number, page) => sum + page.results.length, 0),
  }), [roomsQuery.data, messagesQuery.data, usersQuery.data]);

  // Handlers
  const handleCancel = useCallback(() => {
    Keyboard.dismiss();
    navigation.goBack();
  }, [navigation]);

  const handleClear = useCallback(() => {
    setInputValue('');
    setDebouncedQuery('');
  }, []);

  const handleTabChange = useCallback((tab: SearchTab) => {
    setActiveTab(tab);
  }, []);

  const handleRecentSearchPress = useCallback((search: RecentSearch) => {
    setInputValue(search.query);
    setDebouncedQuery(search.query);
    setActiveTab(search.tab);
  }, []);

  // When navigating to a room from results, also log the search
  useEffect(() => {
    const unsubscribe = navigation.addListener('blur', () => {
      if (debouncedQuery.length >= 3) {
        recentSearches.addSearch(debouncedQuery, activeTab);
      }
    });
    return unsubscribe;
  }, [navigation, debouncedQuery, activeTab, recentSearches]);

  const handleMessagePress = useCallback((_message: MessageSearchResult) => {
    // Navigate to chat room with the message highlighted
    // TODO (SOC-100): Implement scroll-to-message functionality
    // For now, this is a placeholder
  }, []);

  const handleUserPress = useCallback((_user: { id: string; username: string }) => {
    // Navigate to user profile
    // TODO: Add UserProfile screen navigation when available
    // navigation.navigate('UserProfile', { userId: user.id });
  }, []);

  // Flatten paginated results
  const roomResults = useMemo(() =>
    roomsQuery.data?.pages.flatMap((page: { results: RoomSearchResult[] }) => page.results) ?? [],
    [roomsQuery.data]
  );

  const messageResults = useMemo(() =>
    messagesQuery.data?.pages.flatMap((page: { results: SharedMessageSearchResult[] }) => page.results) ?? [],
    [messagesQuery.data]
  );

  const userResults = useMemo(() =>
    usersQuery.data?.pages.flatMap((page: { results: UserSearchResult[] }) => page.results) ?? [],
    [usersQuery.data]
  );

  // Determine if we should show recent searches or results
  const showRecentSearches = debouncedQuery.length < 3 && inputValue.length === 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <SearchInput
        value={inputValue}
        onChangeText={setInputValue}
        onClear={handleClear}
        onCancel={handleCancel}
        placeholder="Search rooms, messages, users..."
        autoFocus
      />

      {!showRecentSearches && (
        <SearchTabs
          activeTab={activeTab}
          onTabChange={handleTabChange}
          roomsCount={resultCounts.rooms}
          messagesCount={resultCounts.messages}
          usersCount={resultCounts.users}
        />
      )}

      <View style={styles.content}>
        {showRecentSearches ? (
          <RecentSearches
            searches={recentSearches.searches}
            onSearchPress={handleRecentSearchPress}
            onClearAll={recentSearches.clearAll}
            onRemoveSearch={recentSearches.removeSearch}
          />
        ) : (
          <>
            {activeTab === 'rooms' && (
              <RoomSearchResults
                results={roomResults}
                isLoading={roomsQuery.isLoading || roomsQuery.isFetchingNextPage}
                isError={roomsQuery.isError}
                hasMore={roomsQuery.hasNextPage ?? false}
                onLoadMore={() => roomsQuery.fetchNextPage()}
                onRetry={() => roomsQuery.refetch()}
                query={debouncedQuery}
              />
            )}

            {activeTab === 'messages' && (
              <MessageSearchResults
                results={messageResults}
                isLoading={messagesQuery.isLoading || messagesQuery.isFetchingNextPage}
                isError={messagesQuery.isError}
                hasMore={messagesQuery.hasNextPage ?? false}
                onLoadMore={() => messagesQuery.fetchNextPage()}
                onRetry={() => messagesQuery.refetch()}
                onMessagePress={handleMessagePress}
                query={debouncedQuery}
                roomId={messageSearchRoomId}
              />
            )}

            {activeTab === 'users' && (
              <UserSearchResults
                results={userResults}
                isLoading={usersQuery.isLoading || usersQuery.isFetchingNextPage}
                isError={usersQuery.isError}
                hasMore={usersQuery.hasNextPage ?? false}
                onLoadMore={() => usersQuery.fetchNextPage()}
                onRetry={() => usersQuery.refetch()}
                onUserPress={handleUserPress}
                query={debouncedQuery}
              />
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.light,
  },
  content: {
    flex: 1,
  },
});

export default SearchScreen;
