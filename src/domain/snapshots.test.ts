import { describe, expect, test } from 'vitest';
import type {
  AssignmentResource,
  ReviewStatisticResource,
  SubjectResource,
  SubjectType,
  User,
} from '../api/types';
import type { Snapshot, SnapshotDelta } from '../db/schema';
import {
  buildSnapshot,
  computeDeltas,
  countersBySubject,
  daysSinceLastSnapshot,
  localDateKey,
  reviewsPerDay,
  rollUpDeltas,
  shiftDate,
  snapshotSpans,
} from './snapshots';

const T = Date.parse('2026-10-03T14:02:00Z');

function assignment(
  subjectId: number,
  type: SubjectType,
  stage: number,
  extra: Partial<AssignmentResource['data']> = {},
): AssignmentResource {
  return {
    id: subjectId + 1000,
    object: 'assignment',
    url: '',
    data_updated_at: null,
    data: {
      available_at: null,
      burned_at: null,
      created_at: '2026-01-01T00:00:00Z',
      hidden: false,
      passed_at: stage >= 5 ? '2026-02-01T00:00:00Z' : null,
      resurrected_at: null,
      srs_stage: stage,
      started_at: stage > 0 ? '2026-01-02T00:00:00Z' : null,
      subject_id: subjectId,
      subject_type: type,
      unlocked_at: '2026-01-01T00:00:00Z',
      ...extra,
    },
  };
}

function stat(subjectId: number, mc: number, mi: number, rc: number, ri: number, hidden = false) {
  return {
    id: subjectId + 2000,
    object: 'review_statistic',
    url: '',
    data_updated_at: null,
    data: {
      created_at: '2026-01-01T00:00:00Z',
      hidden,
      meaning_correct: mc,
      meaning_incorrect: mi,
      meaning_current_streak: 0,
      meaning_max_streak: 0,
      percentage_correct: 0,
      reading_correct: rc,
      reading_incorrect: ri,
      reading_current_streak: 0,
      reading_max_streak: 0,
      subject_id: subjectId,
      subject_type: 'kanji',
    },
  } satisfies ReviewStatisticResource;
}

function subject(id: number, hidden = false): SubjectResource {
  return {
    id,
    object: 'kanji',
    url: '',
    data_updated_at: null,
    data: { hidden_at: hidden ? '2026-01-01T00:00:00Z' : null, level: 1 },
  } as SubjectResource;
}

const user = { level: 7 } as User;

describe('localDateKey and shiftDate', () => {
  test('formats local time (TZ is UTC in tests)', () => {
    expect(localDateKey(Date.parse('2026-01-05T23:59:59Z'))).toBe('2026-01-05');
    expect(localDateKey(Date.parse('2026-01-06T00:00:00Z'))).toBe('2026-01-06');
  });
  test('shifts across months and years', () => {
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDate('2025-12-31', 1)).toBe('2026-01-01');
    expect(shiftDate('2026-10-03', -400)).toBe('2025-08-29');
  });
});

describe('buildSnapshot', () => {
  test('counts stages, load, lessons, passed items and review totals', () => {
    const assignments = [
      assignment(1, 'radical', 1),
      assignment(2, 'kanji', 4),
      assignment(3, 'kanji', 5),
      assignment(4, 'vocabulary', 6),
      assignment(5, 'kana_vocabulary', 9),
      assignment(6, 'kanji', 0), // lesson available
      assignment(7, 'kanji', 0, { unlocked_at: null }), // locked: not a lesson
      assignment(8, 'kanji', 7, { hidden: true }),
      assignment(9, 'kanji', 8), // subject hidden
      assignment(10, 'radical', 5), // passed radical counts in neither total
    ];
    const subjects = [1, 2, 3, 4, 5, 6, 7, 8, 10].map((id) => subject(id)).concat(subject(9, true));
    const stats = [stat(2, 3, 1, 2, 2), stat(3, 5, 0, 5, 1), stat(9, 100, 100, 100, 100, true)];

    const s = buildSnapshot(assignments, stats, subjects, user, T);
    expect(s).toEqual<Snapshot>({
      date: '2026-10-03',
      takenAt: '2026-10-03T14:02:00.000Z',
      stages: { a1: 1, a2: 0, a3: 0, a4: 1, g1: 2, g2: 1, m: 0, e: 0, b: 1 },
      load: 2 + 3 / 10,
      lessonsAvailable: 1,
      reviews: { meaningCorrect: 8, meaningIncorrect: 1, readingCorrect: 7, readingIncorrect: 3 },
      passedKanji: 1,
      passedVocab: 2,
      level: 7,
    });
  });
});

