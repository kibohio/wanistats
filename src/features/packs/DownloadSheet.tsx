import { useRef, useState, type RefObject } from 'react';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { useInstalledPacks, useManifest } from '../../packs/hooks';
import { downloadPack, formatBytes, hasUpdate } from '../../packs/packs';
import type { PackEntry } from '../../packs/types';
import styles from './DownloadSheet.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pack ids to tick when the sheet opens; default every pack not yet installed or current. */
  preselect?: string[];
}

/** Opt-in pack download (spec 7). Nothing is fetched until the user presses Download. */
export function DownloadSheet({ open, onClose, preselect }: Props) {
  // Lives here, not in Body, so closing aborts but an unmount (the empty state giving way to the
  // view once a pack lands) lets the remaining downloads finish.
  const abortRef = useRef<AbortController | null>(null);
  const close = () => {
    abortRef.current?.abort();
    onClose();
  };
  return (
    <Sheet open={open} onClose={close} title="Download coverage data">
      <div className={styles.content}>
        <p className={styles.body}>
          Coverage compares what you know with how often kanji and words appear in Japanese media.
          The data is a one-time download that stays on this device.
        </p>
        <Body onClose={close} preselect={preselect} abortRef={abortRef} />
      </div>
    </Sheet>
  );
}

function Body({
  onClose,
  preselect,
  abortRef,
}: Omit<Props, 'open'> & { abortRef: RefObject<AbortController | null> }) {
  const manifest = useManifest();
  const installed = useInstalledPacks();
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  if (manifest.isError) {
    return (
      <>
        <p role="alert" className={styles.error}>
          Couldn&apos;t load the list of data packs. Check your connection and try again.
        </p>
        <div className={styles.actions}>
          <Button variant="primary" onClick={() => void manifest.refetch()}>
            Try again
          </Button>
          <Button onClick={onClose}>Not now</Button>
        </div>
      </>
    );
  }
  if (!manifest.data || !installed) return null;

  const rows = new Map(installed.map((r) => [r.id, r]));
  const needed = (e: PackEntry) => !rows.has(e.id) || hasUpdate(e, rows.get(e.id));
  const packs = manifest.data.packs;
  const selected = picked ?? new Set(preselect ?? packs.filter(needed).map((e) => e.id));
  const chosen = packs.filter((e) => selected.has(e.id) && needed(e));
  const total = chosen.reduce((sum, e) => sum + e.bytes, 0);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (!next.delete(id)) next.add(id);
    setPicked(next);
  };

  async function download() {
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setErrors({});
    const failed: Record<string, string> = {};
    // One at a time, so each row's progress is meaningful and a failure doesn't stop the rest.
    for (const entry of chosen) {
      try {
        await downloadPack(
          entry,
          (loaded) => setProgress((p) => ({ ...p, [entry.id]: loaded })),
          controller.signal,
        );
      } catch (e) {
        if (controller.signal.aborted) return;
        failed[entry.id] = (e as Error).message;
      }
    }
    setBusy(false);
    setProgress({});
    setErrors(failed);
    if (Object.keys(failed).length === 0) onClose();
  }

  return (
    <>
      <fieldset className={styles.list} disabled={busy}>
        <legend className="visually-hidden">Data packs</legend>
        {packs.map((e) => {
          const current = !needed(e);
          const loaded = progress[e.id];
          return (
            <div key={e.id} className={styles.row}>
              <label className={styles.label}>
                <input
                  type="checkbox"
                  className={styles.check}
                  checked={current || selected.has(e.id)}
                  disabled={current}
                  onChange={() => toggle(e.id)}
                />
                <span className={styles.text}>
                  <span className={styles.name}>{e.label}</span>
                  <span className={styles.desc}>{e.description}</span>
                </span>
                <span className={styles.size}>{current ? 'Installed' : formatBytes(e.bytes)}</span>
              </label>
              {loaded !== undefined && (
                <progress
                  className={styles.progress}
                  value={loaded}
                  max={e.bytes}
                  aria-label={`${e.label}: ${formatBytes(loaded)} of ${formatBytes(e.bytes)}`}
                />
              )}
              {errors[e.id] && (
                <p role="alert" className={styles.error}>
                  {errors[e.id]}
                </p>
              )}
            </div>
          );
        })}
      </fieldset>
      {isMetered() && (
        <p className={styles.note}>Your browser reports a data-saver or mobile connection.</p>
      )}
      <div className={styles.actions}>
        <Button variant="primary" disabled={busy || total === 0} onClick={() => void download()}>
          {busy ? 'Downloading' : total ? `Download ${formatBytes(total)}` : 'Download'}
        </Button>
        <Button onClick={onClose}>Not now</Button>
      </div>
    </>
  );
}

interface NetworkInformation {
  saveData?: boolean;
  type?: string;
}

/** Chromium only; other browsers report nothing, so the line simply doesn't show. */
function isMetered(): boolean {
  const c = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  return Boolean(c?.saveData || c?.type === 'cellular');
}
