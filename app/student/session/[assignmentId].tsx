// MusicBridge — Guided session screen (Phase 5).
// Per DECISIONS.md D1.1, D1.6, FR-G1..G7.

import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { synthesize, stop as stopSpeech } from '../../../lib/tts';
import {
  startSession,
  markStepDone,
  completeSession,
  type SessionWithSteps,
} from '../../../lib/sessions';
import type { AssignmentDoc } from '../../../lib/types';
import { captureError } from '../../../lib/sentry';
import { MidiNoteStrip } from '../../../components/MidiNoteStrip';

type ViewState =
  | { kind: 'landing'; assignment: AssignmentDoc }
  | { kind: 'loading-assignment' }
  | { kind: 'starting' }
  | { kind: 'running'; assignment: AssignmentDoc; session: SessionWithSteps; stepIndex: number }
  | { kind: 'complete' }
  | { kind: 'error'; message: string };

export default function GuidedSession() {
  const { assignmentId } = useLocalSearchParams<{ assignmentId: string }>();
  const [state, setState] = useState<ViewState>({ kind: 'loading-assignment' });

  useEffect(() => {
    if (!assignmentId) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'assignments', assignmentId));
        if (cancelled) return;
        if (!snap.exists()) {
          setState({ kind: 'error', message: 'Assignment not found.' });
          return;
        }
        setState({ kind: 'landing', assignment: snap.data() as AssignmentDoc });
      } catch (e) {
        captureError(e);
        if (!cancelled) setState({ kind: 'error', message: 'Could not load assignment.' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assignmentId]);

  // Stop TTS when leaving the screen.
  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, []);

  if (state.kind === 'loading-assignment' || state.kind === 'starting') {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator />
        <Text className="mt-3 text-sm text-ink-muted">
          {state.kind === 'starting' ? 'Setting up your session…' : ''}
        </Text>
      </View>
    );
  }

  if (state.kind === 'error') {
    return (
      <View className="flex-1 items-center justify-center bg-surface px-6">
        <Text className="mb-2 text-2xl font-bold text-ink">Something went wrong</Text>
        <Text className="mb-6 text-base text-ink-soft">{state.message}</Text>
        <Pressable
          onPress={() => router.replace('/student')}
          className="rounded-md bg-accent px-4 py-3 active:opacity-80"
        >
          <Text className="font-semibold text-white">Back to dashboard</Text>
        </Pressable>
      </View>
    );
  }

  if (state.kind === 'landing') {
    return (
      <Landing
        assignment={state.assignment}
        onStart={async () => {
          if (!assignmentId) return;
          setState({ kind: 'starting' });
          try {
            const session = await startSession(assignmentId);
            setState({
              kind: 'running',
              assignment: state.assignment,
              session,
              stepIndex: 0,
            });
          } catch (e) {
            captureError(e);
            setState({ kind: 'error', message: 'Could not start session.' });
          }
        }}
      />
    );
  }

  if (state.kind === 'complete') {
    return <Complete onDone={() => router.replace('/student')} />;
  }

  return (
    <Running
      session={state.session}
      assignmentBody={state.assignment.body}
      stepIndex={state.stepIndex}
      onAdvance={async () => {
        const next = state.stepIndex + 1;
        if (state.session.fallback || next >= state.session.steps.length) {
          // Final step (or fallback path with no steps).
          if (assignmentId) {
            try {
              await completeSession(state.session.id, assignmentId);
            } catch (e) {
              captureError(e);
            }
          }
          setState({ kind: 'complete' });
        } else {
          await markStepDone(state.session.id, state.stepIndex);
          setState({ ...state, stepIndex: next });
        }
      }}
    />
  );
}

function Landing({ assignment, onStart }: { assignment: AssignmentDoc; onStart: () => void }) {
  return (
    <ScrollView className="flex-1 bg-surface" contentContainerClassName="mx-auto w-full max-w-3xl px-6 pt-12 pb-12">
      <Pressable onPress={() => router.replace('/student')} className="mb-3 self-start">
        <Text className="text-sm text-accent">← Back</Text>
      </Pressable>
      <Text className="mb-2 text-3xl font-bold text-ink">Practice with your teacher</Text>
      <Text className="mb-6 text-sm text-ink-muted">
        Read what your teacher asked, then start the guided session.
      </Text>

      <View className="mb-8 rounded-md border-l-4 border-accent bg-surface-subtle p-4">
        <Text className="text-base leading-relaxed text-ink">{assignment.body}</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onStart}
        className="mb-6 rounded-md bg-accent px-4 py-4 active:opacity-80"
      >
        <Text className="text-center text-base font-semibold text-white">Start</Text>
      </Pressable>

      <MidiNoteStrip />
    </ScrollView>
  );
}

