import type { SelectHTMLAttributes } from 'react';
import { ChevronDownIcon } from './icons';
import styles from './Select.module.css';

/** Native select with one caret style everywhere; the wrapper only positions the caret. */
export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={`${styles.wrap} ${className ?? ''}`}>
      <select {...props} className={styles.select} />
      <ChevronDownIcon size={16} strokeWidth={2} className={styles.caret} />
    </span>
  );
}
