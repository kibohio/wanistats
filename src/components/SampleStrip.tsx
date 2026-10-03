import { Link } from '@tanstack/react-router';
import { useAppMode } from '../db/useAppMode';
import { buttonClass } from './Button';
import styles from './SampleStrip.module.css';

export function SampleStrip() {
  if (useAppMode() !== 'sample') return null;
  return (
    // Read by hash scrolling, which has to clear it.
    <div className={styles.strip} data-sticky-top>
      <span>Sample data. None of this is yours yet.</span>
      <Link to="/login" className={buttonClass('primary', true)}>
        Log in with WaniKani
      </Link>
    </div>
  );
}
