import { useId } from 'react';
import type { WkError } from '../api/client';
import { useOnline } from '../db/hooks';
import { SYNC_STEPS, type SyncProgress } from '../sync/sync';
import { useSync } from '../sync/useSync';
import { Button } from './Button';
import { RefreshIcon } from './icons';
import styles from './RefreshData.module.css';

export function syncErrorCopy(error: WkError): string {
  if (error.kind === 'unauthorized') return 'WaniKani rejected your token. Log in again.';
  if (error.kind === 'network') return "Can't reach WaniKani. Check your connection and try again.";
  return "WaniKani didn't respond. Try again in a minute.";
}

interface ViewProps {
  running: boolean;
  progress: SyncProgress | null;
  justSynced: boolean;
  error: WkError | null;
  offline: boolean;
  onRefresh: () => void;
  /** Icon-only button; the wrapper drops out of layout so the parent places button and caption. */
  compact?: boolean;
}

export function RefreshDataView(p: ViewProps) {
  const id = useId();
  const caption = p.offline
    ? "You're offline. Try again when you're connected."
    : p.running
      ? p.progress
        ? `${p.progress.label} (${p.progress.step + 1} of ${SYNC_STEPS.length})`
        : 'Syncing'
      : p.error
        ? syncErrorCopy(p.error)
        : p.justSynced
          ? 'Synced just now'
          : '';
  return (
    <div className={p.compact ? styles.compact : styles.refresh}>
      <Button
        disabled={p.running || p.offline}
        aria-label={p.compact ? 'Refresh data' : undefined}
        aria-describedby={id}
        className={p.compact ? styles.iconButton : undefined}
        onClick={() => p.onRefresh()}
      >
        <RefreshIcon size={16} strokeWidth={2} className={p.running ? styles.spin : undefined} />
        {!p.compact && 'Refresh data'}
      </Button>
      <span id={id} role="status" className={styles.caption}>
        {caption}
      </span>
    </div>
  );
}

/** Refresh data button wired to the shared sync. */
export function RefreshData({ compact }: { compact?: boolean }) {
  const { sync, running, progress, justSynced, error } = useSync();
  const offline = !useOnline();
  return (
    <RefreshDataView
      running={running}
      progress={progress}
      justSynced={justSynced}
      error={error}
      offline={offline}
      onRefresh={() => sync()}
      compact={compact}
    />
  );
}
