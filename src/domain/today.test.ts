import { describe, expect, it } from 'vitest';
import type { AssignmentResource, SubjectResource } from '../api/types';
import type { KanjiPack } from './coverage';
import { earliestLevelUp } from './levelUp';
import { HOUR_MS } from './srs';
import { assignment, kanji, radical, SYSTEMS, T0, user } from './test/fixtures';
import {
  coverageSummary,
  gapNotice,
  gaugeMax,
  levelUpGroups,
  orderedKanji,
  overridesFromPrefs,
  peakBin,
  radicalProgress,
  reviewsAvailableNow,
  trendPoints,
} from './today';

const h = (n: number) => T0 + n * HOUR_MS;
const now = h(10.5);

function scenario() {
  const ks = Array.from({ length: 10 }, (_, i) => kanji(10 + i, 3, i === 9 ? [2] : [1]));
  const subjects: SubjectResource[] = [radical(1, 3), radical(2, 3), ...ks];
  const assignments: AssignmentResource[] = [
    ...ks.slice(0, 4).map((k) => assignment(k, { stage: 5, passedAt: h(-50) })),
    assignment(ks[4], { stage: 2, availableAt: h(14) }),
    assignment(ks[5], { stage: 2, availableAt: h(14) }),
    assignment(ks[6], { stage: 4, availableAt: h(8) }), // overdue
    assignment(ks[7], { stage: 3, availableAt: h(20) }),
    assignment(ks[8]), // lesson
    // ks[9] locked behind radical 2 (in lessons)
    assignment(subjects[0], { stage: 5, passedAt: h(-60) }),
    assignment(subjects[1]),
  ];
  const p = earliestLevelUp({ user: user(3), subjects, assignments, systems: SYSTEMS, now });
  return { ks, subjects, assignments, p };
}

describe('levelUpGroups', () => {
  it('groups unpassed kanji by next review and stage, overdue at the current hour', () => {
    const { ks, subjects, p } = scenario();
    const groups = levelUpGroups(p, subjects, SYSTEMS, now);
    expect(groups.map((g) => [g.kind, g.at, g.stage, g.subjectIds])).toEqual([
      ['review', h(10), 4, [ks[6].id]],
      ['review', h(14), 2, [ks[4].id, ks[5].id]],
      ['review', h(20), 3, [ks[7].id]],
      ['lesson', null, 0, [ks[8].id]],
      ['locked', null, null, [ks[9].id]],
    ]);
    expect(groups.map((g) => g.reviewsToGuru)).toEqual([1, 3, 2, 4, 4]);
  });

  it('marks the group holding the k-th kanji as decisive and counts critical kanji', () => {
    const { subjects, p } = scenario();
    // 10 kanji: needed 9, passed 4, k 5. Order: 14:00 x2, overdue A4, 20:00 A3, lesson, locked.
    expect(p.k).toBe(5);
    const groups = levelUpGroups(p, subjects, SYSTEMS, now);
    expect(groups.map((g) => g.critical)).toEqual([1, 2, 1, 1, 0]);
    expect(groups.map((g) => g.decisive)).toEqual([false, false, false, true, false]);
  });
});

describe('orderedKanji', () => {
  it('puts passed kanji first, then unpassed by earliest Guru', () => {
    const { ks, p } = scenario();
    const ids = orderedKanji(p).map((k) => k.subjectId);
    expect(ids.slice(0, 4)).toEqual(ks.slice(0, 4).map((k) => k.id));
    expect(ids.slice(4, 6)).toEqual([ks[6].id, ks[7].id]);
    expect(ids.at(-1)).toBe(ks[9].id);
  });
});

describe('radicalProgress', () => {
  it('counts current-level radicals at Guru', () => {
    const { subjects, assignments } = scenario();
    expect(radicalProgress(subjects, assignments, 3)).toEqual({ passed: 1, total: 2 });
  });
});

describe('gaugeMax', () => {
  it('spans the band with room either side, growing in steps of 50 for heavy loads', () => {
    expect(gaugeMax(124, { min: 100, max: 150 })).toBe(250);
    expect(gaugeMax(301, { min: 100, max: 150 })).toBe(350);
  });
});

describe('peakBin', () => {
  it('finds the heaviest bin, or null when all are empty', () => {
    expect(peakBin([{ total: 0 }, { total: 9 }, { total: 9 }, { total: 3 }])).toEqual({
      index: 1,
      total: 9,
    });
    expect(peakBin([{ total: 0 }])).toBeNull();
  });
});

describe('reviewsAvailableNow', () => {
  it('counts started, unburned, visible reviews that are due', () => {
    const k = kanji(1, 1);
    const list = [
      assignment(k, { stage: 2, availableAt: h(9) }),
      assignment(k, { stage: 2, availableAt: h(11) }),
      assignment(k, { stage: 9, availableAt: h(1) }),
      assignment(k, { stage: 2, availableAt: h(1) }, { hidden: true }),
      assignment(k),
    ];
    expect(reviewsAvailableNow(list, now)).toBe(1);
  });
});

describe('overridesFromPrefs', () => {
  it('maps saved booleans to include and exclude', () => {
    expect(overridesFromPrefs({ 3: true, 7: false })).toEqual({ 3: 'include', 7: 'exclude' });
  });
});

describe('gapNotice', () => {
  const at = new Date(2026, 9, 3, 12).getTime();
  it('appears when the last snapshot before today is more than 3 days old', () => {
    expect(gapNotice([{ date: '2026-09-29' }, { date: '2026-10-03' }], at)).toBe('2026-09-29');
    expect(gapNotice([{ date: '2026-09-30' }, { date: '2026-10-03' }], at)).toBeNull();
    expect(gapNotice([{ date: '2026-10-03' }], at)).toBeNull();
  });
});

describe('trendPoints', () => {
  it('places each snapshot by its date in the 30-day window, scaled to its range', () => {
    const at = new Date(2026, 9, 30, 12).getTime();
    const t = trendPoints(
      [
        { from: '2026-10-01', to: '2026-10-01', load: 100 },
        { from: '2026-10-02', to: '2026-10-30', load: 150 },
      ],
      at,
      { width: 290, height: 20 },
    );
    expect(t).toEqual({ points: '0,20 290,0', min: 100, max: 150 });
  });
});

describe('coverageSummary', () => {
  it('reports JLPT groups, Joyo share and weighted coverage', () => {
    const subjects = [kanji(1, 1), kanji(2, 1)];
    subjects[0].data.characters = '人';
    subjects[1].data.characters = '見';
    const assignments = [assignment(subjects[0], { stage: 5, passedAt: h(-1) })];
    const pack: KanjiPack = {
      chars: ['人', '見', '言'],
      rank: [1, 1, 1],
      grade: [1, 1, 9],
      strokes: [2, 7, 7],
      jlpt: [5, 5, 4],
    };
    const c = coverageSummary(subjects, assignments, pack);
    expect(c.jlpt.map((g) => [g.label, g.known, g.total])).toEqual([
      ['N5', 1, 2],
      ['N4', 0, 1],
      ['N3', 0, 0],
      ['N2', 0, 0],
      ['N1', 0, 0],
    ]);
    expect(c.joyo).toEqual({ known: 1, total: 2, pct: 50 });
    expect(c.weighted.pct).toBeCloseTo((100 * 1) / (1 + 1 / 2 + 1 / 3));
  });
});
