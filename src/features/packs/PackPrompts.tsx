import { useState, type ReactNode } from 'react';
import { Button } from '../../components/Button';
import { useInstalledPacks, useManifest } from '../../packs/hooks';
import { formatBytes, hasUpdate } from '../../packs/packs';
import { DownloadSheet } from './DownloadSheet';
import styles from './DownloadSheet.module.css';

interface Props {
  packId: string;
}

/** Empty state for a view that needs a pack: its size and a Download button. */
export function PackEmptyState({ packId, children }: Props & { children?: ReactNode }) {
  const entry = useManifest().data?.packs.find((p) => p.id === packId);
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.empty}>
      <p className={styles.body}>{children ?? 'This view needs coverage data.'}</p>
      {entry && (
        <p className={styles.desc}>
          {entry.label}, {formatBytes(entry.bytes)}
        </p>
      )}
      <Button variant="primary" onClick={() => setOpen(true)}>
        Download
      </Button>
      <DownloadSheet open={open} onClose={() => setOpen(false)} preselect={[packId]} />
    </div>
  );
}

/** Quiet line where an installed pack is used, when the manifest has a newer version. */
export function PackUpdateLine({ packId }: Props) {
  const entry = useManifest().data?.packs.find((p) => p.id === packId);
  const row = useInstalledPacks()?.find((r) => r.id === packId);
  const [open, setOpen] = useState(false);
  if (!entry || !hasUpdate(entry, row)) return null;
  return (
    <div className={styles.update}>
      <p>Updated coverage data is available ({formatBytes(entry.bytes)}).</p>
      <Button small onClick={() => setOpen(true)}>
        Download
      </Button>
      <DownloadSheet open={open} onClose={() => setOpen(false)} preselect={[packId]} />
    </div>
  );
}
