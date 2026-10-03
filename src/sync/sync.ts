import { fetchCollection, getUserIfChanged, WkError } from '../api/client';
import { writeDailySnapshot } from './snapshot';
import type { CollectionName, SyncState, WaniStatsDb } from '../db/schema';

export const SYNC_STEPS = [
  'Your profile',
  'Kanji and vocabulary',
  'Your progress',
  'Your accuracy',
  'Your levels',
] as const;

export interface SyncProgress {
  /** Index into SYNC_STEPS. */
  step: number;
  label: (typeof SYNC_STEPS)[number];
  /** Records received so far in this step's current collection, of `total`. */
  loaded: number;
  total: number;
}

const COLLECTIONS: [step: number, name: CollectionName, table: string][] = [
  [1, 'subjects', 'subjects'],
  [2, 'assignments', 'assignments'],
  [3, 'review_statistics', 'reviewStatistics'],
  [4, 'level_progressions', 'levelProgressions'],
  [4, 'resets', 'resets'],
  [4, 'spaced_repetition_systems', 'srsSystems'],
];

type Report = (step: number, loaded?: number, total?: number) => void;

function stamp(
  db: WaniStatsDb,
  name: CollectionName,
  prev: SyncState | undefined,
  next: Partial<SyncState>,
) {
  return db.syncState.put({
    collection: name,
    lastUpdatedAt: prev?.lastUpdatedAt ?? null,
    etag: prev?.etag,
    lastModified: prev?.lastModified,
    ...next,
    lastSyncAt: new Date().toISOString(),
  });
}

async function syncCollection(
  db: WaniStatsDb,
  token: string,
  [step, name, tableName]: (typeof COLLECTIONS)[number],
  report: Report,
): Promise<void> {
  report(step);
  const prev = await db.syncState.get(name);
  const table = db.table(tableName);
  const res = await fetchCollection(token, name, {
    updatedAfter: prev?.lastUpdatedAt,
    etag: prev?.etag,
    lastModified: prev?.lastModified,
    onPage: async (items, loaded, total) => {
      await table.bulkPut(items);
      report(step, loaded, total);
    },
  });
  await stamp(
    db,
    name,
    prev,
    res.notModified
      ? {}
      : {
          // Null when nothing changed since updated_after: keep the old cursor.
          lastUpdatedAt: res.dataUpdatedAt ?? prev?.lastUpdatedAt ?? null,
          etag: res.etag,
          lastModified: res.lastModified,
        },
  );
}

async function withRejection(db: WaniStatsDb, run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch (e) {
    if (e instanceof WkError && e.kind === 'unauthorized') {
      await db.meta.put({ key: 'tokenRejected', value: true });
    }
    throw e;
  }
  await db.meta.delete('tokenRejected');
}

/**
 * Incremental sync of every collection into `db`. Resources are stored exactly as returned,
 * hidden subjects included (their data.hidden_at is the flag domain code filters on).
 * A failure part way leaves the cursor of the failed collection untouched, so the next run
 * refetches from there; puts are idempotent.
 */
export async function syncAll(
  db: WaniStatsDb,
  onProgress: (p: SyncProgress) => void = () => {},
): Promise<void> {
  const token = await db.auth.get('token');
  if (!token) throw new WkError('unauthorized');
  const report: Report = (step, loaded = 0, total = 0) =>
    onProgress({ step, label: SYNC_STEPS[step]!, loaded, total });

  await withRejection(db, async () => {
    report(0);
    const userState = await db.syncState.get('user');
    const user = await getUserIfChanged(token, userState ?? {});
    if (user) await db.user.put(user.report.data, 'me');
    await stamp(
      db,
      'user',
      userState,
      user
        ? {
            lastUpdatedAt: user.report.data_updated_at,
            etag: user.etag,
            lastModified: user.lastModified,
          }
        : {},
    );
    for (const c of COLLECTIONS) await syncCollection(db, token, c, report);
  });
  await writeDailySnapshot(db, Date.now());
}

/**
 * The service worker's periodic run: only what a snapshot needs to be current, then today's
 * snapshot if none exists. Skipped when logged out, before the first sync, or after a 401.
 */
export async function backgroundSync(db: WaniStatsDb): Promise<void> {
  const [token, user, rejected] = await Promise.all([
    db.auth.get('token'),
    db.user.get('me'),
    db.meta.get('tokenRejected'),
  ]);
  if (!token || !user || rejected) return;
  await withRejection(db, async () => {
    for (const c of COLLECTIONS) {
      if (c[1] === 'assignments' || c[1] === 'review_statistics') {
        await syncCollection(db, token, c, () => {});
      }
    }
  });
  await writeDailySnapshot(db, Date.now());
}

/** Drops everything fetched from WaniKani; keeps the token, history, prefs and meta. */
export function clearCachedData(db: WaniStatsDb): Promise<void> {
  const tables = [
    db.user,
    db.subjects,
    db.assignments,
    db.reviewStatistics,
    db.levelProgressions,
    db.resets,
    db.srsSystems,
    db.syncState,
  ];
  return db
    .transaction('rw', tables, () => Promise.all(tables.map((t) => t.clear())))
    .then(() => {});
}

/** Reviews unlock on the hour; sync one minute after the next one. */
export function nextHourlyRun(now: number): number {
  const d = new Date(now);
  d.setMinutes(1, 0, 0);
  if (d.getTime() <= now) d.setHours(d.getHours() + 1);
  return d.getTime();
}
