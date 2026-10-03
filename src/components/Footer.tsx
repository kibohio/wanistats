import { Link } from '@tanstack/react-router';
import { COMPANY, SOURCE_URL } from '../config';
import styles from './Footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.links}>
        <span>Built and maintained by {COMPANY}</span>
        <a href={SOURCE_URL}>Source on GitHub</a>
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms</Link>
      </div>
      <p>
        WaniStats is an independent project, not affiliated with or endorsed by WaniKani or Tofugu,
        LLC. WaniKani is a trademark of Tofugu, LLC.
      </p>
    </footer>
  );
}
