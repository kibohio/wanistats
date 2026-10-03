import type { AssignmentResource, SpacedRepetitionSystem } from '../api/types';
import { daysBetween, localDayStart } from './localDate';
import { HOUR_MS, floorHour, intervalFor } from './srs';

export type TimelineRange = '24h' | '7d' | '30d' | '120d';
/** Phone uses day bins for 7d and week bins for 120d; desktop uses hours and days. */
export type Granularity = 'hour' | 'day' | 'week';
export type StackBy = 'stage' | 'type';

const STAGE_KEYS = ['apprentice', 'guru', 'master', 'enlightened'] as const;
const TYPE_KEYS = ['radical', 'kanji', 'vocabulary'] as const;
export type StackKey = (typeof STAGE_KEYS)[number] | (typeof TYPE_KEYS)[number];

const RANGE_HOURS: Record<TimelineRange, number> = {
  '24h': 24,
  '7d': 168,
  '30d': 720,
  '120d': 2880,
};

export interface TimelineBin {
  start: number;
  end: number;
  /** Real reviews per stack key. */
  counts: Partial<Record<StackKey, number>>;
  total: number;
  critical: number;
  /** Reviews at Enlightened that burn if answered right. */
  burns: number;
  /** Reviews from the simulated lessons. An estimate: draw dashed. */
  estimate: number;
  runningTotal: number;
  runningEstimate: number;
  subjectIds: number[];
}

export interface Timeline {
  keys: readonly StackKey[];
  bins: TimelineBin[];
  total: number;
  estimateTotal: number;
}

export interface TimelineOptions {
  range: TimelineRange;
  granularity: Granularity;
  stackBy: StackBy;
  criticalIds?: ReadonlySet<number>;
  /** "Add N lessons a day": all answers right, done as soon as they come back. */
  lessons?: { perDay: number; lessonMin: number; system: SpacedRepetitionSystem };
}

const stageKey = (stage: number): StackKey =>
  stage <= 4 ? 'apprentice' : stage <= 6 ? 'guru' : stage === 7 ? 'master' : 'enlightened';

export function timeline(
  assignments: AssignmentResource[],
  now: number,
  opts: TimelineOptions,
): Timeline {
  const { granularity, stackBy, criticalIds, lessons } = opts;
  const hours = RANGE_HOURS[opts.range];
  const keys = stackBy === 'stage' ? STAGE_KEYS : TYPE_KEYS;

  // Hour bins are absolute; day and week bins follow local midnights so DST days fit.
  let starts: number[];
  let index: (t: number) => number;
  if (granularity === 'hour') {
    const start = floorHour(now);
    starts = Array.from({ length: hours + 1 }, (_, i) => start + i * HOUR_MS);
    index = (t) => Math.floor((t - start) / HOUR_MS);
  } else {
    const step = granularity === 'week' ? 7 : 1;
    const today = localDayStart(now);
    const count = Math.ceil(hours / 24 / step);
    starts = Array.from({ length: count + 1 }, (_, i) => localDayStart(now, i * step));
    index = (t) => Math.floor(daysBetween(today, localDayStart(t)) / step);
  }

  const bins: TimelineBin[] = starts.slice(0, -1).map((start, i) => ({
    start,
    end: starts[i + 1],
    counts: Object.fromEntries(keys.map((k) => [k, 0])),
    total: 0,
    critical: 0,
    burns: 0,
    estimate: 0,
    runningTotal: 0,
    runningEstimate: 0,
    subjectIds: [],
  }));
  const binAt = (t: number) => bins[Math.max(0, index(Math.max(t, now)))];

  for (const { data: a } of assignments) {
    if (a.hidden || !a.started_at || !a.available_at || a.srs_stage < 1 || a.srs_stage > 8)
      continue;
    const bin = binAt(Date.parse(a.available_at));
    if (!bin) continue;
    const key: StackKey =
      stackBy === 'stage'
        ? stageKey(a.srs_stage)
        : a.subject_type === 'kana_vocabulary'
          ? 'vocabulary'
          : a.subject_type;
    bin.counts[key] = (bin.counts[key] ?? 0) + 1;
    bin.total++;
    if (a.srs_stage === 8) bin.burns++;
    if (criticalIds?.has(a.subject_id)) bin.critical++;
    bin.subjectIds.push(a.subject_id);
  }

  if (lessons && lessons.perDay > 0) {
    const { system } = lessons;
    const offsets: number[] = [];
    let sum = 0;
    for (let stage = 1; stage < system.burning_stage_position; stage++) {
      sum += intervalFor(system, stage);
      offsets.push(sum * HOUR_MS);
    }
    const end = starts[starts.length - 1];
    for (let d = 0; ; d++) {
      const lessonAt = new Date(localDayStart(now, d)).setHours(0, lessons.lessonMin);
      if (lessonAt >= end) break;
      if (lessonAt < now) continue;
      for (const off of offsets) {
        const t = floorHour(lessonAt + off);
        if (t >= end) break;
        binAt(t).estimate += lessons.perDay;
      }
    }
  }

  let total = 0;
  let estimateTotal = 0;
  for (const b of bins) {
    b.runningTotal = total += b.total;
    b.runningEstimate = estimateTotal += b.estimate;
  }
  return { keys, bins, total, estimateTotal };
}
