// MusicBridge — last-N MIDI notes display.
// Per DECISIONS.md D1.4: passive display only, neutral coloring (no tonality coloring in v1).

import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Platform } from 'react-native';
import { requestMidi, noteName, type MidiDevice, type MidiNote } from '../lib/midi';

const MAX_NOTES = 4;

export function MidiNoteStrip() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [devices, setDevices] = useState<MidiDevice[]>([]);
  const [activeDevice, setActiveDevice] = useState<string | null>(null);
  const [recent, setRecent] = useState<MidiNote[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setError(null);
    const session = await requestMidi();
    if (!session) {
      setAvailable(false);
      return;
    }
    setAvailable(true);
    setDevices(session.devices);
    if (session.devices.length > 0) {
      setActiveDevice(session.devices[0]?.name ?? null);
    }
    session.onNote((note) => {
      setRecent((prev) => {
        const next = [...prev, note];
        return next.slice(-MAX_NOTES);
      });
    });
  }

  useEffect(() => {
    return () => {
      // Best-effort cleanup; the underlying session listeners are released by the adapter.
    };
  }, []);

  if (available === false) {
    const isIosSafari = Platform.OS === 'web' && /iPhone|iPad/.test(navigator?.userAgent ?? '');
    return (
      <View className="rounded-md bg-surface-subtle p-3">
        <Text className="text-xs text-ink-muted">
          {isIosSafari
            ? 'MIDI is not available on iOS Safari. Use the iOS app for MIDI keyboard support.'
            : 'MIDI is not available on this browser. Try Chrome or Edge desktop, or the iOS app.'}
        </Text>
      </View>
    );
  }

  if (available === null) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={connect}
        className="rounded-md border border-surface-muted bg-white px-3 py-3 active:opacity-80"
      >
        <Text className="text-center text-base text-ink">🎹 Connect MIDI keyboard (optional)</Text>
      </Pressable>
    );
  }

  return (
    <View className="rounded-md bg-surface-subtle p-3">
      {error ? <Text className="mb-2 text-sm text-red-600">{error}</Text> : null}
      <Text className="mb-1 text-xs uppercase tracking-wider text-ink-muted">
        {activeDevice ? `Listening to ${activeDevice}` : 'Listening for MIDI…'}
      </Text>
      <View className="mt-1 flex-row items-center gap-2">
        {recent.length === 0 ? (
          <Text className="text-sm text-ink-muted">Play a note to confirm.</Text>
        ) : (
          recent.map((n, i) => (
            <View
              key={`${n.timestamp}-${i}`}
              className="rounded-md bg-white px-2 py-1"
            >
              <Text className="font-mono text-base text-ink">{noteName(n.note)}</Text>
            </View>
          ))
        )}
      </View>
      {devices.length > 1 ? (
        <Text className="mt-2 text-xs text-ink-muted">
          Multiple MIDI inputs detected; first one is active.
        </Text>
      ) : null}
    </View>
  );
}
