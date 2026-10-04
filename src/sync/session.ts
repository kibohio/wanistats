import type { QueryClient } from '@tanstack/react-query';
import Dexie from 'dexie';
import type { User } from '../api/types';
import { accountDb, activeDb, sampleDb, seedSample, sessionDb } from '../db/useAppMode';
import {
  exportHistory as buildHistoryFile,
  mergeHistory,
  parseHistoryFile,
  type HistoryFile,
} from '../domain/historyFile';
import { localDateKey } from '../domain/localDate';
import { packsDb } from '../packs/packs';
import { waitForSync } from './useSync';

// Matches the tag the service worker listens for.
const PERIODIC_TAG = 'snapshot';

/**
 * Makes `user` the active account and stores its token. Each account keeps its own database,
 * so logging in as someone else leaves the previous account's data and history as they are.
 */
export async function saveLogin(token: string, user: User): Promise<void> {
  await waitForSync();
  // Written first, so the screens have a user the moment the mode flips to live.
  await accountDb(user.id).user.put(user, 'me');
  const s = sessionDb;
  await s.transaction('rw', s.auth, s.accounts, s.meta, async () => {
    await s.auth.put(token, 'token');
    await s.accounts.put({
      userId: user.id,
      username: user.username,
      lastActiveAt: new Date().toISOString(),
    });
    await s.meta.put({ key: 'activeUserId', value: user.id });
    await s.meta.delete('tokenRejected');
  });
}

/** Forgets the token only. Synced data and history stay, since history can't be refetched. */
export async function logout(queryClient: QueryClient): Promise<void> {
  await unregisterPeriodicSync();
  await waitForSync();
  const s = sessionDb;
  await s.transaction('rw', s.auth, s.meta, () =>
    Promise.all([s.auth.delete('token'), s.meta.delete('tokenRejected')]),
  );
  queryClient.clear();
}

/** localStorage keys: the theme mirror and the dismissed history-gap notice. */
const LOCAL_KEYS = [
  'wanistats:theme',
  'wanistats:clock',
  'wanistats:gapDismissed',
  'wanistats:session',
];

/** Deletes every WaniStats database and stored key in this browser, then reseeds the sample. */
export async function deleteLocalData(queryClient: QueryClient): Promise<void> {
  await unregisterPeriodicSync();
  await waitForSync();
  const accounts = await sessionDb.accounts.toArray();
  const open: Dexie[] = [sessionDb, sampleDb, packsDb, ...accounts.map((a) => accountDb(a.userId))];
  // Also catches databases the session no longer lists, such as the old single `wanistats`.
  const listed = 'databases' in indexedDB ? await indexedDB.databases().catch(() => []) : [];
  const others = listed
    .map((d) => d.name)
    .filter((n): n is string => !!n?.startsWith('wanistats') && !open.some((db) => db.name === n));
  for (const db of open) {
    // A delete does not notify live queries; clearing first does. They then reopen empty.
    await db.transaction('rw', db.tables, () => Promise.all(db.tables.map((t) => t.clear())));
    await db.delete({ disableAutoOpen: false });
  }
  await Promise.all(others.map((n) => Dexie.delete(n)));
  await seedSample();
  try {
    LOCAL_KEYS.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Storage blocked; nothing was stored.
  }
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

async function unregisterPeriodicSync(): Promise<void> {
  const periodic = await periodicSync();
  await periodic?.unregister(PERIODIC_TAG).catch(() => {});
}

/** Downloads the active account's history, which stays available after logout. */
export async function exportHistory(): Promise<void> {
  const db = await activeDb();
  if (!db) return;
  const [snapshots, snapshotDeltas, user] = await Promise.all([
    db.snapshots.toArray(),
    db.snapshotDeltas.toArray(),
    db.user.get('me'),
  ]);
  const now = Date.now();
  const account = user && { userId: user.id, username: user.username };
  const json = JSON.stringify(buildHistoryFile(snapshots, snapshotDeltas, now, account));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = `wanistats-history-${localDateKey(now)}.json`;
  a.click();
  // Revoking synchronously can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Parses and validates a history export. Throws an Error with user-facing copy. */
export function readHistoryFile(text: string): HistoryFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('This file is not a WaniStats history export.');
  }
  return parseHistoryFile(parsed);
}

/**
 * Merges a history file into the active account's history.
 * The snapshot baseline stays: it describes the live counters, not the imported days.
 */
export async function importHistory(incoming: HistoryFile): Promise<{ days: number }> {
  const db = await activeDb();
  if (!db) throw new Error('Log in before importing history.');
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
export async function deleteHistory(): Promise<void> {
  const db = await activeDb();
  if (!db) return;
  await db.transaction('rw', db.snapshots, db.snapshotDeltas, db.meta, async () => {
    await Promise.all([
      db.snapshots.clear(),
      db.snapshotDeltas.clear(),
      db.meta.bulkDelete(['firstSnapshotDate', 'snapshotBaseline']),
    ]);
  });
}
