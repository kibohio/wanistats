import { useEffect } from 'react';
import { usePref } from '../db/prefs';

// The pref lives in IndexedDB, which loads after first paint; a localStorage copy avoids a flash.
const KEY = 'wanistats:theme';

function apply(theme: string | null) {
  const root = document.documentElement;
  if (!theme || theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
}

/** Applies the last known theme before React renders. */
export function applyStoredTheme(): void {
  try {
    apply(localStorage.getItem(KEY));
  } catch {
    // Storage blocked; the pref applies once loaded.
  }
}

/** The theme pref on <html data-theme>. System sets nothing, so the OS setting applies. */
export function useApplyTheme(): void {
  const [theme] = usePref('theme');
  useEffect(() => {
    apply(theme);
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      // Storage blocked; nothing to mirror.
    }
  }, [theme]);
}
