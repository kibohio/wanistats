import { describe, expect, it } from 'vitest';
import type { SubjectResource } from '../api/types';
import { minLevelTimes, sumMinLevelTimes } from './fastest';
import { HOUR_MS } from './srs';
import { kanji, radical, SYSTEMS } from './test/fixtures';

/** `ready` kanji use a radical from the level before; the rest use one from their own level. */
function level(level: number, ready: number, locked: number, extra: SubjectResource[] = []) {
  const old = radical(level * 100, level - 1);
  const fresh = radical(level * 100 + 1, level);
  const ks = Array.from({ length: ready + locked }, (_, i) =>
    kanji(level * 100 + 10 + i, level, [i < ready ? old.id : fresh.id]),
  );
  return [old, fresh, ...ks, ...extra];
}

describe('minLevelTimes', () => {
  const times = minLevelTimes(
    [
      ...level(1, 0, 10),
      ...level(5, 9, 1),
      ...level(6, 8, 2),
      ...level(7, 9, 0, [kanji(799, 7, [701], { hidden: true })]),
    ],
    SYSTEMS,
  );

  it('is one pass to Guru when enough kanji are available at level start', () => {
    expect(times.get(5)).toBe(82 * HOUR_MS);
  });
  it('is two passes when locked kanji are needed', () => {
    expect(times.get(6)).toBe(164 * HOUR_MS);
  });
  it('uses the accelerated system at levels 1 and 2', () => {
    expect(times.get(1)).toBe(74 * HOUR_MS);
  });
  it('ignores hidden kanji', () => {
    expect(times.get(7)).toBe(82 * HOUR_MS);
  });
  it('sums a level range, end exclusive', () => {
    expect(sumMinLevelTimes(times, 5, 7)).toBe(246 * HOUR_MS);
  });
});
