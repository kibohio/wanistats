import { useLiveQuery } from 'dexie-react-hooks';
import { useSyncExternalStore } from 'react';
import type { User } from '../api/types';
import { accountDb, sessionDb, useDb } from './useAppMode';

/** The signed-in (or sample) user, undefined until loaded or before the first sync. */
export function useUser(): User | undefined {
  const db = useDb();
  return useLiveQuery(() => db.user.get('me'), [db]);
}

/** When every collection was last synced together, in ms; null before the first sync. */
export function useLastSyncAt(): number | null | undefined {
  const db = useDb();
  return useLiveQuery(async () => {
    const states = await db.syncState.toArray();
    return states.length ? Math.min(...states.map((s) => Date.parse(s.lastSyncAt))) : null;
  }, [db]);
}

export interface HistoryRange {
  days: number;
  /** Local dates, YYYY-MM-DD. */
  first?: string;
  last?: string;
  /** ISO time the last snapshot was written. */
  lastTakenAt?: string;
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
    return { days, first: first?.date, last: last?.date, lastTakenAt: last?.takenAt };
  }, [db]);
}

/** WaniKani answered 401 on the last sync. Cleared by the next successful one. */
export function useTokenRejected(): boolean {
  return !!useLiveQuery(() => sessionDb.meta.get('tokenRejected'), []);
}

/** The stored token with all but its last four characters hidden. */
export function useMaskedToken(): string | undefined {
  return useLiveQuery(
    () => sessionDb.auth.get('token').then((t) => t && `${'•'.repeat(8)}${t.slice(-4)}`),
    [],
  );
}

/** Usernames of the other accounts with history in this browser. */
export function useOtherAccountsWithHistory(userId: string | undefined): string[] | undefined {
  return useLiveQuery(async () => {
    const others = (await sessionDb.accounts.toArray()).filter((a) => a.userId !== userId);
    const days = await Promise.all(others.map((a) => accountDb(a.userId).snapshots.count()));
    return others.filter((_, i) => days[i]! > 0).map((a) => a.username);
  }, [userId]);
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

// Whole-table reads for screens. Each re-runs only when its own table changes.
export function useSubjects() {
  const db = useDb();
  return useLiveQuery(() => db.subjects.toArray(), [db]);
}
export function useAssignments() {
  const db = useDb();
  return useLiveQuery(() => db.assignments.toArray(), [db]);
}
export function useReviewStatistics() {
  const db = useDb();
  return useLiveQuery(() => db.reviewStatistics.toArray(), [db]);
}
export function useLevelProgressions() {
  const db = useDb();
  return useLiveQuery(() => db.levelProgressions.toArray(), [db]);
}
export function useResets() {
  const db = useDb();
  return useLiveQuery(() => db.resets.toArray(), [db]);
}
export function useSrsSystems() {
  const db = useDb();
  return useLiveQuery(() => db.srsSystems.toArray(), [db]);
}
export function useSnapshots() {
  const db = useDb();
  return useLiveQuery(() => db.snapshots.orderBy('date').toArray(), [db]);
}
export function useSnapshotDeltas() {
  const db = useDb();
  return useLiveQuery(() => db.snapshotDeltas.toArray(), [db]);
}
