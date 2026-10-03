import type { ReactNode } from 'react';
import styles from './Kanji.module.css';

// Floor, so a list with one unknown entry never reads 100%.
export const pctText = (pct: number) => `${Math.floor(pct)}%`;
export const num = (n: number) => n.toLocaleString('en-US');

export interface Bar {
  key: string;
  label: string;
  pct: number;
  known: number;
  total: number;
}

/** Coverage bars. With onPick each row is a button that shows the entries behind it. */
export function CoverageBars({
  bars,
  label,
  onPick,
}: {
  bars: Bar[];
  label: string;
  onPick?: (key: string) => void;
}) {
  return (
    <ul className={styles.bars} aria-label={label}>
      {bars.map((b) => {
        const text = `${b.label}: ${pctText(b.pct)} known, ${num(b.known)} of ${num(b.total)}`;
        const inner = (
          <>
            <span className={styles.barName}>{b.label}</span>
            <span className={styles.barTrack}>
              <span className={styles.barFill} style={{ width: `${b.pct}%` }} />
            </span>
            <span className={styles.barPct}>{pctText(b.pct)}</span>
          </>
        );
        return (
          <li key={b.key} className={styles.barRow}>
            {onPick ? (
              <button
                type="button"
                className={styles.barButton}
                aria-label={`${text}. Show in grid`}
                onClick={() => onPick(b.key)}
              >
                {inner}
              </button>
            ) : (
              <div className={styles.barButton} role="img" aria-label={text}>
                {inner}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** A figure with its formula one tap away. */
export function Explained({ children, how }: { children: ReactNode; how: ReactNode }) {
  return (
    <details className={styles.explained}>
      <summary className={styles.line}>{children}</summary>
      <div className={styles.how}>{how}</div>
    </details>
  );
}

export const Estimated = () => <span className={styles.tag}>estimated</span>;
