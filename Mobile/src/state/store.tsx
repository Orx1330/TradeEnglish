import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { LESSONS, LESSONS_PER_UNIT, UNITS } from '../data/course';
import { setSfxEnabled, setVoicePref } from '../lib/audio';
import { setHapticsEnabled } from '../lib/haptics';
import { deleteAllRecordings, deleteRecording } from '../lib/recStore';

const KEY = 'trade-english.progress.v1';

export type Settings = {
  voice: string;
  haptics: boolean;
  sfx: boolean;
  /** Daily goal in XP. */
  goal: number;
  /** Include keyboard exercises (typing and dictation). */
  typing: boolean;
  /** Play each new sentence automatically. */
  autoplay: boolean;
};
export type LessonRecord = { stars: number; times: number };
export type ReviewItem = { box: number; due: string };
export type Recording = { file: string; ms: number; at: number };

export type State = {
  v: 1;
  onboarded: boolean;
  name: string;
  xp: number;
  done: Record<string, LessonRecord>;
  cases: number[];
  /** XP earned per local day (yyyy-mm-dd). */
  days: Record<string, number>;
  review: Record<string, ReviewItem>;
  favorites: string[];
  recordings: Record<string, Recording>;
  perfect: number;
  settings: Settings;
};

const initial: State = {
  v: 1,
  onboarded: false,
  name: '',
  xp: 0,
  done: {},
  cases: [],
  days: {},
  review: {},
  favorites: [],
  recordings: {},
  perfect: 0,
  settings: { voice: 'random', haptics: true, sfx: true, goal: 60, typing: true, autoplay: true },
};

/* ---------- dates ---------- */
const pad = (n: number) => String(n).padStart(2, '0');
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDays = (days: number, from = new Date()) => {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
};

/* ---------- selectors ---------- */
/** Consecutive days with practice, counting back from today (or yesterday if today is still empty). */
export function streak(s: State): number {
  let d = new Date();
  if (!s.days[dayKey(d)]) d = addDays(-1, d);
  let n = 0;
  while (s.days[dayKey(d)]) {
    n++;
    d = addDays(-1, d);
  }
  return n;
}
export const todayXp = (s: State) => s.days[dayKey()] ?? 0;
export const isDone = (s: State, lessonId: number) => s.done[lessonId] != null;
export const isUnlocked = (s: State, lessonId: number) => lessonId === 0 || isDone(s, lessonId - 1) || isDone(s, lessonId);
/** The next lesson to take: the first one not finished yet (or the last when all are done). */
export const currentLesson = (s: State) => LESSONS.find((l) => !isDone(s, l.id))?.id ?? LESSONS.length - 1;
export const unitDoneCount = (s: State, unit: number) =>
  LESSONS.filter((l) => l.unit === unit && isDone(s, l.id)).length;
/** A unit's deal lab opens after its last lesson. */
export const caseUnlocked = (s: State, unit: number) => unitDoneCount(s, unit) === LESSONS_PER_UNIT;
export const dueIds = (s: State) => {
  const today = dayKey();
  return Object.keys(s.review).filter((id) => s.review[id].due <= today);
};
export const masteredCount = (s: State) => Object.values(s.review).filter((r) => r.box >= 3).length;

/** Leitner intervals in days for boxes 0..5. */
const INTERVALS = [0, 1, 3, 7, 14, 30];
function marked(review: State['review'], id: string, correct: boolean): State['review'] {
  const box = correct ? Math.min(5, (review[id]?.box ?? 0) + 1) : 0;
  return { ...review, [id]: { box, due: dayKey(addDays(correct ? INTERVALS[box] : 0)) } };
}

export type LessonResult = { xp: number; stars: number; first: boolean; streak: number };

