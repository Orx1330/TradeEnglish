import raw from './course.json';

export type Phrase = { id: string; en: string; ar: string };
export type Keyword = { en: string; ar: string };
export type Lesson = {
  id: number;
  unit: number;
  title: string;
  goal: string;
  icon: string;
  tip?: string;
  keywords?: Keyword[];
  phrases: Phrase[];
};
export type Unit = {
  id: number;
  title: string;
  tag: string;
  goal: string;
  level: string;
  levelAr: string;
  icon: string;
  color: string;
  dark: string;
  soft: string;
};
export type Scenario = {
  id: string;
  unit: number;
  context: string;
  supplier: string;
  supplierAr: string;
  choices: string[];
  choicesAr: string[];
  correct: number;
  why: string;
};
export type Voice = { id: string; name: string; note: string; clips: number };

type CourseFile = {
  units: Unit[];
  lessons: Lesson[];
  scenarios: Scenario[];
  voices: Voice[];
  glossary: Record<string, string>;
};

const course = raw as unknown as CourseFile;

// Development builds expose the course to the console, for scripted checks of the lesson flow.
if (__DEV__) (globalThis as { __course?: CourseFile }).__course = course;

export const UNITS = course.units;
export const LESSONS = course.lessons;
export const SCENARIOS = course.scenarios;
export const VOICES = course.voices;
export const GLOSSARY = course.glossary;
export const LESSONS_PER_UNIT = 6;

export const PHRASES: Phrase[] = LESSONS.flatMap((l) => l.phrases);
const byId = new Map(PHRASES.map((p) => [p.id, p]));
const lessonOfPhrase = new Map(LESSONS.flatMap((l) => l.phrases.map((p) => [p.id, l] as const)));

export const phrase = (id: string) => byId.get(id)!;
export const lessonOf = (phraseId: string) => lessonOfPhrase.get(phraseId)!;
export const unitLessons = (unit: number) => LESSONS.filter((l) => l.unit === unit);
export const unitScenarios = (unit: number) => SCENARIOS.filter((s) => s.unit === unit);

/** Splits an English sentence into display tokens: words keep their trailing punctuation. */
export const tokens = (en: string) => en.split(/\s+/).filter(Boolean);

/** Letters-only lowercase form of a token, the glossary's key. */
export const bare = (word: string) => word.toLowerCase().replace(/[^a-z'\-]/g, '').replace(/^['\-]+|['\-]+$/g, '');

export const gloss = (word: string): string | undefined => GLOSSARY[bare(word)];

/** Comparison form of a sentence: case, punctuation and spacing are ignored. */
export const normal = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
