import type {
  AssignmentResource,
  SpacedRepetitionSystem,
  SpacedRepetitionSystemResource,
  SubjectResource,
} from '../api/types';
import { sumMinLevelTimes } from './fastest';
import type { LevelDuration } from './levels';
import { HOUR_MS } from './srs';
import { mean, median, quartiles } from './stats';

const DAY_MS = 24 * HOUR_MS;

export type LevelOverride = 'include' | 'exclude';

export interface PaceRow {
  level: number;
  days: number;
  current: boolean;
  estimated: boolean;
  /** Longer than 3x the median of the other completed levels. */
  autoExcluded: boolean;
  /** Counted in the pace: completed, and auto rule or user override says so. */
  included: boolean;
}

export interface PaceStats {
  rows: PaceRow[];
  /** The pace. Null with no included completed level. */
  medianDays: number | null;
  p25Days: number | null;
  p75Days: number | null;
  /** Every completed level, idle ones too. */
  meanAllDays: number | null;
  medianAllDays: number | null;
}

/** Spec 9.5. Overrides are the user's saved include/exclude choices by level. */
export function paceStats(
  levels: LevelDuration[],
  overrides: Partial<Record<number, LevelOverride>> = {},
): PaceStats {
  const all = levels.filter((l) => !l.current).map((l) => l.durationMs / DAY_MS);
  let i = 0;
  const rows = levels.map((l): PaceRow => {
    const days = l.durationMs / DAY_MS;
    if (l.current) {
      return {
        level: l.level,
        days,
        current: true,
        estimated: l.estimated,
        autoExcluded: false,
        included: false,
      };
    }
    const others = all.toSpliced(i++, 1);
    const m = median(others);
    const autoExcluded = m !== null && days > 3 * m;
    const override = overrides[l.level];
    return {
      level: l.level,
      days,
      current: false,
      estimated: l.estimated,
      autoExcluded,
      included: override ? override === 'include' : !autoExcluded,
    };
  });
  const q = quartiles(rows.filter((r) => r.included).map((r) => r.days));
  return {
    rows,
    medianDays: q?.median ?? null,
    p25Days: q?.p25 ?? null,
    p75Days: q?.p75 ?? null,
    meanAllDays: mean(all),
    medianAllDays: median(all),
  };
}

export interface Finish {
  /** The goal after the subscription cap. */
  goal: number;
  capped: boolean;
  /** Already at or past the goal; all times are null. */
  reached: boolean;
  /** Levels after the next level-up still to pass. */
  levelsLeft: number;
  finishAt: number | null;
  lowAt: number | null;
  highAt: number | null;
  fastestAt: number | null;
}

/**
 * When the user reaches level `goal`. `paceDays` is the median or the what-if slider value;
 * `earliestLevelUpAt` comes from earliestLevelUp.
 */
export function projectFinish(input: {
  goal: number;
  currentLevel: number;
  maxLevelGranted: number;
  earliestLevelUpAt: number;
  paceDays: number;
  p25Days: number | null;
  p75Days: number | null;
  minLevelTimes: Map<number, number>;
}): Finish {
  const { currentLevel, earliestLevelUpAt: lu } = input;
  const capped = input.goal > input.maxLevelGranted;
  const goal = capped ? input.maxLevelGranted : input.goal;
  if (goal <= currentLevel) {
    return {
      goal,
      capped,
      reached: true,
      levelsLeft: 0,
      finishAt: null,
      lowAt: null,
      highAt: null,
      fastestAt: null,
    };
  }
  const levelsLeft = goal - currentLevel - 1;
  const at = (days: number | null) => (days === null ? null : lu + levelsLeft * days * DAY_MS);
  return {
    goal,
    capped,
    reached: false,
    levelsLeft,
    finishAt: at(input.paceDays),
    lowAt: at(input.p25Days),
    highAt: at(input.p75Days),
    fastestAt: lu + sumMinLevelTimes(input.minLevelTimes, currentLevel + 1, goal),
  };
}

/** "To finish by {date}, you need about {x} days a level." Null when nothing is left to spread. */
export function requiredDaysPerLevel(input: {
  goal: number;
  currentLevel: number;
  earliestLevelUpAt: number;
  goalDate: number;
}): number | null {
  const levelsLeft = input.goal - input.currentLevel - 1;
  const span = input.goalDate - input.earliestLevelUpAt;
  return levelsLeft > 0 && span > 0 ? span / levelsLeft / DAY_MS : null;
}

function highestLevelAtStage(
  subjects: SubjectResource[],
  assignments: AssignmentResource[],
  systems: SpacedRepetitionSystemResource[],
  threshold: (s: SpacedRepetitionSystem) => number,
): number {
  const stage = new Map(assignments.map((a) => [a.data.subject_id, a.data.srs_stage]));
  const system = new Map(systems.map((s) => [s.id, s.data]));
  const done = new Map<number, boolean>();
  for (const s of subjects) {
    if (s.data.hidden_at) continue;
    const sys = system.get(s.data.spaced_repetition_system_id);
    const ok = !!sys && (stage.get(s.id) ?? -1) >= threshold(sys);
    done.set(s.data.level, (done.get(s.data.level) ?? true) && ok);
  }
  let n = 0;
  while (done.get(n + 1)) n++;
  return n;
}

/** Highest N where every visible subject at levels 1 to N is at Guru or above. */
export const allGuruThrough = (
  subjects: SubjectResource[],
  assignments: AssignmentResource[],
  systems: SpacedRepetitionSystemResource[],
) => highestLevelAtStage(subjects, assignments, systems, (s) => s.passing_stage_position);

/** Highest N where every visible subject at levels 1 to N is burned. */
export const allBurnedThrough = (
  subjects: SubjectResource[],
  assignments: AssignmentResource[],
  systems: SpacedRepetitionSystemResource[],
) => highestLevelAtStage(subjects, assignments, systems, (s) => s.burning_stage_position);
