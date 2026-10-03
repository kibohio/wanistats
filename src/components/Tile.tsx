import type { CSSProperties } from 'react';
import styles from './Tile.module.css';

interface Props {
  char: string;
  /** WaniKani srs_stage 0-9; undefined for locked or not in WaniKani. 0 draws a blank square. */
  srsStage?: number;
  /** Side in px; words keep the height and grow wider. Without it the tile fills its grid cell. */
  size?: number;
  /** critical: level-critical; slack: can be missed; outside: in a list but not in WaniKani. */
  mark?: 'critical' | 'slack' | 'outside';
  /** Required when the tile is a button; stage names must be in it (never colour alone). */
  'aria-label'?: string;
  title?: string;
  onClick?: () => void;
  className?: string;
}

export function Tile({ char, srsStage, size, mark, onClick, className, ...rest }: Props) {
  const stage = srsStage && srsStage >= 1 && srsStage <= 9 ? styles[`s${srsStage}`] : styles.blank;
  const word = [...char].length > 1;
  const cls = [styles.tile, word && styles.word, stage, mark && styles[mark], className]
    .filter(Boolean)
    .join(' ');
  const style: CSSProperties | undefined = size
    ? word
      ? { minWidth: size, height: size, fontSize: Math.round(size * 0.5) }
      : { width: size, height: size, fontSize: Math.round(size * 0.55) }
    : undefined;
  const inner = <span className={styles.char}>{char}</span>;
  return onClick ? (
    <button type="button" className={cls} style={style} onClick={onClick} {...rest}>
      {inner}
    </button>
  ) : (
    <span className={cls} style={style} {...rest}>
      {inner}
    </span>
  );
}
