import { describe, expect, it } from 'vitest';
import type { ReviewStatisticResource, SubjectType } from '../api/types';
import type { SnapshotDelta } from '../db/schema';
import { accuracy } from './accuracy';

function stat(
  subjectId: number,
  type: SubjectType,
  [mc, mi, rc, ri]: number[],
  hidden = false,
): ReviewStatisticResource {
  return {
    id: subjectId,
    object: 'review_statistic',
    url: '',
    data_updated_at: null,
    data: {
      created_at: '',
      hidden,
      meaning_correct: mc,
      meaning_incorrect: mi,
      meaning_current_streak: 1,
      meaning_max_streak: 1,
      reading_correct: rc,
      reading_incorrect: ri,
      reading_current_streak: 1,
      reading_max_streak: 1,
      percentage_correct: 0,
      subject_id: subjectId,
      subject_type: type,
    },
  };
}
function delta(date: string, subjectId: number, [mc, mi, rc, ri]: number[]): SnapshotDelta {
  return { date, subjectId, meaningCorrect: mc, meaningIncorrect: mi, readingCorrect: rc, readingIncorrect: ri };
}

const stats = [
  stat(1, 'kanji', [8, 2, 9, 1]),
  stat(2, 'radical', [5, 0, 0, 0]),
  stat(3, 'vocabulary', [100, 100, 100, 100], true),
];
const now = Date.UTC(2026, 9, 31, 12);
const week = ['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31'];

describe('lifetime accuracy', () => {
  const a = accuracy(stats, [], [], now);

  it('sums answers across meaning and reading, skipping hidden subjects', () => {
    expect(a.lifetime.question).toBeCloseTo(22 / 25);
    expect(a.lifetime.meaning).toBeCloseTo(13 / 15);
    expect(a.lifetime.reading).toBeCloseTo(9 / 10);
    expect(a.lifetime.answers).toBe(25);
  });

  it('estimates item accuracy per subject, radicals meaning only, weighted by reviews', () => {
    // Kanji 0.8 x 0.9 over 10 reviews, radical 1.0 over 5.
    expect(a.lifetime.itemEstimate).toBeCloseTo((0.72 * 10 + 5) / 15);
  });

  it('splits by subject type', () => {
    expect(a.lifetime.bySubjectType.radical.itemEstimate).toBe(1);
    expect(a.lifetime.bySubjectType.radical.reading).toBeNull();
    expect(a.lifetime.bySubjectType.kanji.question).toBeCloseTo(17 / 20);
    expect(a.lifetime.bySubjectType.vocabulary.question).toBeNull();
  });

  it('has no recent figures before a week of snapshots', () => {
    const b = accuracy(stats, week.slice(1).map((date) => ({ date })), [delta('2026-10-30', 1, [1, 0, 1, 0])], now);
    expect(b.recentAvailable).toBe(false);
    expect(b.recent7).toBeNull();
    expect(b.recent30).toBeNull();
  });
});

describe('recent accuracy', () => {
  const deltas = [
    delta('2026-10-25', 1, [3, 1, 4, 0]), // a merged gap row: counted once, in both windows
    delta('2026-10-24', 1, [1, 1, 0, 2]), // 30 days only
    delta('2026-10-01', 1, [0, 9, 0, 9]), // outside both
    delta('2025-09', 1, [0, 9, 0, 9]), // monthly roll-up
    delta('2026-10-30', 3, [0, 9, 0, 9]), // hidden subject
  ];
  const a = accuracy(stats, week.map((date) => ({ date })), deltas, now);

  it('windows deltas by snapshot date', () => {
    expect(a.recentAvailable).toBe(true);
    expect(a.recent7?.question).toBeCloseTo(7 / 8);
    expect(a.recent7?.itemEstimate).toBeCloseTo(0.75);
    expect(a.recent30?.question).toBeCloseTo(8 / 12);
    expect(a.recent30?.meaning).toBeCloseTo(4 / 6);
  });
});
