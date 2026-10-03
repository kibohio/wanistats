import type { IntervalUnit, SpacedRepetitionSystem } from '../api/types';

const HOUR_MS = 3_600_000;
const UNIT_HOURS: Record<IntervalUnit, number> = {
  milliseconds: 1 / HOUR_MS,
  seconds: 1 / 3600,
  minutes: 1 / 60,
  hours: 1,
  days: 24,
  weeks: 168,
};

/** Hours an item waits after reaching `stage`. 0 for the lesson and burned stages. */
export function intervalFor(system: SpacedRepetitionSystem, stage: number): number {
  const s = system.stages.find((x) => x.position === stage);
  if (!s?.interval || !s.interval_unit) return 0;
  return s.interval * UNIT_HOURS[s.interval_unit];
}

/**
 * Hours from the review (or lesson) at `fromStage` until the item reaches the passing stage,
 * assuming every answer is right.
 */
export function pathToGuru(system: SpacedRepetitionSystem, fromStage: number): number {
  let hours = 0;
  for (let stage = fromStage + 1; stage < system.passing_stage_position; stage++) {
    hours += intervalFor(system, stage);
  }
  return hours;
}

// WaniKani truncates available_at to the hour, so projections round the same way.
export const floorHour = (ms: number) => Math.floor(ms / HOUR_MS) * HOUR_MS;
export const ceilHour = (ms: number) => Math.ceil(ms / HOUR_MS) * HOUR_MS;
export { HOUR_MS };
