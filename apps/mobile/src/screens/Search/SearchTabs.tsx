import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '@socio/ui';
import type { SearchTab } from './types';

export interface SearchTabsProps {
  activeTab: SearchTab;
  onTabChange: (tab: SearchTab) => void;
  roomsCount?: number;
  messagesCount?: number;
  usersCount?: number;
}

interface TabConfig {
  key: SearchTab;
  label: string;
  count?: number;
}

/**
 * Tab switcher component for Rooms/Messages/Users
 */
export function SearchTabs({
  activeTab,
  onTabChange,
  roomsCount,
  messagesCount,
  usersCount,
}: SearchTabsProps): React.JSX.Element {
  const tabs: TabConfig[] = [
    { key: 'rooms', label: 'Rooms', count: roomsCount },
    { key: 'messages', label: 'Messages', count: messagesCount },
    { key: 'users', label: 'Users', count: usersCount },
  ];

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, isActive && styles.activeTab]}
            onPress={() => onTabChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`${tab.label} tab${tab.count !== undefined ? `, ${tab.count} results` : ''}`}
          >
            <Text style={[styles.tabText, isActive && styles.activeTabText]}>
              {tab.label}
            </Text>
            {tab.count !== undefined && tab.count > 0 && (
              <View style={[styles.badge, isActive && styles.activeBadge]}>
                <Text style={[styles.badgeText, isActive && styles.activeBadgeText]}>
                  {tab.count > 99 ? '99+' : tab.count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surface.light,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant.light,
    paddingHorizontal: spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: spacing.xs,
  },
  activeTab: {
    borderBottomColor: colors.primary.light,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.onSurfaceVariant.light,
  },
  activeTabText: {
    color: colors.primary.light,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: colors.surfaceContainerHigh.light,
    borderRadius: radius.full,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  activeBadge: {
    backgroundColor: colors.primaryContainer.light,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant.light,
  },
  activeBadgeText: {
    color: colors.primary.light,
  },
});

export default SearchTabs;
