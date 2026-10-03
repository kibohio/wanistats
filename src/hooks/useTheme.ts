import { useEffect } from 'react';
import { usePref } from '../db/prefs';

/** The theme pref on <html data-theme>. System sets nothing, so the OS setting applies. */
export function useApplyTheme(): void {
  const [theme] = usePref('theme');
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
  }, [theme]);
}
