import type { SpacedRepetitionSystem } from '../api/types';
import { intervalFor } from './srs';

export interface DayPrefs {
  /** Local hours, 0 to 23. Sleep may be earlier than wake when the day crosses midnight. */
  wakeHour: number;
  sleepHour: number;
  lessonHour: number;
}

/** Hours of the day, wrapping past midnight, `from` and `to` inclusive. */
export interface HourRange {
  from: number;
  to: number;
}

export type HourKind = 'window' | 'evening' | 'awake' | 'asleep';

export interface LessonWindow {
  morning: HourRange | null;
  evening: HourRange | null;
  /** "07:00 to 11:00 or 19:00 sharp"; null when no hour works. */
  label: string | null;
  /** Index is the local hour. */
  strip: HourKind[];
  lessonTimeFits: boolean;
  /** Only when no window exists: the waking hour whose reviews land least outside the day. */
  closest: { hour: number; hoursOutside: number } | null;
}

export const fmtHour = (h: number) => `${String(h).padStart(2, '0')}:00`;

const fmtRange = (r: HourRange) =>
  r.from === r.to ? `${fmtHour(r.from)} sharp` : `${fmtHour(r.from)} to ${fmtHour(r.to)}`;

export function lessonWindow(system: SpacedRepetitionSystem, prefs: DayPrefs): LessonWindow {
  const a1 = intervalFor(system, 1);
  const a2 = intervalFor(system, 2);
  const { wakeHour: wake, sleepHour: sleep } = prefs;
  // Work in hours since wake so a day crossing midnight is one straight span 0..awake.
  const awake = (sleep - wake + 24) % 24 || 24;
  const hourAt = (o: number) => (wake + o) % 24;

  const morningOffsets: number[] = [];
  const eveningOffsets: number[] = [];
  for (let o = 0; o <= awake; o++) {
    const back1 = o + a1;
    const back2 = back1 + a2;
    if (back2 <= awake) morningOffsets.push(o);
    else if (back1 <= awake && back2 >= 24 && back2 <= 24 + awake) eveningOffsets.push(o);
  }
  const range = (offs: number[]): HourRange | null =>
    offs.length ? { from: hourAt(offs[0]), to: hourAt(offs[offs.length - 1]) } : null;
  const morning = range(morningOffsets);
  const evening = range(eveningOffsets);

  const strip: HourKind[] = Array.from({ length: 24 }, (_, h) => {
    const o = (h - wake + 24) % 24;
    if (morningOffsets.includes(o)) return 'window';
    if (eveningOffsets.includes(o)) return 'evening';
    return o < awake ? 'awake' : 'asleep';
  });

  const label = [morning, evening].filter((r) => r !== null).map(fmtRange).join(' or ') || null;

  let closest: LessonWindow['closest'] = null;
  if (!label) {
    const outside = (x: number) => {
      const y = x % 24;
      return y <= awake ? 0 : Math.min(y - awake, 24 - y);
    };
    for (let o = 0; o <= awake; o++) {
      const miss = outside(o + a1) + outside(o + a1 + a2);
      if (!closest || miss < closest.hoursOutside) closest = { hour: hourAt(o), hoursOutside: miss };
    }
  }

  const lessonKind = strip[prefs.lessonHour];
  return {
    morning,
    evening,
    label,
    strip,
    lessonTimeFits: lessonKind === 'window' || lessonKind === 'evening',
    closest,
  };
}
