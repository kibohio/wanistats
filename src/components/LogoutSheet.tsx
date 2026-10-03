import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { logout } from '../sync/session';
import { Button } from './Button';
import styles from './ProfileMenu.module.css';
import { Sheet } from './Sheet';

export function LogoutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    try {
      await logout(queryClient);
      onClose();
      await navigate({ to: '/' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Log out">
      <div className={styles.menu}>
        <p>
          Log out of WaniStats? Your synced data and history stay in this browser, so nothing is
          lost when you log in again. To remove everything, use Delete local data in Settings.
        </p>
        <Button variant="primary" disabled={busy} onClick={() => void confirm()}>
          Log out
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </div>
    </Sheet>
  );
}
