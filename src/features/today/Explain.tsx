import { useState, type ReactNode } from 'react';
import { Sheet } from '../../components/Sheet';
import styles from './Today.module.css';

interface Props {
  /** Sheet title, e.g. "Next level-up". */
  title: string;
  /** The formula and the items behind the figure. */
  explain: ReactNode;
  children: ReactNode;
  className?: string;
}

/** A figure that opens its formula and the items behind it when tapped. */
export function Explain({ title, explain, children, className }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        className={`${styles.explain} ${className ?? ''}`}
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={title}>
        <div className={styles.explainBody}>{explain}</div>
      </Sheet>
    </>
  );
}
