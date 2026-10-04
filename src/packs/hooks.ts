import { useQuery } from '@tanstack/react-query';
import { useLiveQuery } from '../db/live';
import type { PackRow } from '../db/schema';
import { fetchManifest, packsDb } from './packs';
import type { KanjiPack, WordsPack } from './types';

/** The precached manifest. Fetching it never downloads a pack. */
export function useManifest() {
  return useQuery({ queryKey: ['packs-manifest'], queryFn: fetchManifest, staleTime: Infinity });
}

/** Installed pack rows; undefined while loading. */
export function useInstalledPacks(): PackRow[] | undefined {
  return useLiveQuery(() => packsDb.packs.toArray(), []);
}

/** A pack's data as stored (ranks still delta-encoded); null if not installed, undefined while loading. */
export function usePack(id: 'kanji'): KanjiPack | null | undefined;
export function usePack(id: `words-${string}`): WordsPack | null | undefined;
export function usePack(id: string): unknown {
  return useLiveQuery(async () => (await packsDb.packs.get(id))?.data ?? null, [id]);
}
