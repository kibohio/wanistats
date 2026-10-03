import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from './Button';
import styles from './UpdateToast.module.css';

/** Registers the service worker and offers the waiting version (registerType: prompt). */
export function UpdateToast() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div role="status" className={styles.toast}>
      <span>A new version is ready.</span>
      <Button small onClick={() => void updateServiceWorker(true)}>
        Reload
      </Button>
    </div>
  );
}
