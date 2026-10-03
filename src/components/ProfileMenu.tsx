import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useAppMode } from '../db/useAppMode';
import { buttonClass } from './Button';
import { PersonIcon } from './icons';
import styles from './ProfileMenu.module.css';
import { Sheet } from './Sheet';

/** Profile button plus its menu. Sample mode only for now; the signed-in menu comes with login. */
export function ProfileButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const mode = useAppMode();
  const close = () => setOpen(false);
  return (
    <>
      <button
        type="button"
        aria-label="Account and settings"
        className={`${styles.button} ${className ?? ''}`}
        onClick={() => setOpen(true)}
      >
        <span className={styles.circle}>{mode === 'sample' && <PersonIcon size={20} />}</span>
      </button>
      <Sheet open={open} onClose={close} title="Account">
        <div className={styles.menu}>
          <p className={styles.note}>You&apos;re viewing sample data</p>
          <Link to="/login" className={buttonClass('primary')} onClick={close}>
            Log in with WaniKani
          </Link>
          <Link to="/settings" className={buttonClass('secondary')} onClick={close}>
            Settings
          </Link>
        </div>
      </Sheet>
    </>
  );
}