type Store = {
  ready: boolean;
  s: State;
  finishOnboarding: (name: string, goal: number) => void;
  /** results: phraseId -> answered correctly on the first try in this session. */
  completeLesson: (lessonId: number, mistakes: number, results: Record<string, boolean>) => LessonResult;
  completeReview: (results: Record<string, boolean>) => LessonResult;
  completeCase: (unit: number) => LessonResult;
  toggleFavorite: (phraseId: string) => void;
  saveRecording: (phraseId: string, rec: Recording) => void;
  removeRecording: (phraseId: string) => void;
  setSettings: (patch: Partial<Settings>) => void;
  resetProgress: () => void;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<State>(initial);
  const [ready, setReady] = useState(false);
  const ref = useRef(s);
  ref.current = s;

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((text) => {
        if (text) {
          const saved = JSON.parse(text) as Partial<State>;
          setS({ ...initial, ...saved, settings: { ...initial.settings, ...saved.settings } });
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  // Persist shortly after every change; progress is small, so the whole state is written.
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [s, ready]);

  useEffect(() => {
    setVoicePref(s.settings.voice);
    setSfxEnabled(s.settings.sfx);
    setHapticsEnabled(s.settings.haptics);
  }, [s.settings.voice, s.settings.sfx, s.settings.haptics]);

  const apply = useCallback((next: State) => {
    ref.current = next;
    setS(next);
  }, []);

  const withXp = (base: State, xp: number): State => ({
    ...base,
    xp: base.xp + xp,
    days: { ...base.days, [dayKey()]: (base.days[dayKey()] ?? 0) + xp },
  });

  const store = useMemo<Store>(
    () => ({
      ready,
      s,
      finishOnboarding: (name, goal) =>
        apply({ ...ref.current, onboarded: true, name, settings: { ...ref.current.settings, goal } }),

      completeLesson: (lessonId, mistakes, results) => {
        const cur = ref.current;
        const first = cur.done[lessonId] == null;
        const stars = mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1;
        const xp = (first ? 60 : 10) + (mistakes === 0 ? 10 : 0);
        let review = cur.review;
        for (const [id, ok] of Object.entries(results)) review = marked(review, id, ok);
        const prev = cur.done[lessonId];
        const next = withXp(
          {
            ...cur,
            review,
            perfect: cur.perfect + (mistakes === 0 ? 1 : 0),
            done: {
              ...cur.done,
              [lessonId]: { stars: Math.max(stars, prev?.stars ?? 0), times: (prev?.times ?? 0) + 1 },
            },
          },
          xp
        );
        apply(next);
        return { xp, stars, first, streak: streak(next) };
      },

      completeReview: (results) => {
        const cur = ref.current;
        let review = cur.review;
        for (const [id, ok] of Object.entries(results)) review = marked(review, id, ok);
        const next = withXp({ ...cur, review }, 20);
        apply(next);
        return { xp: 20, stars: 0, first: false, streak: streak(next) };
      },

      completeCase: (unit) => {
        const cur = ref.current;
        const first = !cur.cases.includes(unit);
        const xp = first ? 30 : 5;
        const next = withXp({ ...cur, cases: first ? [...cur.cases, unit] : cur.cases }, xp);
        apply(next);
        return { xp, stars: 0, first, streak: streak(next) };
      },

      toggleFavorite: (id) => {
        const cur = ref.current;
        const has = cur.favorites.includes(id);
        apply({ ...cur, favorites: has ? cur.favorites.filter((f) => f !== id) : [...cur.favorites, id] });
      },

      saveRecording: (id, rec) => apply({ ...ref.current, recordings: { ...ref.current.recordings, [id]: rec } }),

      removeRecording: (id) => {
        const cur = ref.current;
        const rec = cur.recordings[id];
        if (!rec) return;
        try {
          deleteRecording(rec.file);
        } catch {
          // a missing file is already the wanted outcome
        }
        const { [id]: _gone, ...rest } = cur.recordings;
        apply({ ...cur, recordings: rest });
      },

      setSettings: (patch) => apply({ ...ref.current, settings: { ...ref.current.settings, ...patch } }),

      resetProgress: () => {
        try {
          deleteAllRecordings();
        } catch {
          // nothing stored yet
        }
        apply({ ...initial, onboarded: true, name: ref.current.name, settings: ref.current.settings });
      },
    }),
    [s, ready, apply]
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const store = useContext(Ctx);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}

/* ---------- achievements ---------- */
export type Badge = { id: string; title: string; hint: string; icon: string; earned: boolean };
export function badges(s: State): Badge[] {
  const lessons = Object.keys(s.done).length;
  const recs = Object.keys(s.recordings).length;
  const unitsDone = UNITS.filter((u) => unitDoneCount(s, u.id) === LESSONS_PER_UNIT).length;
  return [
    { id: 'first', title: 'الخطوة الأولى', hint: 'أكمل أول درس', icon: 'flag-checkered', earned: lessons >= 1 },
    { id: 'voice', title: 'صوتك حاضر', hint: 'سجّل أول جملة بصوتك', icon: 'microphone', earned: recs >= 1 },
    { id: 'perfect', title: 'بلا أخطاء', hint: 'أنهِ درسًا دون أي خطأ', icon: 'star-four-points', earned: s.perfect >= 1 },
    { id: 'streak3', title: 'ثلاثة أيام', hint: 'تدرّب 3 أيام متتالية', icon: 'fire', earned: streak(s) >= 3 },
    { id: 'unit', title: 'وحدة كاملة', hint: 'أكمل دروس وحدة كاملة', icon: 'medal', earned: unitsDone >= 1 },
    { id: 'deal', title: 'صفقة موفّقة', hint: 'أنجز مختبر صفقات', icon: 'handshake', earned: s.cases.length >= 1 },
    { id: 'voice20', title: 'راوي الجمل', hint: 'سجّل 20 جملة بصوتك', icon: 'account-voice', earned: recs >= 20 },
    { id: 'xp1000', title: 'ألف نقطة', hint: 'اجمع 1000 نقطة خبرة', icon: 'trophy', earned: s.xp >= 1000 },
    { id: 'streak7', title: 'أسبوع كامل', hint: 'تدرّب 7 أيام متتالية', icon: 'calendar-star', earned: streak(s) >= 7 },
    { id: 'half', title: 'نصف الطريق', hint: 'أكمل 24 درسًا', icon: 'map-marker-path', earned: lessons >= 24 },
    { id: 'all', title: 'تاجر محترف', hint: 'أكمل كل الدروس', icon: 'crown', earned: lessons >= LESSONS.length },
    { id: 'labs', title: 'مفاوض بارع', hint: 'أنجز كل مختبرات الصفقات', icon: 'chess-queen', earned: s.cases.length >= UNITS.length },
  ];
}
