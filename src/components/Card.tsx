import { useId, type ReactNode } from 'react';
import styles from './Card.module.css';
import { InfoButton } from './InfoButton';

interface Props {
  title?: string;
  /** Right side of the title row, e.g. "18 of 30 kanji at Guru". */
  aside?: ReactNode;
  /** Explanation behind an info button beside the title. */
  info?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Card({ title, aside, info, className, children }: Props) {
  const id = useId();
  const heading = (
    <h2 id={id} className={styles.title}>
      {title}
    </h2>
  );
  return (
    <section
      aria-labelledby={title ? id : undefined}
      className={`${styles.card} ${className ?? ''}`}
    >
      {title && (
        <div className={styles.head}>
          {info ? (
            <div className={styles.titleRow}>
              {heading}
              <InfoButton label={`${title}, explained`}>{info}</InfoButton>
            </div>
          ) : (
            heading
          )}
          {aside && <span className={styles.aside}>{aside}</span>}
        </div>
      )}
      {children}
    </section>
  );
}
