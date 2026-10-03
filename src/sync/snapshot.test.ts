import Dexie from 'dexie';
import { afterEach, beforeEach, expect, test } from 'vitest';
import type { AssignmentResource, ReviewStatisticResource, User } from '../api/types';
import { openDb, type SnapshotDelta, type WaniStatsDb } from '../db/schema';
import { writeDailySnapshot } from './snapshot';

let db: WaniStatsDb;
beforeEach(() => {
  db = openDb('wanistats-sample');
});
afterEach(async () => {
  db.close();
  await Dexie.delete('wanistats-sample');
});

const at = (iso: string) => Date.parse(iso);

function stat(subjectId: number, meaningCorrect: number, readingIncorrect = 0) {
  return {
    id: subjectId,
    object: 'review_statistic',
    data: {
      subject_id: subjectId,
      subject_type: 'kanji',
      hidden: false,
      meaning_correct: meaningCorrect,
      meaning_incorrect: 0,
      reading_correct: 0,
      reading_incorrect: readingIncorrect,
    },
  } as ReviewStatisticResource;
}

async function seed(stats: ReviewStatisticResource[]) {
  await db.user.put({ level: 3 } as User, 'me');
  await db.assignments.put({
    id: 1,
    object: 'assignment',
    data: {
      subject_id: 1,
      subject_type: 'kanji',
      srs_stage: 2,
      hidden: false,
      unlocked_at: 'x',
      started_at: 'x',
    },
  } as AssignmentResource);
  await db.reviewStatistics.bulkPut(stats);
}

const deltasOn = (date: string) =>
  db.snapshotDeltas
    .where('[date+subjectId]')
    .between([date, Dexie.minKey], [date, Dexie.maxKey])
    .toArray();

test('first snapshot of a day writes a baseline only; later syncs that day do nothing', async () => {
  await seed([stat(1, 5)]);
  expect(await writeDailySnapshot(db, at('2026-10-01T08:00:00Z'))).toBe('written');
  expect(await db.snapshots.get('2026-10-01')).toMatchObject({ level: 3, load: 1 });
  expect(await db.snapshotDeltas.count()).toBe(0);
  expect((await db.meta.get('firstSnapshotDate'))?.value).toBe('2026-10-01');

  await db.reviewStatistics.put(stat(1, 9));
  expect(await writeDailySnapshot(db, at('2026-10-01T23:00:00Z'))).toBe('exists');
  expect(await db.snapshotDeltas.count()).toBe(0);
});

test('a 3-day gap merges into one delta set on the next snapshot', async () => {
  await seed([stat(1, 5), stat(2, 1)]);
  await writeDailySnapshot(db, at('2026-10-01T08:00:00Z'));

  // Reviews happen on 2, 3 and 4 Oct, but the app is next opened on 4 Oct.
  await db.reviewStatistics.bulkPut([stat(1, 8, 2), stat(2, 1), stat(3, 1)]);
  expect(await writeDailySnapshot(db, at('2026-10-04T09:00:00Z'))).toBe('written');

  expect(await deltasOn('2026-10-04')).toEqual<SnapshotDelta[]>([
    {
      date: '2026-10-04',
      subjectId: 1,
      meaningCorrect: 3,
      meaningIncorrect: 0,
      readingCorrect: 0,
      readingIncorrect: 2,
    },
    {
      date: '2026-10-04',
      subjectId: 3,
      meaningCorrect: 1,
      meaningIncorrect: 0,
      readingCorrect: 0,
      readingIncorrect: 0,
    },
  ]);
  expect(await db.snapshots.toCollection().primaryKeys()).toEqual(['2026-10-01', '2026-10-04']);
  expect((await db.meta.get('firstSnapshotDate'))?.value).toBe('2026-10-01');

  // The baseline moved: the next day diffs against 4 Oct, not 1 Oct.
  await db.reviewStatistics.put(stat(1, 9, 2));
  await writeDailySnapshot(db, at('2026-10-05T09:00:00Z'));
  expect((await deltasOn('2026-10-05')).map((d) => [d.subjectId, d.meaningCorrect])).toEqual([
    [1, 1],
  ]);
});

test('rolls deltas older than 400 days into monthly rows', async () => {
  await seed([stat(1, 5)]);
  await writeDailySnapshot(db, at('2026-10-01T08:00:00Z'));
  const old = (date: string, subjectId: number, mc: number): SnapshotDelta => ({
    date,
    subjectId,
    meaningCorrect: mc,
    meaningIncorrect: 0,
    readingCorrect: 0,
    readingIncorrect: 0,
  });
  await db.snapshotDeltas.bulkPut([
    old('2025-06-01', 1, 1),
    old('2025-06-20', 1, 2),
    old('2025-09-01', 1, 4),
  ]);

  await db.reviewStatistics.put(stat(1, 6));
  await writeDailySnapshot(db, at('2026-10-02T08:00:00Z'));

  const rows = await db.snapshotDeltas.toArray();
  expect(rows.map((r) => [r.date, r.meaningCorrect])).toEqual([
    ['2025-06', 3],
    ['2025-09-01', 4],
    ['2026-10-02', 1],
  ]);
});
