import type { ReactNode } from 'react';
import { ProfileButton } from './ProfileMenu';
import { SampleStrip } from './SampleStrip';
import styles from './ScreenHeader.module.css';
import { StatusBanners } from './StatusBanners';

interface Props {
  /** Plain screen title. Use children instead for a custom lead (Today's level numeral). */
  title?: string;
  /** Small text on the right, e.g. "983 started" or "Synced 14:02". */
  aside?: ReactNode;
  children?: ReactNode;
}

/** Screen header with the profile button (phones) and the sample strip or status banners under it. */
export function ScreenHeader({ title, aside, children }: Props) {
  return (
    <>
      <header className={styles.header}>
        <div className={styles.lead}>
          {children ?? <h1 className={styles.title}>{title}</h1>}
          {aside && <span className={styles.aside}>{aside}</span>}
        </div>
        <ProfileButton className={styles.profile} />
      </header>
      <SampleStrip />
      <StatusBanners />
    </>
  );
}
