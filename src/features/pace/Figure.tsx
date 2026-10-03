import { useState, type ReactNode } from 'react';
import { Sheet } from '../../components/Sheet';
import styles from './Pace.module.css';

interface Props {
  /** Sheet title. */
  title: string;
  /** Formula and the values behind the figure. */
  explain: ReactNode;
  /** Accessible name when the visible text needs its row label, e.g. "All Guru up to level 6". */
  label?: string;
  className?: string;
  children: ReactNode;
}

/** A figure that opens its own explanation when tapped. */
export function Figure({ title, explain, label, className, children }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={label}
        className={`${styles.figure} ${className ?? ''}`}
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={title}>
        <div className={styles.explain}>{explain}</div>
      </Sheet>
    </>
  );
}

/** Term and value rows inside an explanation. */
export function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className={styles.facts}>
      {rows.map(([term, value]) => (
        <div key={term}>
          <dt>{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
