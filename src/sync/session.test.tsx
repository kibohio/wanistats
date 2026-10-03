import { QueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import type { User } from '../api/types';
import { useHistoryRange } from '../db/hooks';
import type { Snapshot } from '../db/schema';
import { packsDb } from '../packs/packs';
import { accountDb, sampleDb, sessionDb, useAppMode, useDb } from '../db/useAppMode';
import { exportHistory as buildHistoryFile } from '../domain/historyFile';
import {
  deleteHistory,
  deleteLocalData,
  importHistory,
  logout,
  readHistoryFile,
  saveLogin,
} from './session';

function Mode() {
  const db = useDb();
  const days = useHistoryRange()?.days;
  return (
    <p>
      {useAppMode()} {db.name} {days}
    </p>
  );
}

const user = (id: string) => ({ id, username: `user-${id}`, level: 3 }) as User;

afterEach(async () => {
  for (const db of [sessionDb, accountDb('a'), accountDb('b'), packsDb]) {
    await db.delete({ disableAutoOpen: false });
  }
});

test('logout keeps account data and packs; logging in again resumes it', async () => {
  await packsDb.packs.put({ id: 'kanji', version: '1', data: {}, bytes: 1, installedAt: 'x' });
  const qc = new QueryClient();
  qc.setQueryData(['x'], 1);
  render(<Mode />);
  expect(await screen.findByText(/^sample wanistats-sample/)).toBeInTheDocument();

  await saveLogin('tok', user('a'));
  await accountDb('a').snapshots.put(snap('2026-10-01', '2026-10-01T08:00:00Z', 1));
  expect(await screen.findByText('live wanistats-a 1')).toBeInTheDocument();

  await logout(qc);
  expect(await screen.findByText(/^sample wanistats-sample/)).toBeInTheDocument();
  expect(await sessionDb.auth.count()).toBe(0);
  expect(await accountDb('a').snapshots.count()).toBe(1);
  expect(qc.getQueryData(['x'])).toBeUndefined();
  expect(await packsDb.packs.count()).toBe(1);

  await saveLogin('tok', user('a'));
  expect(await screen.findByText('live wanistats-a 1')).toBeInTheDocument();
});

test('logging in as someone else leaves the first account intact; switching back shows it', async () => {
  render(<Mode />);
  await saveLogin('tok', user('a'));
  await accountDb('a').snapshots.put(snap('2026-10-01', '2026-10-01T08:00:00Z', 1));
  expect(await screen.findByText('live wanistats-a 1')).toBeInTheDocument();

  await saveLogin('tok2', user('b'));
  expect(await screen.findByText('live wanistats-b 0')).toBeInTheDocument();
  expect(await accountDb('a').snapshots.count()).toBe(1);
  expect(await sessionDb.auth.get('token')).toBe('tok2');
  expect((await sessionDb.accounts.toArray()).map((a) => a.userId)).toEqual(['a', 'b']);

  await saveLogin('tok', user('a'));
  expect(await screen.findByText('live wanistats-a 1')).toBeInTheDocument();
});

test('delete local data removes every account, the session and packs', async () => {
  render(<Mode />);
  await saveLogin('tok', user('a'));
  await saveLogin('tok2', user('b'));
  await accountDb('a').snapshots.put(snap('2026-10-01', '2026-10-01T08:00:00Z', 1));
  await packsDb.packs.put({ id: 'kanji', version: '1', data: {}, bytes: 1, installedAt: 'x' });
  localStorage.setItem('wanistats:theme', 'dark');

  await deleteLocalData(new QueryClient());
  expect(await screen.findByText(/^sample wanistats-sample/)).toBeInTheDocument();
  expect(await sessionDb.accounts.count()).toBe(0);
  expect(await sessionDb.auth.count()).toBe(0);
  expect(await accountDb('a').snapshots.count()).toBe(0);
  expect(await accountDb('b').user.count()).toBe(0);
  expect(await packsDb.packs.count()).toBe(0);
  expect(await sampleDb.subjects.count()).toBeGreaterThan(0);
  expect(localStorage.getItem('wanistats:theme')).toBeNull();
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
  await saveLogin('tok', user('a'));
  const liveDb = accountDb('a');
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

  expect(await importHistory(readHistoryFile(JSON.stringify(file)))).toEqual({ days: 2 });
  expect((await liveDb.snapshots.toArray()).map((s) => [s.date, s.level])).toEqual([
    ['2026-09-30', 2],
    ['2026-10-02', 2],
  ]);
  expect((await liveDb.snapshotDeltas.toArray()).map((d) => d.subjectId)).toEqual([7]);
  expect((await liveDb.meta.get('firstSnapshotDate'))?.value).toBe('2026-09-30');
  expect((await liveDb.meta.get('snapshotBaseline'))?.value).toEqual({ 1: counters });

  expect(() => readHistoryFile('not json')).toThrow('not a WaniStats history export');
  expect(await liveDb.snapshots.count()).toBe(2);

  await deleteHistory();
  expect(await liveDb.snapshots.count()).toBe(0);
  expect(await liveDb.snapshotDeltas.count()).toBe(0);
  expect(await liveDb.meta.get('firstSnapshotDate')).toBeUndefined();
});
