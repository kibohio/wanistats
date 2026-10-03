import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useHistoryRange, useLastSyncAt, useUser, type HistoryRange } from '../db/hooks';
import { useAppMode } from '../db/useAppMode';
import { formatSyncTime, type Clock } from '../format';
import { useClock } from '../hooks/useClock';
import { AvatarPicker, UserAvatar } from './Avatar';
import { Button, buttonClass } from './Button';
import { LogoutSheet } from './LogoutSheet';
import styles from './ProfileMenu.module.css';
import { RefreshData } from './RefreshData';
import { Sheet } from './Sheet';

export function historyDaysCopy(days: number): string {
  return `History: ${days} ${days === 1 ? 'day' : 'days'} recorded`;
}

const dayMonth = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });

/** "History: 12 days recorded since 21 Sep. Last snapshot today at 14:02." */
export function historyReadout(h: HistoryRange, clock: Clock, now = Date.now()): string {
  let out = historyDaysCopy(h.days);
  if (h.first) {
    const [y, m, d] = h.first.split('-').map(Number);
    out += ` since ${dayMonth.format(new Date(y!, m! - 1, d))}`;
  }
  out += '.';
  if (h.lastTakenAt) {
    const at = Date.parse(h.lastTakenAt);
    const today = new Date(at).toDateString() === new Date(now).toDateString();
    out += ` Last snapshot ${today ? `today at ${formatSyncTime(at, clock, now)}` : formatSyncTime(at, clock, now)}.`;
  }
  return out;
}

/** Profile button plus its menu: the account sheet and the logout confirmation. */
export function ProfileButton({ className }: { className?: string }) {
  const [view, setView] = useState<'closed' | 'menu' | 'avatar' | 'logout'>('closed');
  const mode = useAppMode();
  const close = () => setView('closed');
  return (
    <>
      <button
        type="button"
        aria-label="Account and settings"
        className={`${styles.button} ${className ?? ''}`}
        onClick={() => setView('menu')}
      >
        <UserAvatar size={34} />
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
          <LiveMenu
            onClose={close}
            onAvatar={() => setView('avatar')}
            onLogout={() => setView('logout')}
          />
        )}
      </Sheet>
      <Sheet open={view === 'avatar'} onClose={close} title="Change avatar">
        <AvatarPicker onPick={() => setView('menu')} />
      </Sheet>
      <LogoutSheet open={view === 'logout'} onClose={close} />
    </>
  );
}

function LiveMenu({
  onClose,
  onAvatar,
  onLogout,
}: {
  onClose: () => void;
  onAvatar: () => void;
  onLogout: () => void;
}) {
  const user = useUser();
  const lastSync = useLastSyncAt();
  const history = useHistoryRange();
  const clock = useClock();
  return (
    <div className={styles.menu}>
      <div className={styles.who}>
        <UserAvatar size={48} />
        {user && (
          <p>
            Signed in as <strong>{user.username}</strong>, Level {user.level}
          </p>
        )}
      </div>
      <Button onClick={onAvatar}>Change avatar</Button>
      <RefreshData />
      {lastSync != null && (
        <p className={styles.note}>Last synced {formatSyncTime(lastSync, clock)}</p>
      )}
      <Link to="/settings" hash="history" className={styles.note} onClick={onClose}>
        {history ? historyReadout(history, clock) : historyDaysCopy(0)}
      </Link>
      <Link to="/settings" className={buttonClass('secondary')} onClick={onClose}>
        Settings
      </Link>
      <Button onClick={onLogout}>Log out</Button>
    </div>
  );
}
