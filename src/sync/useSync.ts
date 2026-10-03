import { useMutation, useMutationState } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';
import type { WkError } from '../api/client';
import { useTokenRejected } from '../db/hooks';
import { liveDb, useAppMode } from '../db/useAppMode';
import { nextHourlyRun, syncAll, type SyncProgress } from './sync';

const SYNC_KEY = ['sync'];
/** Returning to the tab syncs at most this often; WaniKani's API is a shared resource. */
const VISIBLE_MIN_GAP_MS = 10 * 60_000;

let inFlight: Promise<void> | null = null;
let lastSuccessAt = 0;
// Running state lives here, not in the mutation cache: useIsMutating keeps a stale count when
// it mounts mid-run and the run settles before its subscription attaches.
let run: { running: boolean; progress: SyncProgress | null } = { running: false, progress: null };
const listeners = new Set<() => void>();

function setRun(running: boolean, progress: SyncProgress | null = null) {
  run = { running, progress };
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** One sync at a time; callers during a run share it. */
function runSync(): Promise<void> {
  if (inFlight) return inFlight;
  setRun(true);
  inFlight = syncAll(liveDb, (p) => setRun(true, p))
    .then(() => {
      lastSuccessAt = Date.now();
    })
    .finally(() => {
      inFlight = null;
      setRun(false);
    });
  return inFlight;
}

/** Resolves once any running sync has settled. */
export function waitForSync(): Promise<void> {
  return inFlight?.catch(() => {}) ?? Promise.resolve();
}

export interface SyncStatus {
  /** Fire and forget; the outcome lands in the fields below. */
  sync: () => void;
  /** For flows that wait on the result (login). Rejects with WkError. */
  syncAsync: () => Promise<void>;
  running: boolean;
  progress: SyncProgress | null;
  /** Error of the latest run, if it failed. */
  error: WkError | null;
  /** This caller's sync succeeded within the last minute. */
  justSynced: boolean;
}

export function useSync(): SyncStatus {
  const { mutate, mutateAsync, isSuccess, reset } = useMutation({
    mutationKey: SYNC_KEY,
    mutationFn: runSync,
  });
  const last = useMutationState({
    filters: { mutationKey: SYNC_KEY },
    select: (m) => m.state,
  }).at(-1);
  const { running, progress } = useSyncExternalStore(subscribe, () => run);
  // "Synced just now" belongs to this caller's own run and fades after a minute.
  useEffect(() => {
    if (!isSuccess) return;
    const t = setTimeout(reset, 60_000);
    return () => clearTimeout(t);
  }, [isSuccess, reset]);
  return {
    sync: mutate,
    syncAsync: mutateAsync,
    running,
    progress,
    error: !running && last?.status === 'error' ? (last.error as WkError) : null,
    justSynced: !running && isSuccess,
  };
}

/** Sync on start, when the tab becomes visible or comes online, every 5 minutes, and at :01. */
export function useSyncTriggers(): void {
  const live = useAppMode() === 'live';
  const rejected = useTokenRejected();
  const { sync } = useSync();

  useEffect(() => {
    if (!live || rejected) return;
    // Triggers: app start, tab visible (throttled), one minute past each hour, Refresh data
    // and periodic background sync. No fixed polling interval.
    const auto = (minGap: number) => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return;
      if (inFlight || Date.now() - lastSuccessAt < minGap) return;
      sync();
    };
    const onVisible = () => auto(VISIBLE_MIN_GAP_MS);
    let hourly = 0;
    const scheduleHourly = () => {
      hourly = window.setTimeout(
        () => {
          auto(0);
          scheduleHourly();
        },
        nextHourlyRun(Date.now()) - Date.now(),
      );
    };
    auto(0);
    scheduleHourly();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(hourly);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [live, rejected, sync]);
}
