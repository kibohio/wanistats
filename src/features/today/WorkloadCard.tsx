import { Link } from '@tanstack/react-router';
import { Card } from '../../components/Card';
import { formatMinutes, formatTime, formatWindow } from '../../format';
import { gaugeMax, trendPoints } from '../../domain/today';
import type { StageCounts } from '../../db/schema';
import { Explain } from './Explain';
import { int, pct, plural } from './format';
import styles from './Today.module.css';
import type { TodayData } from './useToday';

const STATUS = { under: 'Below', in: 'Inside', over: 'Above' } as const;

const SUB_STAGES: [keyof StageCounts, string, string][] = [
  ['a1', 'A1', 'var(--srs-a1)'],
  ['a2', 'A2', 'var(--srs-a2)'],
  ['a3', 'A3', 'var(--srs-a3)'],
  ['a4', 'A4', 'var(--srs-a4)'],
  ['g1', 'G1', 'var(--srs-guru)'],
  ['g2', 'G2', 'var(--srs-guru-2)'],
];
const SUB_NAMES: Record<string, string> = {
  A1: 'Apprentice 1',
  A2: 'Apprentice 2',
  A3: 'Apprentice 3',
  A4: 'Apprentice 4',
  G1: 'Guru 1',
  G2: 'Guru 2',
};

function SubStages({ d }: { d: TodayData }) {
  return (
    <div className={styles.flight}>
      {SUB_STAGES.map(([key, label, color]) => (
        <div key={key} className={styles.flightCell}>
          <span className={styles.flightBar} style={{ background: color }} />
          <span className={styles.flightN}>{d.work.stages[key]}</span>
          <abbr title={SUB_NAMES[label]} className={styles.flightLabel}>
            {label}
          </abbr>
        </div>
      ))}
    </div>
  );
}

function LoadExplain({ d, children }: { d: TodayData; children: React.ReactNode }) {
  const { work } = d;
  return (
    <Explain
      title="Workload"
      explain={
        <>
          <p>
            Load = Apprentice + Guru ÷ 10 = {work.apprentice} + {work.guru} ÷ 10 = {int(work.load)}.
            Apprentice items come back within days, Guru items about every one or two weeks, so each
            Guru item weighs a tenth.
          </p>
          <p>
            The comfortable band is {work.band.min} to {work.band.max}. Change it in Settings.
          </p>
          <SubStages d={d} />
        </>
      }
    >
      {children}
    </Explain>
  );
}

function Gauge({ d, labels }: { d: TodayData; labels: boolean }) {
  const { work } = d;
  const max = gaugeMax(work.load, work.band);
  const at = (n: number) => `${Math.min(100, (n / max) * 100)}%`;
  return (
    <div className={styles.gaugeWrap}>
      <div className={styles.gauge} aria-hidden="true">
        <span
          className={styles.gaugeBand}
          style={{
            left: at(work.band.min),
            width: `calc(${at(work.band.max)} - ${at(work.band.min)})`,
          }}
        />
        <span className={styles.gaugeMark} style={{ left: `calc(${at(work.load)} - 1px)` }} />
      </div>
      {labels && (
        <div className={styles.gaugeLabels} aria-hidden="true">
          <span style={{ left: 0 }}>0</span>
          <span style={{ left: at(work.band.min), transform: 'translateX(-50%)' }}>
            {work.band.min}
          </span>
          <span style={{ left: at(work.band.max), transform: 'translateX(-50%)' }}>
            {work.band.max}
          </span>
          <span style={{ right: 0 }}>{max}</span>
        </div>
      )}
    </div>
  );
}

const TREND_BOX = { width: 120, height: 24 };

function Trend({ d }: { d: TodayData }) {
  if (!d.trend.available || d.trend.points.length < 2) return null;
  const t = trendPoints(d.trend.points, d.now, TREND_BOX);
  return (
    <Explain
      className={styles.trend}
      title="Load trend"
      explain={
        <>
          <p>
            Load from each daily snapshot over the last 30 days. Missed days merge into the next
            snapshot, so a gap shows as one longer step, never as zeros.
          </p>
          <ul className={styles.itemList}>
            {d.trend.points.map((p) => (
              <li key={p.to}>
                <span>{p.from === p.to ? p.to : `${p.from} to ${p.to}`}</span>
                <span className={styles.itemMeta}>{int(p.load)}</span>
              </li>
            ))}
          </ul>
        </>
      }
    >
      <span className={styles.trendLabel} aria-hidden="true">
        Last 30 days
      </span>
      <svg
        role="img"
        aria-label={`Load over the last 30 days, between ${int(t.min)} and ${int(t.max)}.`}
        viewBox={`-2 -2 ${TREND_BOX.width + 4} ${TREND_BOX.height + 4}`}
        width={TREND_BOX.width}
        height={TREND_BOX.height}
        className={styles.trendSvg}
      >
        <polyline points={t.points} fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <span className={styles.trendLabel} aria-hidden="true">
        {int(t.min)} to {int(t.max)}
      </span>
    </Explain>
  );
}

