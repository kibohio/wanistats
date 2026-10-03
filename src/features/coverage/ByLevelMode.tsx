import { useMemo, useState } from 'react';
import { Card } from '../../components/Card';
import { Chip } from '../../components/Chip';
import { SegmentedControl } from '../../components/SegmentedControl';
import { Tooltip } from '../../components/Tooltip';
import { useAssignments, useSubjects, useUser } from '../../db/hooks';
import { usePref } from '../../db/prefs';
import { useAppMode } from '../../db/useAppMode';
import {
  cumulativeCoverage,
  levelChart,
  readingCoverage,
  type LevelBar,
  type LevelChartView,
} from '../../domain/levelCharts';
import { usePack } from '../../packs/hooks';
import { SAMPLE_COVERAGE_LABEL, sampleKanji } from '../../packs/sampleCoverage';
import { PackEmptyState, PackUpdateLine } from '../packs/PackPrompts';
import styles from './Coverage.module.css';
import { CurveCard } from './CurveCard';
import { Estimated, num } from './parts';
import { knownRange } from './stage';

const CHARTS = [
  { value: 'per', label: 'Per level' },
  { value: 'cumulative', label: 'Cumulative' },
  { value: 'reading', label: 'Reading' },
] as const;
type ChartKind = (typeof CHARTS)[number]['value'];

const VIEWS = [
  { value: 'jlpt', label: 'JLPT' },
  { value: 'joyo', label: 'Jōyō' },
  { value: 'frequency', label: 'Frequency' },
] as const;

const SHOWS = [
  { value: 'all', label: 'All kanji' },
  { value: 'known', label: 'Known' },
] as const;

const BY: Record<LevelChartView, string> = {
  jlpt: 'JLPT level (unofficial lists)',
  joyo: 'Jōyō school grade',
  frequency: 'Jiten frequency rank',
};

const GROUPS: Record<LevelChartView, string> = {
  jlpt: 'JLPT level (unofficial lists)',
  joyo: 'Jōyō school grade',
  frequency: 'Jiten frequency band',
};

const PLOT_PX = 160;

/** One blue, light to dark in list order; the last category (in none of the groups) is grey. */
function shade(i: number, n: number): string {
  if (i === n - 1) return 'light-dark(#b4b8be, #5c6169)';
  const t = n > 2 ? i / (n - 2) : 0;
  const light = (0.9 - 0.52 * t).toFixed(3);
  const dark = (0.93 - 0.45 * t).toFixed(3);
  return `light-dark(oklch(${light} 0.09 235), oklch(${dark} 0.09 235))`;
}

