// MusicBridge — MIDI adapter.
//
// Locked per DECISIONS.md D2.9, D1.4:
//   v1: @motiz88/react-native-midi (vendored), passive display only.
//   On iOS native, taps Core MIDI through the package's Expo Module.
//   On web, react-native-web passes through to the browser's Web MIDI API where available
//   (Chrome/Edge desktop, Android Chrome). On unsupported browsers (iOS Safari, Firefox),
//   `requestMIDIAccess` rejects — the caller must handle this.

// The package is vendored under /vendor/react-native-midi at install time.
// We import lazily so a build without MIDI installed still bundles cleanly for first-run dev.

export interface MidiNote {
  /** MIDI note number 0-127. Middle C = 60. */
  note: number;
  /** Velocity 0-127. */
  velocity: number;
  /** Performance.now() timestamp at receipt. */
  timestamp: number;
}

export interface MidiDevice {
  id: string;
  name: string;
  manufacturer?: string;
}

interface MidiSession {
  devices: MidiDevice[];
  onNote: (cb: (note: MidiNote) => void) => () => void;
  disconnect: () => void;
}

/**
 * Request MIDI access. Returns null if MIDI is unavailable on this platform/browser.
 * Caller should display a friendly message in the unavailable case (D1.4).
 */
export async function requestMidi(): Promise<MidiSession | null> {
  try {
    // Lazy import so the bundle doesn't fail in environments without the native module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
    const mod: any = await import('@motiz88/react-native-midi').catch(() => null);
    if (!mod) return null;

    const access = await mod.requestMIDIAccess();
    if (!access) return null;

    const devices: MidiDevice[] = [];
    access.inputs.forEach((input: { id: string; name?: string; manufacturer?: string }) => {
      devices.push({
        id: input.id,
        name: input.name ?? 'Unknown MIDI input',
        manufacturer: input.manufacturer,
      });
    });

    const listeners = new Set<(n: MidiNote) => void>();

    access.inputs.forEach(
      (input: {
        onmidimessage:
          | ((e: { data: Uint8Array | number[]; timeStamp: number }) => void)
          | null;
      }) => {
        input.onmidimessage = (e) => {
          const data = e.data;
          // Standard MIDI: status byte (channel + type), then data bytes.
          const status = data[0] ?? 0;
          const isNoteOn = (status & 0xf0) === 0x90 && (data[2] ?? 0) > 0;
          const isNoteOff =
            (status & 0xf0) === 0x80 || ((status & 0xf0) === 0x90 && (data[2] ?? 0) === 0);
          if (isNoteOn) {
            const note: MidiNote = {
              note: data[1] ?? 0,
              velocity: data[2] ?? 0,
              timestamp: e.timeStamp ?? performance.now(),
            };
            listeners.forEach((cb) => cb(note));
          }
          // Note-off events are intentionally not surfaced in v1's passive last-N display.
          void isNoteOff;
        };
      },
    );

    return {
      devices,
      onNote(cb) {
        listeners.add(cb);
        return () => listeners.delete(cb);
      },
      disconnect() {
        listeners.clear();
        access.inputs.forEach(
          (input: { onmidimessage: ((e: unknown) => void) | null }) => {
            input.onmidimessage = null;
          },
        );
      },
    };
  } catch {
    return null;
  }
}

/** MIDI note number to scientific pitch notation (e.g., 60 → "C4"). */
export function noteName(midi: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  const name = names[midi % 12] ?? '?';
  return `${name}${octave}`;
}