function Hours({ d }: { d: TodayData }) {
  const { day24, peak } = d;
  return (
    <>
      <div className={styles.hoursHead}>
        <Explain
          className={styles.hoursTotal}
          title="Next 24 hours"
          explain={
            <>
              <p>
                Started, unburned reviews whose next review falls before{' '}
                {formatTime(day24.bins.at(-1)!.end, d.clock)} tomorrow, counting{' '}
                {int(d.availableNow)} already waiting. New lessons are not included.
              </p>
              <ul className={styles.itemList}>
                {day24.bins
                  .filter((b) => b.total > 0)
                  .map((b) => (
                    <li key={b.start}>
                      <span>{formatTime(b.start, d.clock)}</span>
                      <span className={styles.itemMeta}>
                        {b.total} {b.total === 1 ? 'review' : 'reviews'}
                        {b.critical > 0 && `, ${b.critical} level-critical`}
                      </span>
                    </li>
                  ))}
              </ul>
            </>
          }
        >
          {plural(Math.round(day24.total), 'review')} in the next 24 hours
        </Explain>
        <Link to="/timeline" className={styles.link}>
          Timeline
        </Link>
      </div>
      <ul
        className={styles.hours}
        aria-label={
          peak
            ? `Reviews by hour. Heaviest at ${formatTime(day24.bins[peak.index].start, d.clock)} with ${peak.total}.`
            : 'Reviews by hour. None due.'
        }
      >
        {day24.bins.map((b, i) => (
          <li
            key={b.start}
            aria-label={`${formatTime(b.start, d.clock)}, ${b.total} ${b.total === 1 ? 'review' : 'reviews'}`}
            className={
              b.total === 0 ? styles.hourEmpty : i === peak?.index ? styles.hourPeak : styles.hour
            }
            style={{
              height: b.total === 0 ? 2 : Math.max(4, Math.round((b.total / peak!.total) * 44)),
            }}
          />
        ))}
      </ul>
      <div className={styles.hoursFoot} aria-hidden="true">
        <span>Now</span>
        {peak && (
          <span>
            {peak.index === 0
              ? 'Peak now'
              : `${formatTime(day24.bins[peak.index].start, d.clock)} peak`}
            , {peak.total}
          </span>
        )}
        <span>+24h</span>
      </div>
    </>
  );
}

function SteadyLine({ d }: { d: TodayData }) {
  const own = d.sample ? 'the' : 'your';
  const window =
    formatWindow([d.lessonWindow.morning, d.lessonWindow.evening], d.clock).join(' or ') || null;
  if (d.steady === null && !window) return null;
  return (
    <Explain
      className={styles.para}
      title="Steady state"
      explain={
        <>
          {d.steady !== null && (
            <p>
              Reviews a day once lessons reach burn = lessons a day × 8 ÷ item accuracy ={' '}
              {d.lessonsPerDay} × 8 ÷ {pct(d.itemAccuracy)} = about {int(d.steady)}. Each item takes
              eight right answers to burn; misses add more. Item accuracy is an estimate (
              {d.accuracy.recent30 ? 'last 30 days' : 'lifetime'}). Lessons a day is set in
              Settings.
            </p>
          )}
          {window && (
            <p>
              Lessons at {window} keep the first two Apprentice reviews inside {own} waking hours,{' '}
              {formatMinutes(d.wakeMin, d.clock)} to {formatMinutes(d.sleepMin, d.clock)}. Waking
              hours are set in Settings.
            </p>
          )}
        </>
      }
    >
      {d.steady !== null &&
        `At ${plural(d.lessonsPerDay, 'lesson')} a day, reviews settle at about ${int(d.steady)} a day once burns start. `}
      {window &&
        `Lessons fit best ${window.includes(' to ') ? 'between' : 'at'} ${window.replace(' to ', ' and ')}.`}
    </Explain>
  );
}

export function WorkloadCard({ d, desktop }: { d: TodayData; desktop?: boolean }) {
  const { work } = d;
  const own = d.sample ? 'the' : 'your';
  return (
    <Card
      className={desktop ? styles.workloadDesktop : undefined}
      title="Workload"
      aside={
        desktop
          ? 'Apprentice + Guru ÷ 10'
          : `Apprentice ${work.apprentice} + Guru ${work.guru} ÷ 10`
      }
    >
      <div className={styles.loadRow}>
        <LoadExplain d={d}>
          <span className={styles.load}>{int(work.load)}</span>
        </LoadExplain>
        <span className={styles.loadStatus}>
          {STATUS[work.status]} {own} {work.band.min} to {work.band.max} band
        </span>
      </div>
      <Gauge d={d} labels={!desktop} />
      <Trend d={d} />
      {desktop && <SubStages d={d} />}
      <div className={styles.divider} />
      <Hours d={d} />
      {desktop && <SteadyLine d={d} />}
    </Card>
  );
}
