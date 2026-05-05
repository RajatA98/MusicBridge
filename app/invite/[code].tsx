// MusicBridge — Invite landing (Phase 3).
// Tapping an invite URL lands here. We validate the code, then route to /signup with the
// teacherId and role pre-filled.
//
// On iOS this opens via Universal Link if the app is installed; otherwise it opens in the
// browser. The route works for both — the invite code is read from the URL and signup proceeds.

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { lookupInvite } from '../../lib/invites';

export default function InviteLanding() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const [state, setState] = useState<'loading' | 'valid' | 'invalid'>('loading');
  const [teacherId, setTeacherId] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      setState('invalid');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const invite = await lookupInvite(code);
        if (cancelled) return;
        if (!invite) {
          setState('invalid');
          return;
        }
        setTeacherId(invite.teacherId);
        setState('valid');
      } catch {
        if (!cancelled) setState('invalid');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  function continueToSignup() {
    router.replace({
      pathname: '/signup',
      params: { invite: code, teacherId: teacherId ?? '', role: 'student' },
    });
  }

  if (state === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator />
      </View>
    );
  }

  if (state === 'invalid') {
    return (
      <View className="flex-1 items-center justify-center bg-surface px-6">
        <View className="w-full max-w-sm">
          <Text className="mb-2 text-3xl font-bold text-ink">Invite not found</Text>
          <Text className="mb-6 text-base text-ink-soft">
            This link may be expired or revoked. Ask your teacher to send you a fresh invite.
          </Text>
          <Link href="/login" className="text-base font-semibold text-accent">
            Go to sign in
          </Link>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center bg-surface px-6">
      <View className="w-full max-w-sm">
        <Text className="mb-2 text-3xl font-bold text-ink">Welcome to MusicBridge</Text>
        <Text className="mb-6 text-base text-ink-soft">
          Your teacher invited you. Sign up to start practicing together.
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={continueToSignup}
          className="mb-3 rounded-md bg-accent px-4 py-3 active:opacity-80"
        >
          <Text className="text-center text-base font-semibold text-white">Continue to signup</Text>
        </Pressable>

        <Link href="/login" className="text-center text-sm text-ink-muted">
          Already have an account? Sign in
        </Link>
      </View>
    </View>
  );
}