export function ByLevelMode() {
  const sampleMode = useAppMode() === 'sample';
  const subjects = useSubjects();
  const assignments = useAssignments();
  const installed = usePack('kanji');
  const isSample = installed === null && sampleMode;
  const pack = isSample ? sampleKanji : installed;
  const [knownStage] = usePref('knownStage');
  const level = useUser()?.level;
  const [kind, setKind] = useState<ChartKind>('per');
  const [view, setView] = useState<LevelChartView>('jlpt');
  const [show, setShow] = useState<'all' | 'known'>('all');
  const [picked, setPicked] = useState<number | null>(null);

  const chart = useMemo(
    () =>
      pack && subjects && assignments
        ? levelChart(view, subjects, assignments, pack, knownStage)
        : null,
    [view, subjects, assignments, pack, knownStage],
  );
  const curve = useMemo(() => {
    if (!pack || !subjects || !assignments || kind === 'per') return null;
    return kind === 'reading'
      ? readingCoverage(subjects, pack, assignments, knownStage)
      : cumulativeCoverage(view, subjects, pack, assignments, knownStage);
  }, [kind, view, subjects, assignments, pack, knownStage]);

  if (installed === undefined) return null;
  if (!pack) {
    return (
      <PackEmptyState packId="kanji">
        The by-level charts need the kanji lists to sort each level&apos;s kanji by JLPT level, Jōyō
        grade and frequency.
      </PackEmptyState>
    );
  }
  if (!chart) return null;

  const known = knownRange(knownStage);
  const { categories, levels } = chart;
  const max = Math.max(1, ...levels.map((l) => l.total));
  const cell = (l: LevelBar, i: number) =>
    show === 'known' && l.counts[i] ? `${l.knownCounts[i]} of ${l.counts[i]}` : String(l.counts[i]);
  const describe = (l: LevelBar) => {
    const parts = categories
      .filter((_, i) => l.counts[i]! > 0)
      .map((c) => `${c.label}: ${cell(l, categories.indexOf(c))}`);
    return `Level ${l.level}: ${num(l.total)} kanji, ${num(l.known)} known at ${known}. ${parts.join(', ')}.`;
  };
  const selected = levels.find((l) => l.level === picked);
  const legend = categories.map((c, i) => ({ label: c.label, color: shade(i, categories.length) }));

  return (
    <>
      <div className={styles.switches}>
        <SegmentedControl label="Chart" options={CHARTS} value={kind} onChange={setKind} />
        {kind !== 'reading' && (
          <SegmentedControl label="Break down by" options={VIEWS} value={view} onChange={setView} />
        )}
        {kind === 'per' && (
          <SegmentedControl label="Show" options={SHOWS} value={show} onChange={setShow} />
        )}
      </div>
      <p className={styles.line}>
        {kind === 'per' && (
          <>
            Each bar is one WaniKani level and the kanji it teaches, split by {BY[view]}.
            {show === 'known' &&
              ` Filled parts are the ones ${isSample ? 'the sample knows' : 'you know'} at ${known}.`}
          </>
        )}
        {kind === 'cumulative' &&
          `How much of each ${GROUPS[view]} WaniKani has taught by each level, counting every level before it.`}
        {kind === 'reading' && (
          <>
            How much of the kanji you&apos;d meet in Japanese text you can read after each level.
            Estimated from Jiten&apos;s frequency ranks. <Estimated />
          </>
        )}
        {isSample && (
          <>
            {' '}
            <Chip>{SAMPLE_COVERAGE_LABEL}</Chip>
          </>
        )}
      </p>
      {installed && <PackUpdateLine packId="kanji" />}

      {curve && (
        <CurveCard
          title={
            kind === 'reading'
              ? 'Reading coverage per WaniKani level'
              : 'Cumulative coverage per WaniKani level'
          }
          label={
            kind === 'reading'
              ? 'Estimated share of kanji in Jiten, all media, per WaniKani level'
              : `Share of each ${GROUPS[view]} taught per WaniKani level`
          }
          curve={curve}
          level={level}
          isSample={sampleMode}
          known={known}
          counts={kind === 'cumulative'}
        />
      )}

      {kind === 'per' && (
        <Card title="Kanji per WaniKani level">
          {levels.length === 0 ? (
            <p className={styles.note}>No kanji yet. They appear after the first sync.</p>
          ) : (
            <>
              <div className={styles.levelScroller}>
                <ul
                  className={styles.levelBars}
                  aria-label={`Kanji per WaniKani level by ${BY[view]}`}
                >
                  {levels.map((l) => (
                    <li key={l.level} className={styles.levelCol}>
                      <Tooltip content={describe(l)}>
                        <button
                          type="button"
                          className={styles.levelPlot}
                          aria-label={describe(l)}
                          aria-pressed={l.level === picked}
                          onClick={() => setPicked(l.level === picked ? null : l.level)}
                        >
                          {(show === 'known' ? l.knownCounts : l.counts).map(
                            (n, i) =>
                              n > 0 && (
                                <span
                                  key={i}
                                  className={styles.segment}
                                  style={{
                                    height: (n / max) * PLOT_PX,
                                    background: shade(i, categories.length),
                                  }}
                                />
                              ),
                          )}
                          {show === 'known' && l.total > l.known && (
                            <span
                              className={`${styles.segment} ${styles.notKnown}`}
                              style={{ height: ((l.total - l.known) / max) * PLOT_PX }}
                            />
                          )}
                        </button>
                      </Tooltip>
                      <span className={styles.levelNum} aria-hidden="true">
                        {l.level}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <ul className={styles.legend} aria-label="Legend">
                {legend.map((c) => (
                  <li key={c.label}>
                    <span
                      className={styles.levelSwatch}
                      style={{ background: c.color }}
                      aria-hidden="true"
                    />
                    {c.label}
                  </li>
                ))}
                {show === 'known' && (
                  <li>
                    <span
                      className={`${styles.levelSwatch} ${styles.notKnown}`}
                      aria-hidden="true"
                    />
                    Not known yet
                  </li>
                )}
              </ul>
              <p className={styles.note} aria-live="polite">
                {selected ? describe(selected) : 'Tap a bar for its numbers.'}
              </p>
              <details className={styles.tableToggle}>
                <summary>Show as a table</summary>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th scope="col">Level</th>
                        {categories.map((c) => (
                          <th key={c.key} scope="col">
                            {c.label}
                          </th>
                        ))}
                        <th scope="col">Total</th>
                        <th scope="col">Known</th>
                      </tr>
                    </thead>
                    <tbody>
                      {levels.map((l) => (
                        <tr key={l.level}>
                          <th scope="row">{l.level}</th>
                          {categories.map((c, i) => (
                            <td key={c.key}>{cell(l, i)}</td>
                          ))}
                          <td>{l.total}</td>
                          <td>{l.known}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          )}
        </Card>
      )}
    </>
  );
}
