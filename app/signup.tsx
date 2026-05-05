// MusicBridge — signup screen (Phase 2).
// Real flow: pick role, enter email + password, create Auth user + /users doc atomically-ish.
// Phase 3 will read `?invite=` to pre-pair students with their teacher.

import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { signup } from '../lib/signup';
import type { Role } from '../lib/types';
import { captureError } from '../lib/sentry';

type Mode = 'pick-role' | 'enter-credentials';

export default function Signup() {
  const params = useLocalSearchParams<{ invite?: string; teacherId?: string; role?: string }>();

  // If the URL came from an invite, force role=student (Phase 3 wires this).
  const initialRole: Role | null =
    params.role === 'teacher' || params.role === 'student' ? params.role : null;
  const initialMode: Mode = initialRole ? 'enter-credentials' : 'pick-role';

  const [mode, setMode] = useState<Mode>(initialMode);
  const [role, setRole] = useState<Role | null>(initialRole);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickRole(r: Role) {
    setRole(r);
    setMode('enter-credentials');
  }

  async function onSubmit() {
    if (!role) return;
    setError(null);
    setBusy(true);
    try {
      await signup({
        email,
        password,
        role,
        teacherId: role === 'student' ? params.teacherId ?? null : null,
      });
      router.replace('/');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Signup failed.';
      setError(msg);
      captureError(e);
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'pick-role') {
    return (
      <View className="flex-1 items-center justify-center bg-surface px-6">
        <View className="w-full max-w-sm">
          <Text className="mb-2 text-3xl font-bold text-ink">Create account</Text>
          <Text className="mb-8 text-base text-ink-soft">
            {params.invite ? 'Joining via teacher invite.' : 'Pick your role to get started.'}
          </Text>

          <Pressable
            accessibilityRole="button"
            className="mb-3 rounded-md bg-accent px-4 py-3 active:opacity-80"
            onPress={() => pickRole('teacher')}
          >
            <Text className="text-center text-base font-semibold text-white">
              I&apos;m a teacher
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            className="mb-6 rounded-md bg-ink px-4 py-3 active:opacity-80"
            onPress={() => pickRole('student')}
          >
            <Text className="text-center text-base font-semibold text-white">
              I&apos;m a student
            </Text>
          </Pressable>

          <View className="flex-row items-center justify-center">
            <Text className="text-sm text-ink-muted">Have an account? </Text>
            <Link href="/login" className="text-sm font-semibold text-accent">
              Sign in
            </Link>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center bg-surface px-6">
      <View className="w-full max-w-sm">
        <Text className="mb-2 text-3xl font-bold text-ink">
          {role === 'teacher' ? 'Teacher signup' : 'Student signup'}
        </Text>
        <Text className="mb-6 text-base text-ink-soft">
          {role === 'student' && params.teacherId
            ? "You'll be paired with your teacher when you finish signing up."
            : 'Create your account.'}
        </Text>

        <Text className="mb-1 text-xs uppercase tracking-wider text-ink-muted">Email</Text>
        <TextInput
          className="mb-4 rounded-md border border-surface-muted bg-white px-3 py-3 text-base text-ink"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor="#9ca3af"
        />

        <Text className="mb-1 text-xs uppercase tracking-wider text-ink-muted">
          Password (8+ chars)
        </Text>
        <TextInput
          className="mb-6 rounded-md border border-surface-muted bg-white px-3 py-3 text-base text-ink"
          autoCapitalize="none"
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor="#9ca3af"
        />

        {error ? <Text className="mb-4 text-sm text-red-600">{error}</Text> : null}

        <Pressable
          accessibilityRole="button"
          disabled={busy || password.length < 8 || !email.includes('@')}
          onPress={onSubmit}
          className={`mb-3 rounded-md ${
            busy || password.length < 8 || !email.includes('@') ? 'bg-ink-muted' : 'bg-accent'
          } px-4 py-3 active:opacity-80`}
        >
          <Text className="text-center text-base font-semibold text-white">
            {busy ? 'Creating account…' : 'Create account'}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => setMode('pick-role')}
          className="mb-4 rounded-md border border-surface-muted px-4 py-3"
        >
          <Text className="text-center text-base text-ink">Back</Text>
        </Pressable>

        <View className="flex-row items-center justify-center">
          <Text className="text-sm text-ink-muted">Have an account? </Text>
          <Link href="/login" className="text-sm font-semibold text-accent">
            Sign in
          </Link>
        </View>
      </View>
    </View>
  );
}
