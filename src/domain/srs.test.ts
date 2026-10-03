import { describe, expect, it } from 'vitest';
import type { SpacedRepetitionSystem } from '../api/types';
import { ceilHour, floorHour, intervalFor, pathToGuru } from './srs';

const H = 3600;
function system(intervals: number[], passing: number): SpacedRepetitionSystem {
  return {
    name: 'test',
    description: '',
    created_at: '',
    unlocking_stage_position: 0,
    starting_stage_position: 1,
    passing_stage_position: passing,
    burning_stage_position: 9,
    stages: [
      { interval: null, interval_unit: null, position: 0 },
      ...intervals.map((s, i) => ({ interval: s, interval_unit: 'seconds' as const, position: i + 1 })),
      { interval: null, interval_unit: null, position: 9 },
    ],
  };
}
// WaniKani's two systems as returned by /spaced_repetition_systems (seconds).
const normal = system([4, 8, 23, 47, 167, 335, 719, 2879].map((h) => h * H), 5);
const accelerated = system([2, 4, 8, 23, 167, 335, 719, 2879].map((h) => h * H), 5);

describe('intervalFor', () => {
  it('returns hours for a stage and 0 for lesson or burned', () => {
    expect(intervalFor(normal, 1)).toBe(4);
    expect(intervalFor(normal, 4)).toBe(47);
    expect(intervalFor(normal, 0)).toBe(0);
    expect(intervalFor(normal, 9)).toBe(0);
  });
  it('converts other units', () => {
    const s = system([1], 2);
    s.stages[1] = { interval: 2, interval_unit: 'days', position: 1 };
    expect(intervalFor(s, 1)).toBe(48);
  });
});

describe('pathToGuru', () => {
  it('is 82 hours from lessons on the normal system (3 days 10 hours)', () => {
    expect(pathToGuru(normal, 0)).toBe(82);
  });
  it('is 37 hours from lessons on the accelerated system', () => {
    expect(pathToGuru(accelerated, 0)).toBe(37);
  });
  it('counts only the remaining stages', () => {
    expect(pathToGuru(normal, 3)).toBe(47);
    expect(pathToGuru(normal, 4)).toBe(0);
    expect(pathToGuru(normal, 6)).toBe(0);
  });
});

describe('hour rounding', () => {
  it('floors and ceils to the hour', () => {
    const t = Date.UTC(2026, 0, 1, 10, 30);
    expect(floorHour(t)).toBe(Date.UTC(2026, 0, 1, 10));
    expect(ceilHour(t)).toBe(Date.UTC(2026, 0, 1, 11));
    expect(ceilHour(Date.UTC(2026, 0, 1, 10))).toBe(Date.UTC(2026, 0, 1, 10));
  });
});
