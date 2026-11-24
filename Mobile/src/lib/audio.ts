import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';
import { useSyncExternalStore } from 'react';

import { AUDIO } from '../data/audioMap';

/*
 * Everything the app plays is bundled or recorded on the device:
 *   - 1,997 pre-generated clips (seven voices) for the course phrases and supplier lines,
 *   - five short interface sounds,
 *   - the learner's own recordings,
 *   - the system text-to-speech voice as a fallback for sentences that have no clip.
 */

const SFX = {
  correct: require('../../assets/sfx/correct.mp3'),
  wrong: require('../../assets/sfx/wrong.mp3'),
  complete: require('../../assets/sfx/complete.mp3'),
  tap: require('../../assets/sfx/tap.mp3'),
  start: require('../../assets/sfx/start.mp3'),
};
export type SfxName = keyof typeof SFX;

let voicePref = 'random';
let sfxOn = true;
let main: AudioPlayer | null = null;
const sfxPlayers: Partial<Record<SfxName, AudioPlayer>> = {};

// Which control is "speaking" right now, so its button can animate.
let nowKey: string | null = null;
const listeners = new Set<() => void>();
const setNow = (key: string | null) => {
  if (nowKey === key) return;
  nowKey = key;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** True while the sound started with this key is playing. */
export const usePlaying = (key: string) =>
  useSyncExternalStore(
    subscribe,
    () => nowKey === key,
    () => false
  );

export const setVoicePref = (voice: string) => {
  voicePref = voice;
  lastClip = '';
};
export const setSfxEnabled = (value: boolean) => {
  sfxOn = value;
};

export async function initAudio() {
  try {
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
  } catch {
    // audio mode is a best-effort setting; playback still works with the defaults
  }
}

function player(): AudioPlayer {
  if (!main) {
    main = createAudioPlayer(null, { updateInterval: 120 });
    main.addListener('playbackStatusUpdate', (status) => {
      if (!status.didJustFinish) return;
      const next = onEnd;
      onEnd = null;
      setNow(null);
      next?.();
    });
  }
  return main;
}

let lastClip = '';
let lastVoice = '';
/** One-shot callback for when the current sound finishes on its own (not when it is stopped). */
let onEnd: (() => void) | null = null;

/** Voices that have a clip for this id. */
export const voicesFor = (clipId: string) => Object.keys(AUDIO).filter((v) => AUDIO[v][clipId] != null);

/**
 * Picks the speaker for a clip. A fixed preference wins when that voice has the clip; otherwise
 * the voice changes with each new sentence, and repeating a sentence keeps the same speaker.
 */
function chooseVoice(clipId: string, forced?: string): string | null {
  const available = voicesFor(clipId);
  if (!available.length) return null;
  if (forced && available.includes(forced)) return forced;
  if (voicePref !== 'random' && available.includes(voicePref)) return voicePref;
  if (clipId === lastClip && available.includes(lastVoice)) return lastVoice;
  const others = available.filter((v) => v !== lastVoice);
  const pool = others.length ? others : available;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function stopAudio() {
  onEnd = null;
  try {
    main?.pause();
  } catch {
    // player may already be released
  }
  Speech.stop().catch(() => {});
  setNow(null);
}

type SpeakOptions = { slow?: boolean; voice?: string; key?: string; then?: () => void };

/** Plays a bundled clip (phrase id like "p012" or supplier line id like "s03"). */
export function speak(clipId: string, { slow = false, voice, key, then }: SpeakOptions = {}) {
  const chosen = chooseVoice(clipId, voice);
  if (!chosen) return false;
  stopAudio();
  lastClip = clipId;
  lastVoice = chosen;
  const p = player();
  try {
    p.replace(AUDIO[chosen][clipId]);
    p.shouldCorrectPitch = true;
    p.setPlaybackRate(slow ? 0.72 : 1, 'high');
    p.play();
    onEnd = then ?? null;
    setNow(key ?? clipId);
  } catch {
    setNow(null);
    return false;
  }
  return true;
}

/** Speaks arbitrary English with the device's own offline voice (used when no clip exists). */
export function speakText(text: string, { slow = false, key }: { slow?: boolean; key?: string } = {}) {
  stopAudio();
  setNow(key ?? text);
  Speech.speak(text, {
    language: 'en-US',
    rate: slow ? 0.7 : 0.95,
    onDone: () => setNow(null),
    onStopped: () => setNow(null),
    onError: () => setNow(null),
  });
}

/** Plays a file on the device, e.g. one of the learner's recordings. */
export function playUri(uri: string, key: string) {
  stopAudio();
  const p = player();
  try {
    p.replace({ uri });
    p.setPlaybackRate(1, 'high');
    p.play();
    setNow(key);
  } catch {
    setNow(null);
  }
}

export function sfx(name: SfxName) {
  if (!sfxOn) return;
  try {
    const p = (sfxPlayers[name] ??= createAudioPlayer(SFX[name]));
    p.volume = name === 'tap' ? 0.5 : 0.8;
    p.seekTo(0).catch(() => {});
    p.play();
  } catch {
    // interface sounds are decorative; never let them break a tap
  }
}
