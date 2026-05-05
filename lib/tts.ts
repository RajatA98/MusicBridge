// MusicBridge — TTS adapter.
//
// Locked per DECISIONS.md D1.6, D2.10:
//   v1: expo-speech on native, Web SpeechSynthesis on web. Runtime synthesis only — no pre-generated
//       audio assets. Replay re-synthesizes.
//   v1.5 upgrade path: ElevenLabs (server-side audio + Cloud Storage). The whole module gets swapped
//       behind the same `synthesize`/`stop` API — call sites do not change.
//
// Web gotcha: speechSynthesis.getVoices() returns [] on first synchronous call in Chrome.
// Wait for `voiceschanged` once before using voices.

import { Platform } from 'react-native';
import * as Speech from 'expo-speech';

interface SynthOptions {
  text: string;
  voice?: string;
  rate?: number;
  onDone?: () => void;
  onError?: (err: unknown) => void;
}

let webVoicesReady: Promise<void> | null = null;

function ensureWebVoicesReady(): Promise<void> {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return Promise.resolve();
  }
  if (webVoicesReady) return webVoicesReady;

  webVoicesReady = new Promise<void>((resolve) => {
    if (window.speechSynthesis.getVoices().length > 0) {
      resolve();
      return;
    }
    const handler = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', handler);
      resolve();
    };
    window.speechSynthesis.addEventListener('voiceschanged', handler);
    // Safety timeout: don't hang forever if `voiceschanged` never fires.
    setTimeout(() => {
      window.speechSynthesis.removeEventListener('voiceschanged', handler);
      resolve();
    }, 1000);
  });
  return webVoicesReady;
}

export async function synthesize(opts: SynthOptions): Promise<void> {
  if (Platform.OS === 'web') {
    await ensureWebVoicesReady();
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      opts.onDone?.();
      return;
    }
    return new Promise((resolve) => {
      const utter = new window.SpeechSynthesisUtterance(opts.text);
      utter.rate = opts.rate ?? 1.0;
      utter.onend = () => {
        opts.onDone?.();
        resolve();
      };
      utter.onerror = (e: SpeechSynthesisErrorEvent) => {
        opts.onError?.(e);
        resolve();
      };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    });
  }

  // Native (iOS): expo-speech.
  Speech.speak(opts.text, {
    voice: opts.voice,
    rate: opts.rate ?? 1.0,
    onDone: opts.onDone,
    onError: opts.onError,
    // Avoid contention with MIDI/audio session.
    useApplicationAudioSession: false,
  });
}

export function stop(): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    return;
  }
  Speech.stop();
}

export function isSpeaking(): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || !window.speechSynthesis) return Promise.resolve(false);
    return Promise.resolve(window.speechSynthesis.speaking);
  }
  return Speech.isSpeakingAsync();
}
