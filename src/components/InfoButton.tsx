import { useId, type CSSProperties, type ReactNode } from 'react';
import { InfoIcon } from './icons';
import styles from './InfoButton.module.css';

/**
 * An "i" button that opens a short explanation. Native popover: opens on click or tap, closes on
 * Escape or a tap outside, no JS state.
 */
export function InfoButton({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  // Each button needs its own anchor name, or every popover would sit under the last button.
  const anchor = `--info-${id.replace(/[^\w-]/g, '')}`;
  return (
    <>
      <button
        type="button"
        popoverTarget={id}
        aria-label={label}
        className={styles.button}
        style={{ anchorName: anchor } as CSSProperties}
      >
        <InfoIcon size={18} />
      </button>
      <div
        id={id}
        popover="auto"
        className={styles.popover}
        style={{ positionAnchor: anchor } as CSSProperties}
      >
        {children}
      </div>
    </>
  );
}
