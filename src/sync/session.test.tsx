import { QueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import Dexie from 'dexie';
import { expect, test } from 'vitest';
import type { User } from '../api/types';
import { openPacksDb } from '../db/schema';
import { liveDb, useAppMode } from '../db/useAppMode';
import type { Snapshot } from '../db/schema';
import { exportHistory as buildHistoryFile } from '../domain/historyFile';
import { deleteHistory, importHistory, logout, saveLogin } from './session';

function Mode() {
  return <p>{useAppMode()}</p>;
}

const user = (id: string) => ({ id, username: 'kibo', level: 3 }) as User;

test('login and logout flip the app mode without a reload; packs survive logout', async () => {
  const packs = openPacksDb();
  await packs.packs.put({ id: 'kanji', version: '1', data: {}, bytes: 1, installedAt: 'x' });
  const qc = new QueryClient();
  qc.setQueryData(['x'], 1);
  render(<Mode />);
  expect(await screen.findByText('sample')).toBeInTheDocument();

  await saveLogin('tok', user('a'));
  expect(await screen.findByText('live')).toBeInTheDocument();
  await liveDb.snapshots.put({ date: '2026-10-01' } as never);

  await logout(qc);
  expect(await screen.findByText('sample')).toBeInTheDocument();
  expect(await liveDb.snapshots.count()).toBe(0);
  expect(qc.getQueryData(['x'])).toBeUndefined();
  expect(await packs.packs.count()).toBe(1);

  await saveLogin('tok', user('a'));
  expect(await screen.findByText('live')).toBeInTheDocument();
  await logout(qc);
  packs.close();
  await Dexie.delete('wanistats-packs');
});

test('logging in as someone else wipes the previous account first', async () => {
  await saveLogin('tok', user('a'));
  await liveDb.subjects.put({ id: 1 } as never);
  await saveLogin('tok', user('a'));
  expect(await liveDb.subjects.count()).toBe(1);
  await saveLogin('tok2', user('b'));
  expect(await liveDb.subjects.count()).toBe(0);
  expect(await liveDb.auth.get('token')).toBe('tok2');
  await liveDb.delete({ disableAutoOpen: false });
});

const snap = (date: string, takenAt: string, level: number): Snapshot => ({
  date,
  takenAt,
  stages: { a1: 1, a2: 0, a3: 0, a4: 0, g1: 0, g2: 0, m: 0, e: 0, b: 0 },
  load: 1,
  lessonsAvailable: 0,
  reviews: { meaningCorrect: 1, meaningIncorrect: 0, readingCorrect: 0, readingIncorrect: 0 },
  passedKanji: 0,
  passedVocab: 0,
  level,
});
const counters = { meaningCorrect: 1, meaningIncorrect: 0, readingCorrect: 0, readingIncorrect: 0 };

test('import merges into history, moves the first date back and keeps the baseline', async () => {
  await liveDb.snapshots.put(snap('2026-10-02', '2026-10-02T08:00:00Z', 1));
  await liveDb.snapshotDeltas.put({ date: '2026-10-02', subjectId: 1, ...counters });
  await liveDb.meta.bulkPut([
    { key: 'firstSnapshotDate', value: '2026-10-02' },
    { key: 'snapshotBaseline', value: { 1: counters } },
  ]);
  const file = buildHistoryFile(
    [snap('2026-09-30', '2026-09-30T08:00:00Z', 2), snap('2026-10-02', '2026-10-02T09:00:00Z', 2)],
    [{ date: '2026-10-02', subjectId: 7, ...counters }],
    0,
  );

  expect(await importHistory(JSON.stringify(file))).toEqual({ days: 2 });
  expect((await liveDb.snapshots.toArray()).map((s) => [s.date, s.level])).toEqual([
    ['2026-09-30', 2],
    ['2026-10-02', 2],
  ]);
  expect((await liveDb.snapshotDeltas.toArray()).map((d) => d.subjectId)).toEqual([7]);
  expect((await liveDb.meta.get('firstSnapshotDate'))?.value).toBe('2026-09-30');
  expect((await liveDb.meta.get('snapshotBaseline'))?.value).toEqual({ 1: counters });

  await expect(importHistory('not json')).rejects.toThrow('not a WaniStats history export');
  expect(await liveDb.snapshots.count()).toBe(2);

  await deleteHistory();
  expect(await liveDb.snapshots.count()).toBe(0);
  expect(await liveDb.snapshotDeltas.count()).toBe(0);
  expect(await liveDb.meta.get('firstSnapshotDate')).toBeUndefined();
  await liveDb.delete({ disableAutoOpen: false });
});
