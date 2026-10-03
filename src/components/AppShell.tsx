import { Link, Outlet } from '@tanstack/react-router';
import { useAppMode } from '../db/useAppMode';
import styles from './AppShell.module.css';
import { Button } from './Button';
import { Footer } from './Footer';
import { RefreshIcon } from './icons';
import { SETTINGS, TABS } from './nav';
import { ProfileButton } from './ProfileMenu';
import { UpdateToast } from './UpdateToast';

export function AppShell() {
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
      <div className={styles.status}>
        {/* ponytail: sample-mode placeholder; sync time and history days arrive with sync */}
        <Button small disabled={sample}>
          <RefreshIcon size={16} strokeWidth={2} />
          Refresh data
        </Button>
        {sample && <span>You&apos;re viewing sample data</span>}
        <div className={styles.profileRow}>
          <ProfileButton />
        </div>
      </div>
    </aside>
  );
}
