// MusicBridge — Per-student view (Phase 4).
// Lists assignments and lets the teacher add a new one inline.

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../lib/auth-context';
import {
  ASSIGNMENT_MAX_WORDS,
  ASSIGNMENT_MIN_WORDS,
  countWords,
  createAssignment,
  deleteAssignment,
  subscribeTeacherStudentAssignments,
  type AssignmentRecord,
} from '../../../lib/assignments';
import { captureError } from '../../../lib/sentry';
import type { UserDoc } from '../../../lib/types';

const PLACEHOLDER =
  'e.g., "Practice C major scale, hands separate, 60 bpm. Focus on smooth thumb-under in measure 2."';

export default function StudentDetail() {
  const { user } = useAuth();
  const { id: studentId } = useLocalSearchParams<{ id: string }>();
  const [studentEmail, setStudentEmail] = useState<string | null>(null);
  const [records, setRecords] = useState<AssignmentRecord[] | null>(null);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', studentId));
        if (cancelled) return;
        setStudentEmail(snap.exists() ? (snap.data() as UserDoc).email : null);
      } catch (e) {
        captureError(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  useEffect(() => {
    if (!user || !studentId) return;
    const unsub = subscribeTeacherStudentAssignments(user.uid, studentId, setRecords);
    return unsub;
  }, [user, studentId]);

  async function onCreate() {
    if (!studentId) return;
    setError(null);
    setBusy(true);
    try {
      await createAssignment({ studentId, body });
      setBody('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not create assignment.';
      setError(msg);
      captureError(e);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    setError(null);
    try {
      await deleteAssignment(id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not delete assignment.';
      setError(msg);
      captureError(e);
    }
  }

  const wc = countWords(body);
  const wordsValid = wc >= ASSIGNMENT_MIN_WORDS && wc <= ASSIGNMENT_MAX_WORDS;

  return (
    <View className="flex-1 bg-surface px-6 pt-12">
      <Pressable
        accessibilityRole="button"
        onPress={() => router.replace('/teacher')}
        className="mb-3 self-start"
      >
        <Text className="text-sm text-accent">← Back to dashboard</Text>
      </Pressable>

      <Text className="mb-1 text-3xl font-bold text-ink">{studentEmail ?? 'Student'}</Text>
      <Text className="mb-6 text-sm text-ink-muted">Assign practice and review history.</Text>

      <View className="mb-6 rounded-md bg-surface-subtle p-4">
        <Text className="mb-2 text-xs uppercase tracking-wider text-ink-muted">
          New assignment ({ASSIGNMENT_MIN_WORDS}–{ASSIGNMENT_MAX_WORDS} words)
        </Text>
        <TextInput
          className="mb-2 min-h-[120px] rounded-md border border-surface-muted bg-white px-3 py-3 text-base text-ink"
          multiline
          textAlignVertical="top"
          value={body}
          onChangeText={setBody}
          placeholder={PLACEHOLDER}
          placeholderTextColor="#9ca3af"
        />
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-xs text-ink-muted">{wc} words</Text>
          {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={!wordsValid || busy}
          onPress={onCreate}
          className={`rounded-md ${
            !wordsValid || busy ? 'bg-ink-muted' : 'bg-accent'
          } px-4 py-3 active:opacity-80`}
        >
          <Text className="text-center text-base font-semibold text-white">
            {busy ? 'Creating…' : 'Assign practice'}
          </Text>
        </Pressable>
      </View>

      <Text className="mb-3 text-xl font-semibold text-ink">History</Text>

      {records === null ? (
        <ActivityIndicator />
      ) : records.length === 0 ? (
        <Text className="text-sm text-ink-muted">No assignments yet.</Text>
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View className="mb-2 rounded-md bg-surface-subtle p-4">
              <View className="mb-2 flex-row items-center justify-between">
                <StatusPill status={item.status} />
                {item.status === 'new' && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => onDelete(item.id)}
                    className="rounded-md border border-surface-muted px-2 py-1"
                  >
                    <Text className="text-xs text-ink-soft">Delete</Text>
                  </Pressable>
                )}
              </View>
              <Text className="text-base text-ink" numberOfLines={3}>
                {item.body}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

function StatusPill({ status }: { status: 'new' | 'in_progress' | 'completed' }) {
  const styles =
    status === 'completed'
      ? 'bg-accent-soft text-accent'
      : status === 'in_progress'
        ? 'bg-yellow-100 text-yellow-900'
        : 'bg-surface-muted text-ink-soft';
  const label = status === 'in_progress' ? 'in progress' : status;
  return (
    <View className={`self-start rounded-full px-2 py-0.5 ${styles}`}>
      <Text className={`text-xs font-medium uppercase tracking-wide ${styles}`}>{label}</Text>
    </View>
  );
}
