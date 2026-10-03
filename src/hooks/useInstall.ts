import { useEffect, useSyncExternalStore } from 'react';
import { useAppMode } from '../db/useAppMode';
import { registerPeriodicSync } from '../sync/session';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Captured at module load: Chrome fires the event once, often before any screen that offers install.
let deferred: BeforeInstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installedNow = true;
    notify();
  });
}

function subscribe(l: () => void) {
  listeners.add(l);
  const standalone = window.matchMedia?.('(display-mode: standalone)');
  standalone?.addEventListener('change', l);
  return () => {
    listeners.delete(l);
    standalone?.removeEventListener('change', l);
  };
}

function isInstalled(): boolean {
  return (
    installedNow ||
    !!window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS home screen apps.
    (navigator as { standalone?: boolean }).standalone === true
  );
}

/** iPhone and iPad (iPadOS reports as a Mac with touch). Safari there has no install prompt. */
export function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

export interface Install {
  installed: boolean;
  /** The browser offered an install prompt we can show. */
  canPrompt: boolean;
  ios: boolean;
  prompt: () => Promise<void>;
}

export function useInstall(): Install {
  const canPrompt = useSyncExternalStore(subscribe, () => deferred !== null);
  const installed = useSyncExternalStore(subscribe, isInstalled);
  return {
    installed,
    canPrompt,
    ios: isIos(),
    prompt: async () => {
      const e = deferred;
      if (!e) return;
      deferred = null;
      notify();
      await e.prompt();
    },
  };
}

/** Background snapshots where the browser supports them: installed and logged in only. */
export function usePeriodicSync(): void {
  const live = useAppMode() === 'live';
  const { installed } = useInstall();
  useEffect(() => {
    if (live && installed) void registerPeriodicSync();
  }, [live, installed]);
}
