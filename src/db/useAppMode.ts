import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { openDb, type WaniStatsDb } from './schema';

export type AppMode = 'sample' | 'live';

export const liveDb = openDb('wanistats');
export const sampleDb = openDb('wanistats-sample');

/** 'live' while a token is stored. Reactive, so login and logout flip it without a reload. */
export function useAppMode(): AppMode {
  // count(), so the token itself never leaves IndexedDB for React state.
  return useLiveQuery(() => liveDb.auth.count(), []) ? 'live' : 'sample';
}

/** The database screens read from: `wanistats` when logged in, `wanistats-sample` otherwise. */
export function useDb(): WaniStatsDb {
  return useAppMode() === 'live' ? liveDb : sampleDb;
}

let seeded = false;

/**
 * Regenerates sample data once per page load while logged out. Sample timestamps are relative
 * to now, so a fresh seed keeps the forecast live.
 */
export function useSampleSeed(): void {
  const tokens = useLiveQuery(() => liveDb.auth.count(), []);
  useEffect(() => {
    if (tokens !== 0 || seeded) return;
    seeded = true;
    void import('../sample').then((m) => m.seedSampleDb(sampleDb, Date.now()));
  }, [tokens]);
}
