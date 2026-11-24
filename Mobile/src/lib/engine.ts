import { Lesson, Phrase, bare, lessonOf, normal, phrase, tokens } from '../data/course';

export type Step =
  | { kind: 'learn'; p: Phrase }
  /** Read and hear the English, choose its Arabic meaning. */
  | { kind: 'meaning'; p: Phrase; options: Phrase[] }
  /** Hear the sentence only, choose which English sentence it was. */
  | { kind: 'listen'; p: Phrase; options: Phrase[] }
  /** See the Arabic, build the English from word tiles. */
  | { kind: 'arrange'; p: Phrase; tiles: string[] }
  /** One word is missing from the English; choose it. */
  | { kind: 'fill'; p: Phrase; blank: number; options: string[] }
  /** Pair English sentences with their Arabic meanings. */
  | { kind: 'match'; pairs: Phrase[] }
  /** See the Arabic, type the English. */
  | { kind: 'type'; p: Phrase }
  /** Hear the sentence, type what was said. */
  | { kind: 'dictation'; p: Phrase };

export type StepKind = Step['kind'];

export const KIND_LABEL: Record<StepKind, string> = {
  learn: 'جملة جديدة',
  meaning: 'اختر المعنى الصحيح',
  listen: 'ماذا سمعت؟',
  arrange: 'رتّب الكلمات',
  fill: 'أكمل الجملة',
  match: 'طابِق كل جملة بمعناها',
  type: 'اكتب بالإنجليزية',
  dictation: 'استمع واكتب',
};

export function shuffle<T>(items: T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A word as it appears on a tile: punctuation off, capitalisation kept. */
export const tile = (word: string) => word.replace(/[.,!?;:"()]/g, '');

const siblings = (p: Phrase) => lessonOf(p.id).phrases.filter((x) => x.id !== p.id);

function wordPool(p: Phrase): string[] {
  const own = new Set(tokens(p.en).map(bare));
  const pool = new Map<string, string>();
  for (const other of siblings(p)) {
    tokens(other.en).forEach((w, i) => {
      const key = bare(w);
      // sentence-initial words are lower-cased so capital letters do not give the answer away
      if (key.length >= 2 && !own.has(key) && !pool.has(key)) pool.set(key, i === 0 && key !== 'i' ? tile(w).toLowerCase() : tile(w));
    });
  }
  return shuffle([...pool.values()]);
}

const make = {
  learn: (p: Phrase): Step => ({ kind: 'learn', p }),
  meaning: (p: Phrase): Step => ({ kind: 'meaning', p, options: shuffle([p, ...shuffle(siblings(p)).slice(0, 3)]) }),
  listen: (p: Phrase): Step => ({ kind: 'listen', p, options: shuffle([p, ...shuffle(siblings(p)).slice(0, 2)]) }),
  arrange: (p: Phrase): Step => ({
    kind: 'arrange',
    p,
    tiles: shuffle([...tokens(p.en).map(tile), ...wordPool(p).slice(0, 2)]),
  }),
  fill: (p: Phrase): Step => {
    const words = tokens(p.en);
    // prefer a content word: long, and not the opening word
    const candidates = words.map((w, i) => ({ i, n: bare(w).length })).filter((c) => c.i > 0 && c.n >= 4);
    const best = candidates.sort((a, b) => b.n - a.n).slice(0, 3);
    const blank = best.length ? best[Math.floor(Math.random() * best.length)].i : words.length - 1;
    const answer = tile(words[blank]);
    const distractors = wordPool(p).filter((w) => w.length >= 3).slice(0, 3);
    return { kind: 'fill', p, blank, options: shuffle([answer, ...distractors]) };
  },
  match: (pairs: Phrase[]): Step => ({ kind: 'match', pairs }),
  type: (p: Phrase): Step => ({ kind: 'type', p }),
  dictation: (p: Phrase): Step => ({ kind: 'dictation', p }),
};

/** Rebuilds a step with fresh options, for when it comes back after a mistake. */
export function again(step: Step): Step {
  if (step.kind === 'match') return make.match(step.pairs);
  return make[step.kind](step.p);
}

/**
 * A lesson session: each sentence is introduced, then met again in three or four different ways,
 * moving from recognising it to producing it. About twenty short steps.
 */
export function lessonSession(lesson: Lesson, typing: boolean): Step[] {
  const [a, b, c, d, e, f] = lesson.phrases;
  return [
    make.learn(a),
    make.learn(b),
    make.meaning(a),
    make.listen(b),
    make.learn(c),
    make.arrange(a),
    make.fill(b),
    make.meaning(c),
    make.learn(d),
    make.listen(d),
    make.arrange(c),
    make.match([a, b, c, d]),
    make.learn(e),
    make.learn(f),
    make.meaning(e),
    make.fill(f),
    make.arrange(e),
    make.listen(f),
    typing ? make.type(d) : make.arrange(d),
    typing ? make.dictation(b) : make.fill(d),
    make.arrange(f),
    make.match([c, d, e, f]),
  ];
}

/** A review session over sentences already met: no introductions, production-heavy. */
export function reviewSession(ids: string[], typing: boolean): Step[] {
  const picked = shuffle(ids).slice(0, 10).map(phrase);
  const kinds: StepKind[] = typing ? ['arrange', 'listen', 'fill', 'dictation', 'meaning'] : ['arrange', 'listen', 'fill', 'meaning'];
  const steps = picked.map((p, i) => {
    const kind = kinds[i % kinds.length] as Exclude<StepKind, 'match' | 'learn'>;
    return make[kind](p);
  });
  if (picked.length >= 4) steps.push(make.match(picked.slice(0, 4)));
  return steps;
}

function distance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

export type Verdict = 'exact' | 'typo' | 'wrong';

/** Typed answers forgive case, punctuation and a slip of the thumb (about one per 14 letters). */
export function judgeTyped(input: string, target: string): Verdict {
  const a = normal(input);
  const b = normal(target);
  if (!a) return 'wrong';
  if (a === b) return 'exact';
  return distance(a, b) <= Math.max(1, Math.floor(b.length / 14)) ? 'typo' : 'wrong';
}

export const judgeTiles = (chosen: string[], target: string) => normal(chosen.join(' ')) === normal(target);
