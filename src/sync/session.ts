import type { QueryClient } from '@tanstack/react-query';
import type { User } from '../api/types';
import { liveDb } from '../db/useAppMode';
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
  const reg = await navigator.serviceWorker?.getRegistration();
  const periodic = (
    reg as { periodicSync?: { unregister(tag: string): Promise<void> } } | undefined
  )?.periodicSync;
  await periodic?.unregister(PERIODIC_TAG).catch(() => {});
  await deleteLiveData();
  queryClient.clear();
}

// ponytail: minimal export; swap for the history file module (export and import) when it lands.
export async function exportHistory(): Promise<void> {
  const [snapshots, snapshotDeltas] = await Promise.all([
    liveDb.snapshots.toArray(),
    liveDb.snapshotDeltas.toArray(),
  ]);
  const json = JSON.stringify({
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    snapshots,
    snapshotDeltas,
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = `wanistats-history-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  // Revoking synchronously can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
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
