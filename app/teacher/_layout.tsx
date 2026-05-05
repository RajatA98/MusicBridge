// MusicBridge — teacher layout.
// Gate: only teachers can be in here.

import { Redirect, Slot } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../../lib/auth-context';

export default function TeacherLayout() {
  const { loading, user, userDoc } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator />
      </View>
    );
  }

  if (!user) return <Redirect href="/login" />;
  if (userDoc?.role !== 'teacher') return <Redirect href="/" />;

  return <Slot />;
}
