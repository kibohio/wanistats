import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useSyncExternalStore } from 'react';
import { getPref } from '../db/prefs';
import { useDb } from '../db/useAppMode';
import type { Clock } from '../format';

// One app-wide value instead of a pref query per component, which would show the default on
// every mount. Mirrored to localStorage so the first paint already uses it.
const KEY = 'wanistats:clock';
const listeners = new Set<() => void>();
let current: Clock = stored();

function stored(): Clock {
  try {
    const v = localStorage.getItem(KEY);
    return v === '12h' || v === '24h' ? v : 'system';
  } catch {
    return 'system';
  }
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The clock pref, for formatTime and friends. */
export const useClock = (): Clock => useSyncExternalStore(subscribe, () => current);

/** Keeps useClock in step with the active account's pref. Mount once, in the app shell. */
export function useApplyClock(): void {
  const db = useDb();
  const clock = useLiveQuery(() => getPref(db, 'clock'), [db]);
  useEffect(() => {
    if (clock === undefined || clock === current) return;
    current = clock;
    listeners.forEach((l) => l());
    try {
      localStorage.setItem(KEY, clock);
    } catch {
      // Storage blocked; the pref applies once loaded.
    }
  }, [clock]);
}
