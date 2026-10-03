import { useState, type KeyboardEvent } from 'react';
import { Card } from '../../components/Card';
import { Tooltip } from '../../components/Tooltip';
import type { CoverageCurve } from '../../domain/levelCharts';
import styles from './Coverage.module.css';
import { num, pctFine } from './parts';

/** One blue, light to dark in list order, like the per-level bars but dark enough for a 2px line. */
function lineShade(i: number, n: number): string {
  const t = n > 1 ? i / (n - 1) : 0.7;
  const light = (0.8 - 0.42 * t).toFixed(3);
  const dark = (0.93 - 0.38 * t).toFixed(3);
  return `light-dark(oklch(${light} 0.11 235), oklch(${dark} 0.1 235))`;
}

const W = 600;
const H = 200;
const Y_TICKS = [0, 25, 50, 75, 100];

interface Props {
  title: string;
  label: string;
  curve: CoverageCurve;
  /** The user's (or the sample's) WaniKani level. */
  level: number | undefined;
  isSample: boolean;
  /** "Guru or higher". */
  known: string;
  /** Show kanji counts beside percentages (not for weighted figures). */
  counts: boolean;
}

/** Cumulative coverage per WaniKani level as a line chart, with a table one tap away. */
export function CurveCard({ title, label, curve, level, isSample, known, counts }: Props) {
  const { series, rows } = curve;
  const n = rows.length;
  const [picked, setPicked] = useState<number | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  if (n === 0) {
    return (
      <Card title={title}>
        <p className={styles.note}>No kanji yet. They appear after the first sync.</p>
      </Card>
    );
  }

  const mine = level !== undefined && level <= n ? level : undefined;
  const at = cursor ?? mine ?? n;
  const xPct = (lv: number) => ((lv - 0.5) / n) * 100;
  const colors = series.map((_, i) => lineShade(i, series.length));
  const value = (row: CoverageCurve['rows'][number], i: number) =>
    counts
      ? `${pctFine(row.pct[i]!)} (${num(row.covered[i]!)} of ${num(series[i]!.size)})`
      : `${pctFine(row.pct[i]!)} of kanji in text`;
  const describe = (row: CoverageCurve['rows'][number]) =>
    `By level ${row.level}: ${series.map((s, i) => (series.length > 1 ? `${s.label} ${value(row, i)}` : value(row, i))).join(', ')}.`;
  const selected = rows.find((r) => r.level === picked);
  const youLabel = isSample ? 'Sample level' : 'Your level';
  const knownLabel = isSample ? 'Sample knows now' : 'Known now';
  const knownLine = `${knownLabel} at ${known}${mine ? `, on level ${mine}` : ''}: ${series
    .map((s) => (series.length > 1 ? `${s.label} ${pctFine(s.knownPct)}` : pctFine(s.knownPct)))
    .join(', ')}.`;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = { ArrowLeft: at - 1, ArrowRight: at + 1, Home: 1, End: n }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const lv = Math.min(n, Math.max(1, next));
    setCursor(lv);
    e.currentTarget.querySelectorAll('button')[lv - 1]?.focus();
  };

  return (
    <Card title={title}>
      <div className={styles.curve}>
        <div className={styles.curveY} aria-hidden="true">
          {Y_TICKS.map((t) => (
            <span key={t} style={{ top: `${100 - t}%` }}>
              {t}%
            </span>
          ))}
        </div>
        <div className={styles.curvePlot}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className={styles.curveSvg}
            aria-hidden="true"
          >
            {Y_TICKS.map((t) => (
              <line
                key={t}
                x1={0}
                x2={W}
                y1={H - (t / 100) * H}
                y2={H - (t / 100) * H}
                className={styles.curveGrid}
              />
            ))}
            {mine && (
              <line
                x1={(xPct(mine) / 100) * W}
                x2={(xPct(mine) / 100) * W}
                y1={0}
                y2={H}
                className={styles.curveYou}
              />
            )}
            {series.map((s, i) => (
              <polyline
                key={s.key}
                fill="none"
                stroke={colors[i]}
                strokeWidth={2}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                points={rows
                  .map((r) => `${(xPct(r.level) / 100) * W},${H - (r.pct[i]! / 100) * H}`)
                  .join(' ')}
              />
            ))}
          </svg>
          {mine &&
            series.map((s, i) => (
              <span
                key={s.key}
                className={styles.curveDot}
                style={{
                  left: `${xPct(mine)}%`,
                  top: `${100 - s.knownPct}%`,
                  background: colors[i],
                }}
                aria-hidden="true"
              />
            ))}
          {/* One tab stop; arrow keys move between levels. */}
          <div className={styles.curveHits} onKeyDown={onKeyDown} aria-label={label} role="toolbar">
            {rows.map((r) => (
              <Tooltip
                key={r.level}
                content={
                  <span className={styles.curveTip}>
                    <strong>By level {r.level}</strong>
                    {series.map((s, i) => (
                      <span key={s.key}>
                        {series.length > 1 && `${s.label}: `}
                        {value(r, i)}
                      </span>
                    ))}
                  </span>
                }
              >
                <button
                  type="button"
                  className={styles.curveHit}
                  tabIndex={r.level === at ? 0 : -1}
                  aria-label={describe(r)}
                  aria-pressed={r.level === picked}
                  onFocus={() => setCursor(r.level)}
                  onClick={() => setPicked(r.level === picked ? null : r.level)}
                />
              </Tooltip>
            ))}
          </div>
        </div>
        <div className={styles.curveX} aria-hidden="true">
          {rows
            .filter(
              (r) => r.level === 1 || r.level === n || (r.level % 10 === 0 && n - r.level >= 3),
            )
            .map((r) => (
              <span key={r.level} style={{ left: `${xPct(r.level)}%` }}>
                {r.level}
              </span>
            ))}
        </div>
      </div>
      <ul className={styles.legend} aria-label="Legend">
        {series.length > 1 &&
          series.map((s, i) => (
            <li key={s.key}>
              <span
                className={styles.lineSwatch}
                style={{ background: colors[i] }}
                aria-hidden="true"
              />
              {s.label}
            </li>
          ))}
        {mine && (
          <>
            <li>
              <span className={styles.youSwatch} aria-hidden="true" />
              {youLabel} ({mine})
            </li>
            <li>
              <span className={styles.dotSwatch} aria-hidden="true" />
              {knownLabel}
            </li>
          </>
        )}
      </ul>
      <p className={styles.note} aria-live="polite">
        {selected ? describe(selected) : knownLine}
      </p>
      <details className={styles.tableToggle}>
        <summary>Show as a table</summary>
        <div className={`${styles.tableWrap} ${styles.curveTableWrap}`}>
          <table
            className={`${styles.table} ${styles.curveTable} ${series.length === 1 ? styles.curveTableNarrow : ''}`}
          >
            <thead>
              <tr>
                <th scope="col">Level</th>
                {series.map((s) => (
                  <th key={s.key} scope="col">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.level}
                  className={r.level === mine ? styles.curveMine : undefined}
                  aria-current={r.level === mine ? 'true' : undefined}
                >
                  <th scope="row">
                    {r.level}
                    {r.level === mine && (
                      <>
                        {' '}
                        <span className={styles.curveMineTag}>{youLabel}</span>
                      </>
                    )}
                  </th>
                  {series.map((s, i) => (
                    <td key={s.key}>{pctFine(r.pct[i]!)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">{knownLabel}</th>
                {series.map((s) => (
                  <td key={s.key}>{pctFine(s.knownPct)}</td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </details>
    </Card>
  );
}
