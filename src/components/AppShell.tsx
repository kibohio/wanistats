import { Link, Outlet } from '@tanstack/react-router';
import { useHistoryRange, useLastSyncAt, useUser } from '../db/hooks';
import { useAppMode, useSampleSeed } from '../db/useAppMode';
import { formatSyncTime } from '../format';
import { usePeriodicSync } from '../hooks/useInstall';
import { useApplyClock, useClock } from '../hooks/useClock';
import { useApplyTheme } from '../hooks/useTheme';
import { useSyncTriggers } from '../sync/useSync';
import styles from './AppShell.module.css';
import { Footer } from './Footer';
import { SETTINGS, TABS } from './nav';
import { historyDaysCopy, ProfileButton } from './ProfileMenu';
import { RefreshData } from './RefreshData';
import { UpdateToast } from './UpdateToast';

export function AppShell() {
  useSyncTriggers();
  useSampleSeed();
  useApplyTheme();
  useApplyClock();
  usePeriodicSync();
  return (
    <div className={styles.shell}>
      <Sidebar />
      <div className={styles.column}>
        <main className={styles.main}>
          <Outlet />
        </main>
        <Footer />
      </div>
      <nav aria-label="Sections" className={styles.tabbar}>
        {TABS.map(({ to, label, Icon }) => (
          <Link key={to} to={to} activeOptions={{ exact: true }} className={styles.tab}>
            <Icon />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      <UpdateToast />
    </div>
  );
}

function Sidebar() {
  const sample = useAppMode() === 'sample';
  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarInner}>
        <Link to="/" className={styles.logo}>
          <span className={styles.mark} aria-hidden="true">
            <span>統</span>
            <span>計</span>
          </span>
          WaniStats
        </Link>
        <nav aria-label="Sections" className={styles.nav}>
          {[...TABS, SETTINGS].map(({ to, label, Icon }) => (
            <Link key={to} to={to} activeOptions={{ exact: true }} className={styles.navLink}>
              <Icon size={20} />
              {label}
            </Link>
          ))}
        </nav>
        <div className={styles.account}>
          {!sample && <SyncStatus />}
          <ProfileButton />
          {sample ? (
            <span className={styles.who}>
              <strong>Sample data</strong>
              <span className={styles.level}>Not logged in</span>
            </span>
          ) : (
            <LiveStatus />
          )}
        </div>
      </div>
    </aside>
  );
}

function LiveStatus() {
  const user = useUser();
  return (
    <>
      <span className={styles.who}>
        <strong>{user?.username}</strong>
        {user && <span className={styles.level}>Level {user.level}</span>}
      </span>
      <RefreshData compact />
    </>
  );
}

function SyncStatus() {
  const lastSync = useLastSyncAt();
  const history = useHistoryRange();
  const clock = useClock();
  return (
    <>
      {lastSync != null && (
        <span className={styles.line}>Synced {formatSyncTime(lastSync, clock)}</span>
      )}
      <Link to="/settings" hash="history" className={`${styles.line} ${styles.statusLink}`}>
        {historyDaysCopy(history?.days ?? 0)}
      </Link>
    </>
  );
}
