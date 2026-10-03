import type { ReactNode } from 'react';
import styles from './Chip.module.css';

interface Props {
  children: ReactNode;
  /** With onClick the chip becomes a toggle button (Items presets). */
  pressed?: boolean;
  onClick?: () => void;
  className?: string;
}

export function Chip({ children, pressed, onClick, className }: Props) {
  const cls = `${styles.chip} ${className ?? ''}`;
  if (!onClick) return <span className={cls}>{children}</span>;
  return (
    <button type="button" aria-pressed={pressed} className={cls} onClick={onClick}>
      {children}
    </button>
  );
}
