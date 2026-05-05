// MusicBridge — root route.
// Routes the user based on auth + role state.

import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../lib/auth-context';

export default function Index() {
  const { loading, user, userDoc } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  if (!userDoc) {
    // Auth user exists but no Firestore profile — partial signup or stale state.
    return <Redirect href="/login" />;
  }

  if (userDoc.role === 'teacher') {
    return <Redirect href="/teacher" />;
  }

  return <Redirect href="/student" />;
}
