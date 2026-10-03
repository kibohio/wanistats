import type { SpacedRepetitionSystem } from '../api/types';
import { intervalFor } from './srs';

export interface DayPrefs {
  /** Local minutes since midnight, in 30-minute steps. Sleep may be earlier than wake when the day crosses midnight. */
  wakeMin: number;
  sleepMin: number;
  lessonMin: number;
}

/** Minutes since midnight, wrapping past midnight, `from` and `to` inclusive. */
export interface TimeRange {
  from: number;
  to: number;
}

export type SlotKind = 'window' | 'evening' | 'awake' | 'asleep';

export interface LessonWindow {
  morning: TimeRange | null;
  evening: TimeRange | null;
  /** "07:00 to 11:00 or 19:30 sharp"; null when no time works. */
  label: string | null;
  /** 48 half-hour slots; index n starts at n * 30 minutes. */
  strip: SlotKind[];
  lessonTimeFits: boolean;
  /** Only when no window exists: the waking time whose reviews land least outside the day. */
  closest: { min: number; hoursOutside: number } | null;
}

export const SLOT_MIN = 30;
const SLOTS = (24 * 60) / SLOT_MIN;
const wrapDay = (min: number) => ((min % 1440) + 1440) % 1440;

/** "07:30" from minutes since midnight. */
export const fmtTime = (min: number) => {
  const m = wrapDay(Math.round(min));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
export const fmtHour = (h: number) => fmtTime(h * 60);

const fmtRange = (r: TimeRange) =>
  r.from === r.to ? `${fmtTime(r.from)} sharp` : `${fmtTime(r.from)} to ${fmtTime(r.to)}`;

export function lessonWindow(system: SpacedRepetitionSystem, prefs: DayPrefs): LessonWindow {
  const a1 = (intervalFor(system, 1) * 60) / SLOT_MIN;
  const a2 = (intervalFor(system, 2) * 60) / SLOT_MIN;
  const wake = Math.round(wrapDay(prefs.wakeMin) / SLOT_MIN);
  const sleep = Math.round(wrapDay(prefs.sleepMin) / SLOT_MIN);
  // Work in slots since wake so a day crossing midnight is one straight span 0..awake.
  const awake = (sleep - wake + SLOTS) % SLOTS || SLOTS;
  const minAt = (o: number) => ((wake + o) % SLOTS) * SLOT_MIN;

  const morningOffsets: number[] = [];
  const eveningOffsets: number[] = [];
  for (let o = 0; o <= awake; o++) {
    const back1 = o + a1;
    const back2 = back1 + a2;
    if (back2 <= awake) morningOffsets.push(o);
    else if (back1 <= awake && back2 >= SLOTS && back2 <= SLOTS + awake) eveningOffsets.push(o);
  }
  const range = (offs: number[]): TimeRange | null =>
    offs.length ? { from: minAt(offs[0]), to: minAt(offs[offs.length - 1]) } : null;
  const morning = range(morningOffsets);
  const evening = range(eveningOffsets);

  const strip: SlotKind[] = Array.from({ length: SLOTS }, (_, s) => {
    const o = (s - wake + SLOTS) % SLOTS;
    if (morningOffsets.includes(o)) return 'window';
    if (eveningOffsets.includes(o)) return 'evening';
    return o < awake ? 'awake' : 'asleep';
  });

  const label =
    [morning, evening]
      .filter((r) => r !== null)
      .map(fmtRange)
      .join(' or ') || null;

  let closest: LessonWindow['closest'] = null;
  if (!label) {
    const outside = (x: number) => {
      const y = x % SLOTS;
      return y <= awake ? 0 : Math.min(y - awake, SLOTS - y);
    };
    for (let o = 0; o <= awake; o++) {
      const hours = ((outside(o + a1) + outside(o + a1 + a2)) * SLOT_MIN) / 60;
      if (!closest || hours < closest.hoursOutside)
        closest = { min: minAt(o), hoursOutside: hours };
    }
  }

  const lessonKind = strip[Math.floor(wrapDay(prefs.lessonMin) / SLOT_MIN)];
  return {
    morning,
    evening,
    label,
    strip,
    lessonTimeFits: lessonKind === 'window' || lessonKind === 'evening',
    closest,
  };
}
