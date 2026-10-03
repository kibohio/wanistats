import { Link } from '@tanstack/react-router';
import { useLastSyncAt, useOnline, useTokenRejected } from '../db/hooks';
import { useAppMode } from '../db/useAppMode';
import { formatSyncTime } from '../format';
import { useClock } from '../hooks/useClock';
import styles from './StatusBanners.module.css';

/** Offline and rejected-token notices. Data stays on screen underneath. */
export function StatusBanners() {
  const live = useAppMode() === 'live';
  const online = useOnline();
  const rejected = useTokenRejected();
  const lastSync = useLastSyncAt();
  const clock = useClock();
  if (!live) return null;
  return (
    <>
      {!online && (
        <p role="status" className={styles.banner}>
          Offline.{lastSync != null && ` Showing data from ${formatSyncTime(lastSync, clock)}.`}
        </p>
      )}
      {rejected && (
        <p role="alert" className={`${styles.banner} ${styles.attention}`}>
          WaniKani rejected your token. <Link to="/login">Log in again.</Link>
        </p>
      )}
    </>
  );
}
