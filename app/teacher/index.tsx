// MusicBridge — teacher dashboard (Phase 3).
// Lists paired students, links to invite generation.
// Phase 4 adds per-student assignment management.

import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useAuth } from '../../lib/auth-context';
import { listPairedStudents } from '../../lib/invites';
import { captureError } from '../../lib/sentry';

interface PairedStudent {
  uid: string;
  email: string;
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [students, setStudents] = useState<PairedStudent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await listPairedStudents(user.uid);
        if (!cancelled) setStudents(list);
      } catch (e) {
        if (!cancelled) {
          setError('Could not load students.');
          captureError(e);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <View className="flex-1 bg-surface px-6 pt-12">
      <View className="mb-8 flex-row items-start justify-between">
        <View>
          <Text className="text-3xl font-bold text-ink">Teacher</Text>
          <Text className="text-sm text-ink-muted">{user?.email}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={async () => {
            await signOut(auth);
            router.replace('/login');
          }}
          className="rounded-md border border-surface-muted px-3 py-2"
        >
          <Text className="text-sm text-ink">Sign out</Text>
        </Pressable>
      </View>

      <View className="mb-6 flex-row items-center justify-between">
        <Text className="text-xl font-semibold text-ink">Paired students</Text>
        <Link href="/teacher/invite" asChild>
          <Pressable className="rounded-md bg-accent px-3 py-2 active:opacity-80">
            <Text className="text-sm font-semibold text-white">+ Invite</Text>
          </Pressable>
        </Link>
      </View>

      {error ? <Text className="mb-4 text-sm text-red-600">{error}</Text> : null}

      {students === null ? (
        <ActivityIndicator />
      ) : students.length === 0 ? (
        <View className="rounded-lg bg-surface-subtle p-6">
          <Text className="text-base text-ink-soft">
            No paired students yet. Tap &ldquo;+ Invite&rdquo; to create your first invite link.
          </Text>
        </View>
      ) : (
        <FlatList
          data={students}
          keyExtractor={(item) => item.uid}
          renderItem={({ item }) => (
            <Link href={`/teacher/student/${item.uid}` as never} asChild>
              <Pressable className="mb-2 rounded-md bg-surface-subtle p-4 active:opacity-80">
                <Text className="text-base text-ink">{item.email}</Text>
                <Text className="text-xs text-ink-muted">Tap to view assignments</Text>
              </Pressable>
            </Link>
          )}
        />
      )}
    </View>
  );
}
