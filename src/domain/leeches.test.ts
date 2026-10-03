import { describe, expect, it } from 'vitest';
import type {
  AssignmentResource,
  KanjiResource,
  ReviewStatistic,
  ReviewStatisticResource,
  SubjectResource,
  SubjectType,
} from '../api/types';
import type { SnapshotDelta } from '../db/schema';
import { leechScore, leeches } from './leeches';

const DAY = 86_400_000;
const now = Date.UTC(2026, 9, 31, 12);
const iso = (ms: number) => new Date(ms).toISOString();

function stat(
  subjectId: number,
  type: SubjectType,
  s: Partial<ReviewStatistic> = {},
): ReviewStatisticResource {
  return {
    id: subjectId,
    object: 'review_statistic',
    url: '',
    data_updated_at: null,
    data: {
      created_at: '',
      hidden: false,
      meaning_correct: 10,
      meaning_incorrect: 0,
      meaning_current_streak: 1,
      meaning_max_streak: 1,
      reading_correct: 10,
      reading_incorrect: 0,
      reading_current_streak: 1,
      reading_max_streak: 1,
      percentage_correct: 0,
      subject_id: subjectId,
      subject_type: type,
      ...s,
    },
  };
}
function asg(subjectId: number, type: SubjectType, a: Partial<AssignmentResource['data']> = {}): AssignmentResource {
  return {
    id: 1000 + subjectId,
    object: 'assignment',
    url: '',
    data_updated_at: null,
    data: {
      available_at: null,
      burned_at: null,
      created_at: '',
      hidden: false,
      passed_at: null,
      resurrected_at: null,
      srs_stage: 3,
      started_at: iso(now - 30 * DAY),
      subject_id: subjectId,
      subject_type: type,
      unlocked_at: iso(now - 31 * DAY),
      ...a,
    },
  };
}
function kanji(id: number, similar: number[] = [], hidden = false): SubjectResource {
  return {
    id,
    object: 'kanji',
    url: '',
    data_updated_at: null,
    data: { visually_similar_subject_ids: similar, hidden_at: hidden ? '2026-01-01' : null },
  } as unknown as KanjiResource;
}
const bad = { meaning_incorrect: 5, reading_incorrect: 3, meaning_current_streak: 1, reading_current_streak: 1 };

describe('leechScore', () => {
  it('divides misses by the weaker streak to the power 1.5', () => {
    const s = stat(1, 'kanji', { meaning_incorrect: 5, reading_incorrect: 3, meaning_current_streak: 4, reading_current_streak: 2 });
    expect(leechScore(s.data)).toBeCloseTo(8 / 2 ** 1.5);
  });
  it('uses only the meaning streak for radicals', () => {
    const s = stat(1, 'radical', { meaning_incorrect: 3, meaning_current_streak: 4, reading_current_streak: 0 });
    expect(leechScore(s.data)).toBeCloseTo(3 / 8);
  });
  it('treats a zero streak as one', () => {
    expect(leechScore(stat(1, 'kanji', { meaning_incorrect: 2, meaning_current_streak: 0 }).data)).toBe(2);
  });
});

describe('leeches', () => {
  it('includes score >= 1, not burned, lesson over 7 days ago, not hidden', () => {
    const r = leeches({
      subjects: [kanji(6, [], true)],
      assignments: [
        asg(1, 'kanji'),
        asg(2, 'kanji'),
        asg(3, 'kanji', { srs_stage: 9, burned_at: iso(now) }),
        asg(4, 'kanji', { started_at: iso(now - 6 * DAY) }),
        asg(5, 'kanji', { hidden: true }),
        asg(6, 'kanji'),
      ],
      stats: [
        stat(1, 'kanji', bad),
        stat(2, 'kanji', { meaning_incorrect: 1, meaning_current_streak: 2, reading_current_streak: 2 }),
        stat(3, 'kanji', bad),
        stat(4, 'kanji', bad),
        stat(5, 'kanji', bad),
        stat(6, 'kanji', bad),
      ],
      snapshots: [],
      deltas: [],
      now,
    });
    expect(r.recentAvailable).toBe(false);
    expect(r.leeches.map((l) => l.subjectId)).toEqual([1]);
    expect(r.leeches[0]).toMatchObject({ score: 8, incorrect: 8, recentMisses: null, recentlyStruggling: false });
  });

  it('counts misses in the last 14 days and sorts recently struggling first', () => {
    const snapshots = Array.from({ length: 14 }, (_, i) => ({ date: `2026-10-${18 + i}` }));
    const deltas: SnapshotDelta[] = [
      { date: '2026-10-20', subjectId: 2, meaningCorrect: 0, meaningIncorrect: 1, readingCorrect: 0, readingIncorrect: 2 },
      { date: '2026-10-17', subjectId: 1, meaningCorrect: 0, meaningIncorrect: 5, readingCorrect: 0, readingIncorrect: 0 },
    ];
    const r = leeches({
      subjects: [],
      assignments: [asg(1, 'kanji'), asg(2, 'vocabulary')],
      stats: [
        stat(1, 'kanji', { ...bad, meaning_incorrect: 20 }),
        stat(2, 'vocabulary', bad),
      ],
      snapshots,
      deltas,
      now,
    });
    expect(r.recentAvailable).toBe(true);
    expect(r.leeches.map((l) => [l.subjectId, l.recentMisses, l.recentlyStruggling])).toEqual([
      [2, 3, true],
      [1, 0, false],
    ]);
  });

  it('lists look-alikes, leeches first, then unlocked, then the rest', () => {
    const r = leeches({
      subjects: [kanji(1, [10, 11, 12, 13]), kanji(10), kanji(11), kanji(12), kanji(13, [], true)],
      assignments: [asg(1, 'kanji'), asg(11, 'kanji'), asg(12, 'kanji')],
      stats: [stat(1, 'kanji', bad), stat(12, 'kanji', bad)],
      snapshots: [],
      deltas: [],
      now,
    });
    expect(r.leeches.find((l) => l.subjectId === 1)?.lookAlikeIds).toEqual([12, 11, 10]);
  });
});
