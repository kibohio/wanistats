import Dexie from 'dexie';
import { afterEach, expect, test } from 'vitest';
import { openDb, openPacksDb, type Snapshot } from './schema';

afterEach(() => Promise.all(['wanistats-sample', 'wanistats-packs'].map((n) => Dexie.delete(n))));

test('opens the app schema and round-trips key shapes', async () => {
  const db = openDb('wanistats-sample');
  await db.auth.put('t0ken', 'token');
  await db.snapshotDeltas.bulkPut([
    {
      date: '2026-10-01',
      subjectId: 7,
      meaningCorrect: 1,
      meaningIncorrect: 0,
      readingCorrect: 1,
      readingIncorrect: 1,
    },
    {
      date: '2026-10-02',
      subjectId: 7,
      meaningCorrect: 2,
      meaningIncorrect: 0,
      readingCorrect: 0,
      readingIncorrect: 0,
    },
  ]);
  const snap: Snapshot = {
    date: '2026-10-02',
    takenAt: '2026-10-02T05:02:00.000Z',
    stages: { a1: 1, a2: 2, a3: 3, a4: 4, g1: 5, g2: 6, m: 7, e: 8, b: 9 },
    load: 11.1,
    lessonsAvailable: 0,
    reviews: { meaningCorrect: 10, meaningIncorrect: 1, readingCorrect: 9, readingIncorrect: 2 },
    passedKanji: 3,
    passedVocab: 4,
    level: 5,
  };
  await db.snapshots.put(snap);

  expect(await db.auth.get('token')).toBe('t0ken');
  expect(await db.snapshots.get('2026-10-02')).toEqual(snap);
  const oct2 = await db.snapshotDeltas
    .where('[date+subjectId]')
    .between(['2026-10-02', Dexie.minKey], ['2026-10-02', Dexie.maxKey])
    .toArray();
  expect(oct2.map((d) => d.meaningCorrect)).toEqual([2]);
  db.close();
});

test('packs live in their own database', async () => {
  const db = openPacksDb();
  await db.packs.put({ id: 'kanji', version: '1', data: {}, bytes: 10, installedAt: 'x' });
  expect(db.name).toBe('wanistats-packs');
  expect(await db.packs.count()).toBe(1);
  db.close();
});
