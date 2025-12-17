/**
 * Search screen types and interfaces
 */

export type SearchTab = 'rooms' | 'messages' | 'users';

export interface HighlightSegment {
  text: string;
  isMatch: boolean;
}

export interface RoomSearchResult {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  tags: string[];
  memberCount: number;
  isPublic: boolean;
  createdAt: Date;
  lastActivityAt: Date;
  highlight: {
    name?: string;
    description?: string;
  };
  creator: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
}

export interface MessageSearchResult {
  id: string;
  content: string;
  contentType: string;
  createdAt: Date;
  isEdited: boolean;
  highlight: {
    content: string;
  };
  sender: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

export interface UserSearchResult {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  isVerified: boolean;
  highlight: {
    username?: string;
    displayName?: string;
  };
}

export interface SearchResponse<T> {
  results: T[];
  cursor: string | null;
  total: number;
}

export interface RecentSearch {
  query: string;
  timestamp: number;
  tab: SearchTab;
}
