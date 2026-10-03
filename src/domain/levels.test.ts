import { describe, expect, it } from 'vitest';
import { levelDurations } from './levels';
import {
  assignment,
  DAY_MS,
  iso,
  kanji,
  progression,
  radical,
  reset,
  T0,
  user,
} from './test/fixtures';

const d = (n: number) => T0 + n * DAY_MS;
const days = (r: ReturnType<typeof levelDurations>) =>
  r.levels.map((l) => [l.level, l.durationMs / DAY_MS, l.current, l.estimated]);

const base = { subjects: [], assignments: [], resets: [] };

describe('levelDurations', () => {
  it('uses passed_at - unlocked_at, not started_at, and now for the current level', () => {
    const r = levelDurations({
      ...base,
      user: user(3),
      progressions: [
        progression(1, d(0), d(4), { started_at: iso(d(1)) }),
        progression(2, d(4), d(11)),
        progression(3, d(11)),
      ],
      now: d(13.5),
    });
    expect(days(r)).toEqual([
      [1, 4, false, false],
      [2, 7, false, false],
      [3, 2.5, true, false],
    ]);
    expect(r.levels[2].endAt).toBeNull();
  });

  it('freezes the current level at the vacation start', () => {
    const r = levelDurations({
      ...base,
      user: user(1, { current_vacation_started_at: iso(d(3)) }),
      progressions: [progression(1, d(0))],
      now: d(20),
    });
    expect(r.levels[0].durationMs).toBe(3 * DAY_MS);
  });

  it('ignores abandoned progressions', () => {
    const r = levelDurations({
      ...base,
      user: user(2),
      progressions: [
        progression(1, d(0), d(5)),
        progression(2, d(1), null, { abandoned_at: iso(d(2)) }),
        progression(2, d(5)),
      ],
      now: d(6),
    });
    expect(days(r)).toEqual([
      [1, 5, false, false],
      [2, 1, true, false],
    ]);
  });

  it('drops pre-reset progressions at or above the target level and returns markers', () => {
    const r = levelDurations({
      ...base,
      user: user(3),
      resets: [reset(4, 2, d(100)), reset(9, 1, null)],
      progressions: [
        progression(1, d(0), d(5)),
        progression(2, d(5), d(10)),
        progression(3, d(10), d(15)),
        progression(4, d(15)),
        progression(2, d(100), d(108), { created_at: iso(d(100)) }),
        progression(3, d(108), null, { created_at: iso(d(108)) }),
      ],
      now: d(110),
    });
    expect(days(r)).toEqual([
      [1, 5, false, false],
      [2, 8, false, false],
      [3, 2, true, false],
    ]);
    expect(r.resets).toEqual([{ at: d(100), from: 4, to: 2 }]);
  });

  it('estimates a missing level from the earliest radical or kanji unlock', () => {
    const r2 = radical(20, 2);
    const k2 = kanji(21, 2, [20]);
    const late = kanji(22, 2, [20]);
    const r = levelDurations({
      ...base,
      user: user(3),
      subjects: [r2, k2, late],
      assignments: [
        assignment(r2, { unlockedAt: d(6) }),
        assignment(k2, { unlockedAt: d(8) }),
        // Added to the level years later; must not rewrite history.
        assignment(late, { unlockedAt: d(300) }),
      ],
      progressions: [progression(1, d(0), d(5)), progression(3, d(12))],
      now: d(13),
    });
    expect(days(r)).toEqual([
      [1, 5, false, false],
      [2, 6, false, true],
      [3, 1, true, false],
    ]);
  });

  it('ignores hidden subjects when estimating', () => {
    const hidden = radical(30, 1, { hidden: true });
    const r = levelDurations({
      ...base,
      user: user(2),
      subjects: [hidden],
      assignments: [assignment(hidden, { unlockedAt: d(0) })],
      progressions: [progression(2, d(5))],
      now: d(6),
    });
    expect(r.levels.map((l) => l.level)).toEqual([2]);
  });
});
