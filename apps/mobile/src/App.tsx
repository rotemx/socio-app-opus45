import React from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { QueryProvider } from './providers';
import { RootNavigator } from './navigation';
import { useAuthInit } from './hooks';

// Import NativeWind styles
import '../global.css';

/**
 * App content component that initializes auth and renders navigation
 */
function AppContent(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  // Initialize auth from secure storage
  useAuthInit();

  return (
    <NavigationContainer>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={isDarkMode ? '#000000' : '#ffffff'}
      />
      <RootNavigator />
    </NavigationContainer>
  );
}

/**
 * Main application component
 * Sets up all providers and navigation
 */
function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <QueryProvider>
        <AppContent />
      </QueryProvider>
    </SafeAreaProvider>
  );
}

export default App;
