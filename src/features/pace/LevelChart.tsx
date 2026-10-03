import { useLayoutEffect, useRef } from 'react';
import { Card } from '../../components/Card';
import type { ResetMarker } from '../../domain/levels';
import type { PaceRow, PaceStats } from '../../domain/pace';
import { Figure } from './Figure';
import { fmtDays, plural } from './format';
import styles from './Pace.module.css';

const PLOT_PX = 118;

interface Props {
  stats: PaceStats;
  resets: ResetMarker[];
  onToggle: (row: PaceRow) => void;
}

function status(r: PaceRow): string {
  if (r.current) return 'in progress';
  if (r.included) return 'counted';
  return r.autoExcluded ? 'left out automatically' : 'left out';
}

const andList = (xs: number[]) =>
  xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : String(xs[0]);

export function LevelChart({ stats, resets, onToggle }: Props) {
  const { rows } = stats;
  const scroller = useRef<HTMLDivElement>(null);
  // Start at the current level, the end of the chart.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  const resetTo = new Set(resets.map((r) => r.to));
  const maxDays = Math.max(1, ...rows.map((r) => r.days));
  // Idle levels would flatten the rest; clip anything past the auto-exclusion threshold.
  const cap = Math.min(maxDays, 3 * (stats.medianAllDays ?? maxDays)) || maxDays;
  const auto = rows.filter((r) => r.autoExcluded).map((r) => r.level);
  const completed = rows.filter((r) => !r.current);

  const table = (
    <>
      <p>
        The median of the counted levels: half took longer, half took less. Quartiles use inclusive
        linear interpolation. Levels over 3 times the median of the others are left out unless you
        count them.
      </p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Level</th>
              <th scope="col">Days</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.level}>
                <th scope="row">{r.level}</th>
                <td>{fmtDays(r.days)}</td>
                <td>
                  {status(r).replace(/^./, (c) => c.toUpperCase())}
                  {r.estimated && ', estimated'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  return (
    <Card
      title="Time per level"
      aside={
        <Figure title="Median time per level" className={styles.asideFigure} explain={table}>
          {stats.medianDays === null ? 'No median yet' : `Median ${fmtDays(stats.medianDays)} d`}
        </Figure>
      }
    >
      <div ref={scroller} className={styles.scroller}>
        <div className={styles.bars}>
          {rows.map((r) => {
            const clipped = r.days > cap;
            const cls = [
              styles.bar,
              r.current ? styles.current : r.included ? styles.counted : styles.left,
              r.estimated && styles.estimated,
              clipped && styles.clipped,
            ]
              .filter(Boolean)
              .join(' ');
            const height = Math.max(2, Math.round((Math.min(r.days, cap) / cap) * PLOT_PX));
            const label = `Level ${r.level}, ${fmtDays(r.days)} days${r.current ? ' so far' : ''}, ${status(r)}${r.estimated ? ', estimated' : ''}`;
            return (
              <div key={r.level} className={styles.col}>
                <div className={styles.plot}>
                  {resetTo.has(r.level) && <span className={styles.reset} aria-hidden="true" />}
                  <span className={styles.top} aria-hidden="true">
                    {clipped || r.days >= 100 ? Math.round(r.days) : fmtDays(r.days)}
                  </span>
                  {r.current ? (
                    <span role="img" aria-label={label} className={cls} style={{ height }} />
                  ) : (
                    <button
                      type="button"
                      aria-label={label}
                      aria-pressed={r.included}
                      className={cls}
                      style={{ height }}
                      onClick={() => onToggle(r)}
                    />
                  )}
                </div>
                <span className={styles.lvl} aria-hidden="true">
                  {r.level}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.legend}>
        <span>
          <i className={`${styles.swatch} ${styles.counted}`} />
          Counted
        </span>
        <span>
          <i className={`${styles.swatch} ${styles.left}`} />
          Left out
        </span>
        <span>
          <i className={`${styles.swatch} ${styles.current}`} />
          In progress
        </span>
        {rows.some((r) => r.estimated) && (
          <span>
            <i className={`${styles.swatch} ${styles.counted} ${styles.estimated}`} />
            Estimated
          </span>
        )}
        {[...resetTo].map((to) => (
          <span key={to}>
            <i className={styles.resetSwatch} />
            Reset to {to}
          </span>
        ))}
      </div>

      <p className={styles.body}>
        {completed.length === 0
          ? 'Levels appear here as you pass them.'
          : 'Tap a bar to count a level or leave it out.'}
        {auto.length > 0 &&
          ` ${auto.length > 1 ? 'Levels' : 'Level'} ${andList(auto)} took over 3 times as long as the others and ${auto.length > 1 ? 'are' : 'is'} left out by default.`}
        {stats.meanAllDays !== null && stats.medianAllDays !== null && (
          <>
            {' '}
            Counting every passed level, the{' '}
            <Figure
              title="Mean of every level"
              className={styles.inline}
              explain={
                <p>
                  The total time of all {plural(completed.length, 'passed level')}, idle ones
                  included, divided by {completed.length}: {fmtDays(stats.meanAllDays)} days. The
                  median of the same levels is {fmtDays(stats.medianAllDays)} days. A few long
                  breaks pull the mean up, which is why the pace uses the median.
                </p>
              }
            >
              mean reads {fmtDays(stats.meanAllDays)} days
            </Figure>
            ; the median reads {fmtDays(stats.medianAllDays)}.
          </>
        )}
      </p>
    </Card>
  );
}
