// MusicBridge — login screen.
// Email + password sign-in. New users go to /signup.

import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Link, router } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { captureError } from '../lib/sentry';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace('/');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign-in failed.';
      setError(msg);
      captureError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="flex-1 items-center justify-center bg-surface px-6">
      <View className="mx-auto w-full max-w-md">
        <Text className="mb-2 text-3xl font-bold text-ink">MusicBridge</Text>
        <Text className="mb-8 text-base text-ink-soft">Sign in to your account.</Text>

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

        <Text className="mb-1 text-xs uppercase tracking-wider text-ink-muted">Password</Text>
        <TextInput
          className="mb-6 rounded-md border border-surface-muted bg-white px-3 py-3 text-base text-ink"
          autoCapitalize="none"
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor="#9ca3af"
        />

        {error ? <Text className="mb-4 text-sm text-red-600">{error}</Text> : null}

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onSubmit}
          className={`mb-4 rounded-md ${busy ? 'bg-ink-muted' : 'bg-accent'} px-4 py-3 active:opacity-80`}
        >
          <Text className="text-center text-base font-semibold text-white">
            {busy ? 'Signing in…' : 'Sign in'}
          </Text>
        </Pressable>

        <View className="flex-row items-center justify-center">
          <Text className="text-sm text-ink-muted">No account? </Text>
          <Link href="/signup" className="text-sm font-semibold text-accent">
            Create one
          </Link>
        </View>
      </View>
    </View>
  );
}
