// MusicBridge — student dashboard (Phase 4).
// Lists assignments. Phase 5 will let you tap one to start the guided session.

import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useAuth } from '../../lib/auth-context';
import {
  subscribeStudentAssignments,
  type AssignmentRecord,
} from '../../lib/assignments';

export default function StudentDashboard() {
  const { user, userDoc } = useAuth();
  const [records, setRecords] = useState<AssignmentRecord[] | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeStudentAssignments(user.uid, setRecords);
    return unsub;
  }, [user]);

  return (
    <View className="flex-1 bg-surface">
      <View className="mx-auto w-full max-w-3xl flex-1 px-6 pt-12">
      <View className="mb-8 flex-row items-start justify-between">
        <View>
          <Text className="text-3xl font-bold text-ink">Practice</Text>
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

      {!userDoc?.teacherId ? (
        <View className="rounded-lg bg-surface-subtle p-6">
          <Text className="text-base text-ink-soft">
            You&apos;re not paired with a teacher yet. Open the invite link your teacher sent you.
          </Text>
        </View>
      ) : records === null ? (
        <ActivityIndicator />
      ) : records.length === 0 ? (
        <View className="rounded-lg bg-surface-subtle p-6">
          <Text className="text-base text-ink-soft">
            No assignments yet. Your teacher will send some soon.
          </Text>
        </View>
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Link href={`/student/session/${item.id}` as never} asChild>
              <Pressable className="mb-3 rounded-lg bg-surface-subtle p-4 active:opacity-80">
                <View className="mb-2 flex-row items-center justify-between">
                  <StatusPill status={item.status} />
                  <Text className="text-xs text-ink-muted">
                    {item.createdAt
                      ? new Date(item.createdAt.seconds * 1000).toLocaleDateString()
                      : ''}
                  </Text>
                </View>
                <Text className="text-base text-ink" numberOfLines={3}>
                  {item.body}
                </Text>
                <Text className="mt-2 text-sm font-semibold text-accent">
                  {item.status === 'completed' ? 'Practice again →' : 'Start practice →'}
                </Text>
              </Pressable>
            </Link>
          )}
        />
      )}
      </View>
    </View>
  );
}

function StatusPill({ status }: { status: 'new' | 'in_progress' | 'completed' }) {
  const cls =
    status === 'completed'
      ? 'bg-accent-soft'
      : status === 'in_progress'
        ? 'bg-yellow-100'
        : 'bg-surface-muted';
  const label = status === 'in_progress' ? 'in progress' : status;
  return (
    <View className={`self-start rounded-full px-2 py-0.5 ${cls}`}>
      <Text className="text-xs font-medium uppercase tracking-wide text-ink-soft">{label}</Text>
    </View>
  );
}
