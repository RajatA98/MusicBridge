// MusicBridge — root layout.
// Initializes Sentry, wraps the tree in AuthProvider.

import '../global.css';

import { useEffect } from 'react';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../lib/auth-context';
import { initSentry } from '../lib/sentry';

export default function RootLayout() {
  useEffect(() => {
    initSentry();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="auto" />
          <Slot />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
