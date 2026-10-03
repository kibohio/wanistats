import { useLiveQuery } from 'dexie-react-hooks';
import type { WaniStatsDb } from './schema';
import { useDb } from './useAppMode';

export interface Prefs {
  goalLevel: number;
  /** Local date YYYY-MM-DD. */
  goalDate: string | null;
  /** Comfortable load band. */
  band: { min: number; max: number };
  /** Whole local hours, 0 to 23. */
  wakeHour: number;
  sleepHour: number;
  lessonHour: number;
  lessonsPerDay: number;
  theme: 'system' | 'light' | 'dark';
  timelineSplit: 'stage' | 'type';
  /** Pack ids after `words-`, e.g. 'global', 'anime'. */
  wordMedia: string[];
  /** Pace inclusion by level: true forces include, false forces exclude. Absent means automatic. */
  levelOverrides: Record<number, boolean>;
  /** SRS stage that counts as known for kanji and word coverage: 5 Guru, 7 Master, 8 Enlightened, 9 Burned. */
  knownStage: 5 | 7 | 8 | 9;
}

export const PREF_DEFAULTS: Prefs = {
  goalLevel: 60,
  goalDate: null,
  band: { min: 100, max: 150 },
  wakeHour: 7,
  sleepHour: 23,
  lessonHour: 9,
  lessonsPerDay: 15,
  theme: 'system',
  timelineSplit: 'stage',
  wordMedia: ['global'],
  levelOverrides: {},
  knownStage: 5,
};

export async function getPref<K extends keyof Prefs>(db: WaniStatsDb, key: K): Promise<Prefs[K]> {
  const row = await db.prefs.get(key);
  return row ? (row.value as Prefs[K]) : PREF_DEFAULTS[key];
}

export async function setPref<K extends keyof Prefs>(
  db: WaniStatsDb,
  key: K,
  value: Prefs[K],
): Promise<void> {
  await db.prefs.put({ key, value });
}

/** A preference from the current mode's database, its default until set, and a setter. */
export function usePref<K extends keyof Prefs>(
  key: K,
): [Prefs[K], (value: Prefs[K]) => Promise<void>] {
  const db = useDb();
  const value = useLiveQuery(() => getPref(db, key), [db, key]) ?? PREF_DEFAULTS[key];
  return [value, (v) => setPref(db, key, v)];
}
