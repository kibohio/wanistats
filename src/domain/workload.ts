import type { AssignmentResource, SpacedRepetitionSystem } from '../api/types';
import type { Snapshot, StageCounts } from '../db/schema';
import { shiftDate, windowStartKey } from './localDate';
import { intervalFor } from './srs';

export interface Band {
  min: number;
  max: number;
}
export type BandStatus = 'under' | 'in' | 'over';

export const DEFAULT_BAND: Band = { min: 100, max: 150 };
const STAGE_KEYS: (keyof StageCounts)[] = ['a1', 'a2', 'a3', 'a4', 'g1', 'g2', 'm', 'e', 'b'];

/** Started, non-hidden assignments by SRS stage 1 to 9. Shared with the snapshot writer. */
export function stageCountsFromAssignments(assignments: AssignmentResource[]): StageCounts {
  const c: StageCounts = { a1: 0, a2: 0, a3: 0, a4: 0, g1: 0, g2: 0, m: 0, e: 0, b: 0 };
  for (const { data } of assignments) {
    // `hidden` mirrors the subject's hidden_at.
    if (data.hidden || !data.started_at || data.srs_stage < 1 || data.srs_stage > 9) continue;
    c[STAGE_KEYS[data.srs_stage - 1]]++;
  }
  return c;
}

export const apprenticeCount = (s: StageCounts) => s.a1 + s.a2 + s.a3 + s.a4;
export const guruCount = (s: StageCounts) => s.g1 + s.g2;
export const loadFromStages = (s: StageCounts) => apprenticeCount(s) + guruCount(s) / 10;

export function bandStatus(load: number, band: Band = DEFAULT_BAND): BandStatus {
  return load < band.min ? 'under' : load > band.max ? 'over' : 'in';
}

export interface Workload {
  stages: StageCounts;
  apprentice: number;
  guru: number;
  load: number;
  status: BandStatus;
  band: Band;
}

export function workload(assignments: AssignmentResource[], band: Band = DEFAULT_BAND): Workload {
  const stages = stageCountsFromAssignments(assignments);
  const load = loadFromStages(stages);
  return {
    stages,
    apprentice: apprenticeCount(stages),
    guru: guruCount(stages),
    load,
    status: bandStatus(load, band),
    band,
  };
}

/** Reviews a day once lessons at this rate reach burn. Show as "about N". */
export function steadyStateReviewsPerDay(
  lessonsPerDay: number,
  itemAccuracy: number,
): number | null {
  return itemAccuracy > 0 ? Math.round((lessonsPerDay * 8) / itemAccuracy) : null;
}

// Reviews wait for the next session after they come due; half a day is a typical gap.
const REVIEW_LAG_HOURS = 12;

/**
 * Apprentice, Guru and load once lessons at this rate settle (Little's law: count = rate x
 * days in the stage). Days in a stage are its intervals plus a session lag per review, divided
 * by item accuracy as a rough allowance for wrong answers sending items back. Show as "about N".
 */
export function steadyStateLoad(
  lessonsPerDay: number,
  itemAccuracy: number,
  system: SpacedRepetitionSystem,
): { apprentice: number; guru: number; load: number } | null {
  if (itemAccuracy <= 0) return null;
  const pass = system.passing_stage_position;
  const days = (from: number, to: number) => {
    let hours = 0;
    for (let stage = from; stage <= to; stage++)
      hours += intervalFor(system, stage) + REVIEW_LAG_HOURS;
    return hours / 24 / itemAccuracy;
  };
  const apprentice = lessonsPerDay * days(1, pass - 1);
  const guru = lessonsPerDay * days(pass, pass + 1);
  return {
    apprentice: Math.round(apprentice),
    guru: Math.round(guru),
    load: Math.round(apprentice + guru / 10),
  };
}

/** One snapshot's load, spanning any missed days before it (`from` to `to`, inclusive). */
export interface LoadPoint {
  from: string;
  to: string;
  load: number;
}

export const TREND_DAYS = 30;
export const TREND_MIN_SNAPSHOTS = 7;

export function loadTrend(
  snapshots: Pick<Snapshot, 'date' | 'load'>[],
  now: number,
): { available: boolean; points: LoadPoint[] } {
  if (snapshots.length < TREND_MIN_SNAPSHOTS) return { available: false, points: [] };
  const start = windowStartKey(now, TREND_DAYS);
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const points: LoadPoint[] = [];
  sorted.forEach((s, i) => {
    if (s.date < start) return;
    const from = i > 0 ? shiftDate(sorted[i - 1].date, 1) : s.date;
    points.push({ from: from < start ? start : from, to: s.date, load: s.load });
  });
  return { available: true, points };
}
