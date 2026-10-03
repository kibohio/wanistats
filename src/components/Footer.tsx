import { COMPANY, SOURCE_URL } from '../config';
import styles from './Footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <span>Built and maintained by {COMPANY}</span>
      <a href={SOURCE_URL}>Source on GitHub</a>
      <span>Not affiliated with WaniKani or Tofugu.</span>
    </footer>
  );
}
