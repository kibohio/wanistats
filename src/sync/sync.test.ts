import Dexie from 'dexie';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { WK_API } from '../config';
import { openDb, type WaniStatsDb } from '../db/schema';
import { clearCachedData, nextHourlyRun, syncAll, type SyncProgress } from './sync';

let db: WaniStatsDb;
const fetchMock = vi.fn<typeof fetch>();
const updated = '2026-10-01T10:00:00.000000Z';

function collection(ids: number[], object: string) {
  return {
    object: 'collection',
    url: '',
    pages: { per_page: 500, next_url: null, previous_url: null },
    total_count: ids.length,
    data_updated_at: ids.length ? updated : null,
    data: ids.map((id) => ({ id, object, url: '', data_updated_at: updated, data: { level: 1 } })),
  };
}

const routes: Record<string, () => unknown> = {
  user: () => ({ object: 'user', url: '', data_updated_at: updated, data: { username: 'kibo' } }),
  subjects: () => collection([1, 2], 'kanji'),
  assignments: () => collection([10], 'assignment'),
  review_statistics: () => collection([20], 'review_statistic'),
  level_progressions: () => collection([30], 'level_progression'),
  resets: () => collection([], 'reset'),
  spaced_repetition_systems: () => collection([1], 'spaced_repetition_system'),
};

beforeEach(async () => {
  db = openDb('wanistats');
  await db.auth.put('tok', 'token');
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockImplementation((url) => {
    const path = new URL(String(url)).pathname.replace('/v2/', '');
    return Promise.resolve(
      new Response(JSON.stringify(routes[path]!()), { headers: { ETag: `"${path}"` } }),
    );
  });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  db.close();
  await Dexie.delete('wanistats');
});

test('first sync stores every collection as returned and reports the five steps', async () => {
  const steps: string[] = [];
  await syncAll(db, (p: SyncProgress) => {
    if (steps.at(-1) !== p.label) steps.push(p.label);
  });
  expect(steps).toEqual([
    'Your profile',
    'Kanji and vocabulary',
    'Your progress',
    'Your accuracy',
    'Your levels',
  ]);
  expect(await db.user.get('me')).toEqual({ username: 'kibo' });
  expect((await db.subjects.toArray()).map((s) => s.id)).toEqual([1, 2]);
  expect(await db.assignments.get(10)).toMatchObject({ object: 'assignment' });
  expect(await db.reviewStatistics.count()).toBe(1);
  expect(await db.levelProgressions.count()).toBe(1);
  expect(await db.srsSystems.count()).toBe(1);
  expect(await db.syncState.get('subjects')).toMatchObject({
    lastUpdatedAt: updated,
    etag: '"subjects"',
  });
  expect(fetchMock.mock.calls.map(([u]) => String(u)).some((u) => u.includes('/reviews'))).toBe(
    false,
  );
});

test('next sync asks only for changes and keeps the cursor when nothing changed', async () => {
  await syncAll(db);
  fetchMock.mockClear();
  routes.resets = () => collection([], 'reset');
  await syncAll(db);
  const subjectsCall = fetchMock.mock.calls.find(([u]) => String(u).includes('/subjects'))!;
  expect(String(subjectsCall[0])).toBe(
    `${WK_API}/subjects?updated_after=${encodeURIComponent(updated)}`,
  );
  expect(new Headers(subjectsCall[1]!.headers).get('If-None-Match')).toBe('"subjects"');
  expect((await db.syncState.get('resets'))?.lastUpdatedAt).toBeNull();
});

test('304 leaves stored data and the cursor alone', async () => {
  await syncAll(db);
  fetchMock.mockImplementation(() => Promise.resolve(new Response(null, { status: 304 })));
  await syncAll(db);
  expect(await db.subjects.count()).toBe(2);
  expect((await db.syncState.get('subjects'))?.lastUpdatedAt).toBe(updated);
});

test('401 flags the token as rejected; a later success clears it', async () => {
  fetchMock.mockImplementationOnce(() => Promise.resolve(new Response('{}', { status: 401 })));
  await expect(syncAll(db)).rejects.toMatchObject({ kind: 'unauthorized' });
  expect(await db.meta.get('tokenRejected')).toBeDefined();
  await syncAll(db);
  expect(await db.meta.get('tokenRejected')).toBeUndefined();
});

test('clearing cached data keeps the token, history, prefs and meta', async () => {
  await syncAll(db);
  await db.prefs.put({ key: 'goalLevel', value: 30 });
  await db.meta.put({ key: 'onboardingSeen', value: true });
  await clearCachedData(db);
  expect(await db.subjects.count()).toBe(0);
  expect(await db.syncState.count()).toBe(0);
  expect(await db.auth.get('token')).toBe('tok');
  expect(await db.prefs.count()).toBe(1);
  expect(await db.meta.count()).toBe(1);
});

test('hourly sync runs one minute past the next hour', () => {
  expect(nextHourlyRun(Date.UTC(2026, 9, 3, 14, 0, 30))).toBe(Date.UTC(2026, 9, 3, 14, 1));
  expect(nextHourlyRun(Date.UTC(2026, 9, 3, 14, 1))).toBe(Date.UTC(2026, 9, 3, 15, 1));
  expect(nextHourlyRun(Date.UTC(2026, 9, 3, 23, 30))).toBe(Date.UTC(2026, 9, 4, 0, 1));
});
