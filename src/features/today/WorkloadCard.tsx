import { Link } from '@tanstack/react-router';
import { useId } from 'react';
import { Card } from '../../components/Card';
import { Stepper } from '../../components/Stepper';
import { Tooltip } from '../../components/Tooltip';
import { usePref } from '../../db/prefs';
import { formatTime } from '../../format';
import { gaugeMax, trendPoints } from '../../domain/today';
import { bandStatus } from '../../domain/workload';
import type { StageCounts } from '../../db/schema';
import { Explain } from './Explain';
import { int, pct, plural } from './format';
import styles from './Today.module.css';
import type { TodayData } from './useToday';

const STATUS = { under: 'Below', in: 'Inside', over: 'Above' } as const;
const PROJECTED = { under: 'below', in: 'inside', over: 'above' } as const;

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
          <Tooltip content={SUB_NAMES[label]}>
            <abbr className={styles.flightLabel}>
              <span aria-hidden="true">{label}</span>
              <span className="visually-hidden">{SUB_NAMES[label]}</span>
            </abbr>
          </Tooltip>
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
          </p>
          <p>
            Apprentice items come back within hours or days. Guru items come back every week or two,
            so each one counts a tenth as much.
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
  const ghost = d.projected?.load;
  const max = gaugeMax(Math.max(work.load, ghost ?? 0), work.band);
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
        {ghost != null && (
          <span className={styles.gaugeGhost} style={{ left: `calc(${at(ghost)} - 1px)` }} />
        )}
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
            Load on each day of the last 30. Missed days merge into the next one, so a gap shows as
            one longer step, not a drop to zero.
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
                Reviews due before {formatTime(day24.bins.at(-1)!.end, d.clock)} tomorrow
                {d.availableNow > 0 && `, including the ${int(d.availableNow)} waiting now`}. New
                lessons aren&apos;t counted.
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

function SteadyInfo({ d }: { d: TodayData }) {
  const p = d.projected!;
  const acc = `${d.sample ? "the sample's" : 'your'} ${pct(d.itemAccuracy)} accuracy`;
  return (
    <>
      <p>
        At {plural(d.lessonsPerDay, 'new lesson')} a day, workload settles near {int(p.load)} (
        {int(p.apprentice)} Apprentice + {int(p.guru)} Guru ÷ 10), shown as the dashed mark.
      </p>
      <p>
        Each count is lessons a day times the days items spend in those stages: the SRS waits plus
        half a day per review until you get to it, stretched by {acc} for the ones that come back.
      </p>
      <p>
        Separately, reviews average about {int(d.steady!)} a day once items start burning (
        {d.lessonsPerDay} lessons × 8 reviews each, adjusted for {acc}).
      </p>
    </>
  );
}

function Projection({ d }: { d: TodayData }) {
  const id = useId();
  const [, setPerDay] = usePref('lessonsPerDay');
  const p = d.projected!;
  return (
    <div className={styles.projection}>
      <span className={styles.perDay}>
        <Stepper
          id={id}
          label="Lessons a day"
          value={d.lessonsPerDay}
          min={0}
          max={100}
          onChange={(v) => void setPerDay(v)}
        />
        <label htmlFor={id}>lessons a day</label>
      </span>
      {/* Two different units: workload (the gauge's scale) and reviews a day. Label both. */}
      <p className={styles.para}>
        <span className={styles.ghostKey} aria-hidden="true" />
        Workload heads for about {int(p.load)}, {PROJECTED[bandStatus(p.load, d.work.band)]}{' '}
        {d.sample ? 'the' : 'your'} band.
      </p>
      <p className={styles.para}>Reviews: about {int(d.steady!)} a day, long term.</p>
    </div>
  );
}

export function WorkloadCard({ d, desktop }: { d: TodayData; desktop?: boolean }) {
  const { work } = d;
  const own = d.sample ? 'the' : 'your';
  return (
    <Card
      className={desktop ? styles.workloadDesktop : undefined}
      title="Workload"
      info={d.projected && d.steady !== null && <SteadyInfo d={d} />}
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
      {d.projected && d.steady !== null && <Projection d={d} />}
      <Trend d={d} />
      {desktop && <SubStages d={d} />}
      <div className={styles.divider} />
      <Hours d={d} />
    </Card>
  );
}
