import { Link } from '@tanstack/react-router';
import { useAppMode } from '../db/useAppMode';
import { buttonClass } from './Button';
import styles from './SampleStrip.module.css';

export function SampleStrip() {
  if (useAppMode() !== 'sample') return null;
  return (
    <div className={styles.strip}>
      <span>Sample data. None of this is yours yet.</span>
      <Link to="/login" className={buttonClass('primary', true)}>
        Log in with WaniKani
      </Link>
    </div>
  );
}
