import { useLiveQuery } from 'dexie-react-hooks';
import type { Clock } from '../format';
import type { WaniStatsDb } from './schema';
import { useDb } from './useAppMode';

export interface Prefs {
  goalLevel: number;
  /** Local date YYYY-MM-DD. */
  goalDate: string | null;
  /** Comfortable load band. */
  band: { min: number; max: number };
  /** Local minutes since midnight, in 30-minute steps. */
  wakeMin: number;
  sleepMin: number;
  lessonMin: number;
  lessonsPerDay: number;
  theme: 'system' | 'light' | 'dark';
  clock: Clock;
  timelineSplit: 'stage' | 'type';
  /** Pack ids after `words-`, e.g. 'global', 'anime'. */
  wordMedia: string[];
  /** Pace inclusion by level: true forces include, false forces exclude. Absent means automatic. */
  levelOverrides: Record<number, boolean>;
  /** SRS stage that counts as known for kanji and word coverage: 5 Guru, 7 Master, 8 Enlightened, 9 Burned. */
  knownStage: 5 | 7 | 8 | 9;
  /** Avatar id from src/components/Avatar.tsx; null shows the username's initial. */
  avatar: string | null;
}

export const PREF_DEFAULTS: Prefs = {
  goalLevel: 60,
  goalDate: null,
  band: { min: 100, max: 150 },
  wakeMin: 7 * 60,
  sleepMin: 23 * 60,
  lessonMin: 9 * 60,
  lessonsPerDay: 15,
  theme: 'system',
  clock: 'system',
  timelineSplit: 'stage',
  wordMedia: ['global'],
  levelOverrides: {},
  knownStage: 5,
  avatar: null,
};

/** Times were whole hours before they were minutes; read the old key until the new one is set. */
const HOUR_KEYS: Partial<Record<keyof Prefs, string>> = {
  wakeMin: 'wakeHour',
  sleepMin: 'sleepHour',
  lessonMin: 'lessonHour',
};

export async function getPref<K extends keyof Prefs>(db: WaniStatsDb, key: K): Promise<Prefs[K]> {
  const row = await db.prefs.get(key);
  if (row) return row.value as Prefs[K];
  const hourKey = HOUR_KEYS[key];
  const old = hourKey && (await db.prefs.get(hourKey));
  return old && typeof old.value === 'number' ? ((old.value * 60) as Prefs[K]) : PREF_DEFAULTS[key];
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