function Running({
  session,
  assignmentBody,
  stepIndex,
  onAdvance,
}: {
  session: SessionWithSteps;
  assignmentBody: string;
  stepIndex: number;
  onAdvance: () => void;
}) {
  const lastSpokenRef = useRef<string | null>(null);

  const stepText: string = session.fallback
    ? assignmentBody
    : (session.steps[stepIndex]?.text ?? '');

  // Auto-play TTS on first display of each step (D1.6).
  useEffect(() => {
    if (!stepText) return;
    if (lastSpokenRef.current === stepText) return;
    lastSpokenRef.current = stepText;
    void synthesize({ text: stepText });
    return () => {
      stopSpeech();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepText]);

  function replay() {
    stopSpeech();
    void synthesize({ text: stepText });
  }

  if (session.fallback) {
    return (
      <ScrollView className="flex-1 bg-surface" contentContainerClassName="mx-auto w-full max-w-3xl px-6 pt-12 pb-12">
        <Text className="mb-2 text-3xl font-bold text-ink">Today&apos;s practice</Text>
        <View className="my-6 rounded-md border-l-4 border-accent bg-surface-subtle p-4">
          <Text className="text-base leading-relaxed text-ink">{assignmentBody}</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={replay}
          className="mb-3 rounded-md border border-surface-muted bg-white px-4 py-3 active:opacity-80"
        >
          <Text className="text-center text-base text-ink">↻ Replay</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={onAdvance}
          className="rounded-md bg-accent px-4 py-4 active:opacity-80"
        >
          <Text className="text-center text-base font-semibold text-white">Mark complete</Text>
        </Pressable>
      </ScrollView>
    );
  }

  const total = session.steps.length;
  const dots = new Array(total).fill(0).map((_, i) => i);

  return (
    <ScrollView className="flex-1 bg-surface" contentContainerClassName="mx-auto w-full max-w-3xl px-6 pt-12 pb-12">
      <View className="mb-8 flex-row items-center justify-center gap-2">
        {dots.map((i) => (
          <View
            key={i}
            className={`h-2 w-2 rounded-full ${i <= stepIndex ? 'bg-accent' : 'bg-surface-muted'}`}
          />
        ))}
      </View>

      <Text className="mb-2 text-xs uppercase tracking-wider text-ink-muted">
        Step {stepIndex + 1} of {total}
      </Text>
      <Text className="mb-8 text-2xl font-semibold leading-snug text-ink">{stepText}</Text>

      <Pressable
        accessibilityRole="button"
        onPress={replay}
        className="mb-3 rounded-md border border-surface-muted bg-white px-4 py-3 active:opacity-80"
      >
        <Text className="text-center text-base text-ink">↻ Replay</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={onAdvance}
        className="mb-6 rounded-md bg-accent px-4 py-4 active:opacity-80"
      >
        <Text className="text-center text-base font-semibold text-white">
          {stepIndex + 1 === total ? 'Finish' : 'Done with this step'}
        </Text>
      </Pressable>

      <MidiNoteStrip />
    </ScrollView>
  );
}

function Complete({ onDone }: { onDone: () => void }) {
  return (
    <View className="flex-1 items-center justify-center bg-surface px-6">
      <View className="w-full max-w-sm">
        <Text className="mb-2 text-3xl font-bold text-ink">Session complete</Text>
        <Text className="mb-8 text-base text-ink-soft">
          Your teacher will see this when you next see them.
        </Text>
        <Pressable
          onPress={onDone}
          className="rounded-md bg-accent px-4 py-4 active:opacity-80"
        >
          <Text className="text-center text-base font-semibold text-white">Back to home</Text>
        </Pressable>
      </View>
    </View>
  );
}
