import { useId, type ReactNode } from 'react';
import styles from './Card.module.css';

interface Props {
  title?: string;
  /** Right side of the title row, e.g. "18 of 30 kanji at Guru". */
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Card({ title, aside, className, children }: Props) {
  const id = useId();
  return (
    <section
      aria-labelledby={title ? id : undefined}
      className={`${styles.card} ${className ?? ''}`}
    >
      {title && (
        <div className={styles.head}>
          <h2 id={id} className={styles.title}>
            {title}
          </h2>
          {aside && <span className={styles.aside}>{aside}</span>}
        </div>
      )}
      {children}
    </section>
  );
}