describe('computeDeltas', () => {
  test('emits rows only for subjects whose counters changed', () => {
    const prev = countersBySubject([stat(1, 1, 0, 1, 0), stat(2, 4, 4, 4, 4)]);
    const cur = countersBySubject([stat(1, 2, 1, 1, 0), stat(2, 4, 4, 4, 4), stat(3, 1, 0, 0, 1)]);
    expect(computeDeltas(prev, cur, '2026-10-03')).toEqual<SnapshotDelta[]>([
      {
        date: '2026-10-03',
        subjectId: 1,
        meaningCorrect: 1,
        meaningIncorrect: 1,
        readingCorrect: 0,
        readingIncorrect: 0,
      },
      {
        date: '2026-10-03',
        subjectId: 3,
        meaningCorrect: 1,
        meaningIncorrect: 0,
        readingCorrect: 0,
        readingIncorrect: 1,
      },
    ]);
  });

  test('never emits negative deltas', () => {
    const prev = countersBySubject([stat(1, 5, 5, 5, 5)]);
    const cur = countersBySubject([stat(1, 3, 6, 5, 5)]);
    expect(computeDeltas(prev, cur, 'd')[0]).toMatchObject({
      meaningCorrect: 0,
      meaningIncorrect: 1,
    });
  });
});

const snap = (date: string) => ({ date }) as Snapshot;

describe('snapshotSpans', () => {
  test('each snapshot covers the days since the previous one', () => {
    expect(snapshotSpans([snap('2026-10-05'), snap('2026-10-01'), snap('2026-10-02')])).toEqual([
      { date: '2026-10-01', from: '2026-10-01', days: 1 },
      { date: '2026-10-02', from: '2026-10-02', days: 1 },
      { date: '2026-10-05', from: '2026-10-03', days: 3 },
    ]);
  });
});

function delta(date: string, subjectId: number, mc: number, rc = 0, mi = 0, ri = 0): SnapshotDelta {
  return {
    date,
    subjectId,
    meaningCorrect: mc,
    meaningIncorrect: mi,
    readingCorrect: rc,
    readingIncorrect: ri,
  };
}

describe('reviewsPerDay', () => {
  test('counts subjects with a correct delta and spreads merged spans', () => {
    const snaps = [snap('2026-10-01'), snap('2026-10-02'), snap('2026-10-05')];
    const deltas = [
      delta('2026-10-02', 1, 1),
      delta('2026-10-02', 2, 0, 1),
      delta('2026-10-02', 3, 0, 0, 1), // only a miss
      delta('2026-10-05', 1, 1),
      delta('2026-10-05', 2, 1),
      delta('2026-10-05', 4, 1),
    ];
    expect(reviewsPerDay(snaps, deltas)).toEqual([
      { date: '2026-10-01', from: '2026-10-01', days: 1, reviews: 0, perDay: 0 },
      { date: '2026-10-02', from: '2026-10-02', days: 1, reviews: 2, perDay: 2 },
      { date: '2026-10-05', from: '2026-10-03', days: 3, reviews: 3, perDay: 1 },
    ]);
  });
});

describe('rollUpDeltas', () => {
  test('merges rows older than 400 days into monthly rows per subject', () => {
    const today = '2026-10-03'; // cutoff 2025-08-29
    const rows = [
      delta('2025-07', 1, 10), // existing monthly row
      delta('2025-07-30', 1, 1, 2, 3, 4),
      delta('2025-08-01', 1, 1),
      delta('2025-08-02', 1, 2),
      delta('2025-08-02', 2, 5),
      delta('2025-08-29', 1, 7), // exactly 400 days: kept
      delta('2026-10-03', 1, 9),
    ];
    const out = rollUpDeltas(rows, today);
    const key = (d: SnapshotDelta) => `${d.date}#${d.subjectId}`;
    expect(out.toSorted((a, b) => (key(a) < key(b) ? -1 : 1))).toEqual([
      delta('2025-07', 1, 11, 2, 3, 4),
      delta('2025-08', 1, 3),
      delta('2025-08', 2, 5),
      delta('2025-08-29', 1, 7),
      delta('2026-10-03', 1, 9),
    ]);
  });
});

describe('daysSinceLastSnapshot', () => {
  test('uses the latest snapshot before today', () => {
    const snaps = [snap('2026-09-28'), snap('2026-09-29'), snap('2026-10-03')];
    expect(daysSinceLastSnapshot(snaps, T)).toEqual({ since: '2026-09-29', days: 4 });
  });
  test('null without an earlier snapshot', () => {
    expect(daysSinceLastSnapshot([snap('2026-10-03')], T)).toBeNull();
  });
});
