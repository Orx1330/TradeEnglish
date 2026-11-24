import { createAudioPlayer, setAudioModeAsync, setIsAudioActiveAsync, type AudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';
import { useSyncExternalStore } from 'react';

import { AUDIO } from '../data/audioMap';

/*
 * Everything the app plays is bundled or recorded on the device:
 *   - 1,997 pre-generated clips (seven voices) for the course phrases and supplier lines,
 *   - five short interface sounds,
 *   - the learner's own recordings,
 *   - the system text-to-speech voice as a fallback for sentences that have no clip.
 *
 * Latency: swapping the source of one shared player made every tap wait for the clip to load,
 * which on iOS was a noticeable pause. Instead each clip gets its own player, created ahead of
 * time by warmUp() (a lesson warms its six sentences when it opens) and kept in a small cache, so
 * a tap only has to rewind and play. Interface sounds are loaded once at start-up.
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
let speechUsed = false;
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

/** True while any sound is playing — Laith listens along. */
export const useAnyPlaying = () =>
  useSyncExternalStore(
    subscribe,
    () => nowKey !== null,
    () => false
  );

export const setVoicePref = (voice: string) => {
  voicePref = voice;
  lastClip = '';
  planned.clear();
};
export const setSfxEnabled = (value: boolean) => {
  sfxOn = value;
};

export async function initAudio() {
  try {
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
    // activate the iOS audio session once at start-up instead of on the first tap
    await setIsAudioActiveAsync(true);
  } catch {
    // audio mode is a best-effort setting; playback still works with the defaults
  }
  // load the interface sounds now, so the first tap does not wait for them
  for (const name of Object.keys(SFX) as SfxName[]) {
    try {
      sfxPlayers[name] ??= createAudioPlayer(SFX[name]);
      sfxPlayers[name]!.volume = name === 'tap' ? 0.5 : 0.8;
    } catch {
      // decorative; skip a sound that cannot load
    }
  }
}

/* ---------- the player that is currently sounding ---------- */
let current: AudioPlayer | null = null;
/** One-shot callback for when the current sound finishes on its own (not when it is stopped). */
let onEnd: (() => void) | null = null;

function watch(p: AudioPlayer) {
  p.addListener('playbackStatusUpdate', (status) => {
    if (!status.didJustFinish || p !== current) return;
    const next = onEnd;
    onEnd = null;
    setNow(null);
    next?.();
  });
  return p;
}

/* ---------- clip players, prepared ahead ---------- */
const CACHE_SIZE = 28;
const cache = new Map<string, AudioPlayer>(); // insertion order = least recently used first
const rates = new WeakMap<AudioPlayer, number>();

function clipPlayer(voice: string, clipId: string): AudioPlayer {
  const key = `${voice}:${clipId}`;
  let p = cache.get(key);
  if (p) {
    cache.delete(key);
    cache.set(key, p);
    return p;
  }
  p = watch(createAudioPlayer(AUDIO[voice][clipId], { updateInterval: 120 }));
  p.shouldCorrectPitch = true;
  cache.set(key, p);
  while (cache.size > CACHE_SIZE) {
    const [oldKey, old] = cache.entries().next().value as [string, AudioPlayer];
    cache.delete(oldKey);
    if (old !== current) {
      try {
        old.remove();
      } catch {
        // already released
      }
    }
  }
  return p;
}

let lastClip = '';
let lastVoice = '';
/** Voice chosen in advance for a clip by warmUp(), so the prepared player is the one that plays. */
const planned = new Map<string, string>();

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
  const ready = planned.get(clipId);
  if (ready && available.includes(ready)) return ready;
  const others = available.filter((v) => v !== lastVoice);
  const pool = others.length ? others : available;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Prepares players for these clips (a lesson's sentences) so pressing play is immediate. */
export function warmUp(clipIds: string[]) {
  for (const id of clipIds) {
    const voice = chooseVoice(id);
    if (!voice) continue;
    planned.set(id, voice);
    try {
      clipPlayer(voice, id);
    } catch {
      // a clip that cannot be prepared simply loads on first play
    }
  }
}

export function stopAudio() {
  onEnd = null;
  try {
    current?.pause();
  } catch {
    // player may already be released
  }
  if (speechUsed) Speech.stop().catch(() => {});
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
  try {
    const p = clipPlayer(chosen, clipId);
    const rate = slow ? 0.72 : 1;
    if (rates.get(p) !== rate) {
      p.setPlaybackRate(rate, 'high');
      rates.set(p, rate);
    }
    current = p;
    if (p.currentTime > 0.05) p.seekTo(0).catch(() => {});
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
  speechUsed = true;
  setNow(key ?? text);
  Speech.speak(text, {
    language: 'en-US',
    rate: slow ? 0.7 : 0.95,
    onDone: () => setNow(null),
    onStopped: () => setNow(null),
    onError: () => setNow(null),
  });
}

/* ---------- the learner's recordings ---------- */
let recordingPlayer: AudioPlayer | null = null;

/** Plays a file on the device, e.g. one of the learner's recordings. */
export function playUri(uri: string, key: string) {
  stopAudio();
  try {
    recordingPlayer ??= watch(createAudioPlayer(null, { updateInterval: 120 }));
    recordingPlayer.replace({ uri });
    current = recordingPlayer;
    recordingPlayer.play();
    setNow(key);
  } catch {
    setNow(null);
  }
}

export function sfx(name: SfxName) {
  if (!sfxOn) return;
  try {
    const p = (sfxPlayers[name] ??= createAudioPlayer(SFX[name]));
    if (p.currentTime > 0.02) p.seekTo(0).catch(() => {});
    p.play();
  } catch {
    // interface sounds are decorative; never let them break a tap
  }
}
