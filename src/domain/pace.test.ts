import { describe, expect, it } from 'vitest';
import type { LevelDuration } from './levels';
import {
  allBurnedThrough,
  allGuruThrough,
  paceStats,
  projectFinish,
  requiredDaysPerLevel,
} from './pace';
import { assignment, DAY_MS, kanji, radical, SYSTEMS, T0, vocab } from './test/fixtures';

// The Pace mockup's levels 1 to 11: level 6 spans a reset-length gap.
const DUR = [4.1, 4.0, 7.9, 8.3, 9.6, 312.0, 7.4, 7.1, 6.9, 7.0, 7.3];
const levels: LevelDuration[] = [...DUR, 5].map((days, i) => ({
  level: i + 1,
  startAt: 0,
  endAt: null,
  durationMs: days * DAY_MS,
  current: i === DUR.length,
  estimated: false,
}));

describe('paceStats', () => {
  it('auto-excludes levels over 3x the median of the others', () => {
    const s = paceStats(levels);
    expect(s.rows.filter((r) => r.autoExcluded).map((r) => r.level)).toEqual([6]);
    expect(s.rows.find((r) => r.current)).toMatchObject({ level: 12, included: false });
    expect(s.medianDays).toBeCloseTo(7.2);
    expect(s.p25Days).toBeCloseTo(6.925);
    expect(s.p75Days).toBeCloseTo(7.775);
    expect(s.medianAllDays).toBeCloseTo(7.3);
    expect(s.meanAllDays).toBeCloseTo(381.6 / 11);
  });

  it('lets user overrides win both ways', () => {
    const s = paceStats(levels, { 6: 'include', 1: 'exclude' });
    expect(s.rows[5].included).toBe(true);
    expect(s.rows[0].included).toBe(false);
    expect(s.medianDays).toBeCloseTo(7.35);
  });

  it('works from a single completed level', () => {
    const s = paceStats(levels.slice(0, 2).map((l, i) => ({ ...l, current: i === 1 })));
    expect(s).toMatchObject({ p25Days: 4.1, p75Days: 4.1, meanAllDays: 4.1 });
    expect(s.medianDays).toBeCloseTo(4.1);
  });

  it('has no pace without completed levels', () => {
    expect(paceStats([{ ...levels[0], current: true }]).medianDays).toBeNull();
  });
});

describe('projectFinish', () => {
  const lu = T0 + 3 * DAY_MS;
  const times = new Map(
    Array.from({ length: 60 }, (_, i) => [i + 1, (i + 1) % 2 ? DAY_MS : 2 * DAY_MS]),
  );
  const base = {
    currentLevel: 12,
    maxLevelGranted: 60,
    earliestLevelUpAt: lu,
    paceDays: 7,
    p25Days: 6,
    p75Days: 8,
    minLevelTimes: times,
  };

  it('adds pace for each level after the next', () => {
    const f = projectFinish({ ...base, goal: 51 });
    expect(f).toMatchObject({
      goal: 51,
      capped: false,
      reached: false,
      levelsLeft: 38,
      finishAt: lu + 38 * 7 * DAY_MS,
      lowAt: lu + 38 * 6 * DAY_MS,
      highAt: lu + 38 * 8 * DAY_MS,
      // Levels 13 to 50: 19 odd (1 day) and 19 even (2 days).
      fastestAt: lu + 57 * DAY_MS,
    });
  });

  it('lands on the next level-up for the next level', () => {
    expect(projectFinish({ ...base, goal: 13 })).toMatchObject({ finishAt: lu, fastestAt: lu });
  });

  it('reports a reached goal', () => {
    expect(projectFinish({ ...base, goal: 12 })).toMatchObject({ reached: true, finishAt: null });
  });

  it('caps the goal at the subscription max level', () => {
    expect(projectFinish({ ...base, goal: 60, maxLevelGranted: 20 })).toMatchObject({
      goal: 20,
      capped: true,
      levelsLeft: 7,
    });
  });

  it('has no range without quartiles', () => {
    const f = projectFinish({ ...base, goal: 20, p25Days: null, p75Days: null });
    expect(f).toMatchObject({ lowAt: null, highAt: null });
  });
});

describe('requiredDaysPerLevel', () => {
  const lu = T0;
  it('spreads the time to the goal date over the levels left', () => {
    expect(
      requiredDaysPerLevel({
        goal: 22,
        currentLevel: 12,
        earliestLevelUpAt: lu,
        goalDate: lu + 90 * DAY_MS,
      }),
    ).toBe(10);
  });
  it('is null when the date or goal leaves nothing to spread', () => {
    expect(
      requiredDaysPerLevel({
        goal: 13,
        currentLevel: 12,
        earliestLevelUpAt: lu,
        goalDate: lu + DAY_MS,
      }),
    ).toBeNull();
    expect(
      requiredDaysPerLevel({ goal: 20, currentLevel: 12, earliestLevelUpAt: lu, goalDate: lu - 1 }),
    ).toBeNull();
  });
});

describe('all Guru and all burned through', () => {
  const r1 = radical(1, 1);
  const k1 = kanji(2, 1, [1]);
  const hidden = vocab(3, 1, [2], { hidden: true });
  const r2 = radical(4, 2);
  const k2 = kanji(5, 2, [4]);
  const r3 = radical(6, 3);
  const subjects = [r1, k1, hidden, r2, k2, r3];

  it('finds the highest level with every visible subject at or above the stage', () => {
    const assignments = [
      assignment(r1, { stage: 9 }),
      assignment(k1, { stage: 9 }),
      assignment(hidden, { stage: 1 }),
      assignment(r2, { stage: 9 }),
      assignment(k2, { stage: 5 }),
      assignment(r3, { stage: 4 }),
    ];
    expect(allGuruThrough(subjects, assignments, SYSTEMS)).toBe(2);
    expect(allBurnedThrough(subjects, assignments, SYSTEMS)).toBe(1);
  });

  it('is 0 when level 1 is not done, and counts a missing assignment as not done', () => {
    expect(allGuruThrough(subjects, [assignment(r1, { stage: 9 })], SYSTEMS)).toBe(0);
  });
});
