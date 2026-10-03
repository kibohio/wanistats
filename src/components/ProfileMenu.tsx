import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useHistoryRange, useLastSyncAt, useUser, type HistoryRange } from '../db/hooks';
import { useAppMode } from '../db/useAppMode';
import { formatSyncTime } from '../format';
import { Button, buttonClass } from './Button';
import { PersonIcon } from './icons';
import { LogoutSheet } from './LogoutSheet';
import styles from './ProfileMenu.module.css';
import { RefreshData } from './RefreshData';
import { Sheet } from './Sheet';

export function historyDaysCopy(days: number): string {
  return `History: ${days} ${days === 1 ? 'day' : 'days'} recorded`;
}

const dayMonth = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });

/** "History: 12 days recorded since 21 Sep. Last snapshot today at 14:02." */
export function historyReadout(h: HistoryRange, now = Date.now()): string {
  let out = historyDaysCopy(h.days);
  if (h.first) {
    const [y, m, d] = h.first.split('-').map(Number);
    out += ` since ${dayMonth.format(new Date(y!, m! - 1, d))}`;
  }
  out += '.';
  if (h.lastTakenAt) {
    const at = Date.parse(h.lastTakenAt);
    const today = new Date(at).toDateString() === new Date(now).toDateString();
    out += ` Last snapshot ${today ? `today at ${formatSyncTime(at, now)}` : formatSyncTime(at, now)}.`;
  }
  return out;
}

/** Profile button plus its menu: the account sheet and the logout confirmation. */
export function ProfileButton({ className }: { className?: string }) {
  const [view, setView] = useState<'closed' | 'menu' | 'logout'>('closed');
  const mode = useAppMode();
  const user = useUser();
  const close = () => setView('closed');
  return (
    <>
      <button
        type="button"
        aria-label="Account and settings"
        className={`${styles.button} ${className ?? ''}`}
        onClick={() => setView('menu')}
      >
        <span className={styles.circle}>
          {mode === 'sample' ? <PersonIcon size={20} /> : user?.username.charAt(0).toUpperCase()}
        </span>
      </button>
      <Sheet open={view === 'menu'} onClose={close} title="Account">
        {mode === 'sample' ? (
          <div className={styles.menu}>
            <p className={styles.note}>You&apos;re viewing sample data</p>
            <Link to="/login" className={buttonClass('primary')} onClick={close}>
              Log in with WaniKani
            </Link>
            <Link to="/settings" className={buttonClass('secondary')} onClick={close}>
              Settings
            </Link>
          </div>
        ) : (
          <LiveMenu onClose={close} onLogout={() => setView('logout')} />
        )}
      </Sheet>
      <LogoutSheet open={view === 'logout'} onClose={close} />
    </>
  );
}

function LiveMenu({ onClose, onLogout }: { onClose: () => void; onLogout: () => void }) {
  const user = useUser();
  const lastSync = useLastSyncAt();
  const history = useHistoryRange();
  return (
    <div className={styles.menu}>
      {user && (
        <p>
          Signed in as <strong>{user.username}</strong>, Level {user.level}
        </p>
      )}
      <RefreshData />
      {lastSync != null && <p className={styles.note}>Last synced {formatSyncTime(lastSync)}</p>}
      <Link to="/settings" hash="history" className={styles.note} onClick={onClose}>
        {history ? historyReadout(history) : historyDaysCopy(0)}
      </Link>
      <Link to="/settings" className={buttonClass('secondary')} onClick={onClose}>
        Settings
      </Link>
      <Button onClick={onLogout}>Log out</Button>
    </div>
  );
}
