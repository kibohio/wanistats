import { useLiveQuery } from 'dexie-react-hooks';
import { useSyncExternalStore } from 'react';
import type { User } from '../api/types';
import { liveDb, useDb } from './useAppMode';

/** The signed-in (or sample) user, undefined until loaded or before the first sync. */
export function useUser(): User | undefined {
  const db = useDb();
  return useLiveQuery(() => db.user.get('me'), [db]);
}

/**
 * When every collection was last synced together, in ms; null before the first sync.
 * Live data only: sample mode has no sync.
 */
export function useLastSyncAt(): number | null | undefined {
  return useLiveQuery(async () => {
    const states = await liveDb.syncState.toArray();
    return states.length ? Math.min(...states.map((s) => Date.parse(s.lastSyncAt))) : null;
  }, []);
}

export interface HistoryRange {
  days: number;
  /** Local dates, YYYY-MM-DD. */
  first?: string;
  last?: string;
}

/** Days with a snapshot and the first and last of them. */
export function useHistoryRange(): HistoryRange | undefined {
  const db = useDb();
  return useLiveQuery(async () => {
    const days = await db.snapshots.count();
    const [first, last] = await Promise.all([
      db.snapshots.orderBy('date').first(),
      db.snapshots.orderBy('date').last(),
    ]);
    return { days, first: first?.date, last: last?.date };
  }, [db]);
}

/** WaniKani answered 401 on the last sync. Cleared by the next successful one. */
export function useTokenRejected(): boolean {
  return !!useLiveQuery(() => liveDb.meta.get('tokenRejected'), []);
}

/** The stored token with all but its last four characters hidden. */
export function useMaskedToken(): string | undefined {
  return useLiveQuery(
    () => liveDb.auth.get('token').then((t) => t && `${'•'.repeat(8)}${t.slice(-4)}`),
    [],
  );
}

function subscribeOnline(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine);
}
