import type { QueryClient } from '@tanstack/react-query';
import type { User } from '../api/types';
import { liveDb } from '../db/useAppMode';
import {
  exportHistory as buildHistoryFile,
  mergeHistory,
  parseHistoryFile,
} from '../domain/historyFile';
import { localDateKey } from '../domain/localDate';
import { waitForSync } from './useSync';

// Matches the tag the service worker listens for.
const PERIODIC_TAG = 'snapshot';

/** Stores a verified token. A different account's data is wiped first so nothing mixes. */
export async function saveLogin(token: string, user: User): Promise<void> {
  const prev = await liveDb.user.get('me');
  if (prev && prev.id !== user.id) await deleteLiveData();
  await liveDb.transaction('rw', liveDb.auth, liveDb.user, async () => {
    await liveDb.auth.put(token, 'token');
    await liveDb.user.put(user, 'me');
  });
}

/** Deletes the `wanistats` database (packs live elsewhere and stay) and forgets cached queries. */
export async function logout(queryClient: QueryClient): Promise<void> {
  const periodic = await periodicSync();
  await periodic?.unregister(PERIODIC_TAG).catch(() => {});
  await deleteLiveData();
  queryClient.clear();
}

type PeriodicSync = {
  register(tag: string, options: { minInterval: number }): Promise<void>;
  unregister(tag: string): Promise<void>;
};

async function periodicSync(): Promise<PeriodicSync | undefined> {
  const reg = await navigator.serviceWorker?.getRegistration();
  return (reg as { periodicSync?: PeriodicSync } | undefined)?.periodicSync;
}

/** Chromium only, and only for installed apps it trusts; anywhere else this quietly does nothing. */
export async function registerPeriodicSync(): Promise<void> {
  const periodic = await periodicSync();
  await periodic?.register(PERIODIC_TAG, { minInterval: 12 * 60 * 60_000 }).catch(() => {});
}

export async function exportHistory(): Promise<void> {
  const [snapshots, snapshotDeltas] = await Promise.all([
    liveDb.snapshots.toArray(),
    liveDb.snapshotDeltas.toArray(),
  ]);
  const now = Date.now();
  const json = JSON.stringify(buildHistoryFile(snapshots, snapshotDeltas, now));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = `wanistats-history-${localDateKey(now)}.json`;
  a.click();
  // Revoking synchronously can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/**
 * Merges a history file into this browser's history. Throws an Error with user-facing copy.
 * The snapshot baseline stays: it describes the live counters, not the imported days.
 */
export async function importHistory(text: string): Promise<{ days: number }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('This file is not a WaniStats history export.');
  }
  const incoming = parseHistoryFile(parsed);
  const db = liveDb;
  return db.transaction('rw', db.snapshots, db.snapshotDeltas, db.meta, async () => {
    const existing = {
      snapshots: await db.snapshots.toArray(),
      snapshotDeltas: await db.snapshotDeltas.toArray(),
    };
    const merged = mergeHistory(existing, incoming);
    await Promise.all([db.snapshots.clear(), db.snapshotDeltas.clear()]);
    await db.snapshots.bulkPut(merged.snapshots);
    await db.snapshotDeltas.bulkPut(merged.snapshotDeltas);
    const first = merged.snapshots[0]?.date;
    if (first) await db.meta.put({ key: 'firstSnapshotDate', value: first });
    return { days: merged.snapshots.length };
  });
}

/** Clears snapshots and deltas. The next sync starts a fresh history with a new baseline. */
export function deleteHistory(): Promise<void> {
  const db = liveDb;
  return db.transaction('rw', db.snapshots, db.snapshotDeltas, db.meta, async () => {
    await Promise.all([
      db.snapshots.clear(),
      db.snapshotDeltas.clear(),
      db.meta.bulkDelete(['firstSnapshotDate', 'snapshotBaseline']),
    ]);
  });
}

async function deleteLiveData() {
  // A sync still running would recreate tables after the delete.
  await waitForSync();
  // Deleting the database does not notify live queries; clearing every table first does.
  await liveDb.transaction('rw', liveDb.tables, () =>
    Promise.all(liveDb.tables.map((t) => t.clear())),
  );
  await liveDb.delete({ disableAutoOpen: false });
}
