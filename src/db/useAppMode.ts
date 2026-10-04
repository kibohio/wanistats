import { useEffect } from 'react';
import { useLiveQuery } from './live';
import { accountDbName, openDb, openSessionDb, type WaniStatsDb } from './schema';

export type AppMode = 'sample' | 'live';

export const sessionDb = openSessionDb();
export const sampleDb = openDb('wanistats-sample');

const accountDbs = new Map<string, WaniStatsDb>();

/** One Dexie instance per account, so live queries and writes share it. */
export function accountDb(userId: string): WaniStatsDb {
  let db = accountDbs.get(userId);
  if (!db) accountDbs.set(userId, (db = openDb(accountDbName(userId))));
  return db;
}

async function activeUserId(): Promise<string | undefined> {
  return (await sessionDb.meta.get('activeUserId'))?.value as string | undefined;
}

/** The account last logged in. It stays after logout, so its history can still be exported. */
export async function activeDb(): Promise<WaniStatsDb | undefined> {
  const id = await activeUserId();
  return id ? accountDb(id) : undefined;
}

function useSession() {
  return useLiveQuery(
    async () => ({
      // count(), so the token itself never leaves IndexedDB for React state.
      live: (await sessionDb.auth.count()) > 0,
      userId: await activeUserId(),
    }),
    [],
  );
}

/** 'live' while a token is stored. Reactive, so login and logout flip it without a reload. */
export function useAppMode(): AppMode {
  return useSession()?.live ? 'live' : 'sample';
}

/** activeDb() as a hook, in either mode. */
export function useAccountDb(): WaniStatsDb | undefined {
  const id = useSession()?.userId;
  return id ? accountDb(id) : undefined;
}

/** The database screens read from: the active account's when logged in, else the sample. */
export function useDb(): WaniStatsDb {
  const s = useSession();
  return s?.live && s.userId ? accountDb(s.userId) : sampleDb;
}

/** Sample timestamps are relative to now, so a fresh seed keeps the forecast live. */
export function seedSample(): Promise<void> {
  return import('../sample').then((m) => m.seedSampleDb(sampleDb, Date.now()));
}

let seeded = false;

/** Regenerates sample data once per page load while logged out. */
export function useSampleSeed(): void {
  const tokens = useLiveQuery(() => sessionDb.auth.count(), []);
  useEffect(() => {
    if (tokens !== 0 || seeded) return;
    seeded = true;
    void seedSample();
  }, [tokens]);
}
