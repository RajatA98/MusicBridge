// MusicBridge — Invite generation screen (Phase 3).
// Teacher attests the student is 13+ (or school-authorized) per D2.14.

import { useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { createInvite } from '../../lib/invites';
import type { AttestationKind } from '../../lib/types';
import { captureError } from '../../lib/sentry';

export default function GenerateInvite() {
  const [studentEmail, setStudentEmail] = useState('');
  const [attestation, setAttestation] = useState<AttestationKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ url: string; code: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onGenerate() {
    if (!attestation) return;
    setError(null);
    setBusy(true);
    try {
      const { url, code } = await createInvite({ studentEmail, attestation });
      setResult({ url, code });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not create invite.';
      setError(msg);
      captureError(e);
    } finally {
      setBusy(false);
    }
  }

  async function copyUrl() {
    if (!result) return;
    await Clipboard.setStringAsync(result.url);
  }

  if (result) {
    return (
      <View className="flex-1 bg-surface">
        <View className="mx-auto w-full max-w-md flex-1 px-6 pt-12">
        <Text className="mb-2 text-3xl font-bold text-ink">Invite ready</Text>
        <Text className="mb-6 text-base text-ink-soft">
          Share this link with your student. They&apos;ll be paired with you when they sign up.
        </Text>

        <View className="mb-4 rounded-md bg-surface-subtle p-4">
          <Text className="mb-1 text-xs uppercase tracking-wider text-ink-muted">Invite link</Text>
          <Text className="break-all text-base text-ink" selectable>
            {result.url}
          </Text>
        </View>

        <View className="mb-6 rounded-md bg-surface-subtle p-4">
          <Text className="mb-1 text-xs uppercase tracking-wider text-ink-muted">Code</Text>
          <Text className="font-mono text-2xl text-ink" selectable>
            {result.code}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={copyUrl}
          className="mb-3 rounded-md bg-accent px-4 py-3 active:opacity-80"
        >
          <Text className="text-center text-base font-semibold text-white">Copy link</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/teacher')}
          className="rounded-md border border-surface-muted px-4 py-3"
        >
          <Text className="text-center text-base text-ink">Back to dashboard</Text>
        </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      <View className="mx-auto w-full max-w-md flex-1 px-6 pt-12">
      <Text className="mb-2 text-3xl font-bold text-ink">New invite</Text>
      <Text className="mb-6 text-base text-ink-soft">
        Send a unique invite link to one of your students. Each invite is single-use; regenerate
        anytime.
      </Text>

      <Text className="mb-1 text-xs uppercase tracking-wider text-ink-muted">Student email</Text>
      <TextInput
        className="mb-6 rounded-md border border-surface-muted bg-white px-3 py-3 text-base text-ink"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        value={studentEmail}
        onChangeText={setStudentEmail}
        placeholder="student@example.com"
        placeholderTextColor="#9ca3af"
      />

      <Text className="mb-2 text-xs uppercase tracking-wider text-ink-muted">
        Age attestation (required)
      </Text>
      <Text className="mb-3 text-sm text-ink-soft">
        MusicBridge requires students to be 13+ in v1. Pick the basis for your attestation.
      </Text>

      <AttestationOption
        active={attestation === 'self-attested-13+'}
        onPress={() => setAttestation('self-attested-13+')}
        label="I confirm this student is 13 or older."
      />
      <AttestationOption
        active={attestation === 'school-authorized'}
        onPress={() => setAttestation('school-authorized')}
        label="School-authorized: covered by a school's signed agreement."
      />

      {error ? <Text className="my-3 text-sm text-red-600">{error}</Text> : null}

      <Pressable
        accessibilityRole="button"
        disabled={busy || !attestation || !studentEmail.includes('@')}
        onPress={onGenerate}
        className={`mt-6 mb-3 rounded-md ${
          busy || !attestation || !studentEmail.includes('@') ? 'bg-ink-muted' : 'bg-accent'
        } px-4 py-3 active:opacity-80`}
      >
        <Text className="text-center text-base font-semibold text-white">
          {busy ? 'Generating…' : 'Generate invite'}
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.replace('/teacher')}
        className="rounded-md border border-surface-muted px-4 py-3"
      >
        <Text className="text-center text-base text-ink">Cancel</Text>
      </Pressable>
      </View>
    </View>
  );
}

function AttestationOption({
  active,
  onPress,
  label,
}: {
  active: boolean;
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      className={`mb-2 rounded-md border ${
        active ? 'border-accent bg-accent-soft' : 'border-surface-muted bg-white'
      } px-4 py-3`}
    >
      <Text className={`text-base ${active ? 'text-accent' : 'text-ink'}`}>{label}</Text>
    </Pressable>
  );
}
