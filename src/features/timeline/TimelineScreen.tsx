import { stageName } from '../../domain/items';
import { Link } from '@tanstack/react-router';
import { useId, useMemo, useState } from 'react';
import { Card } from '../../components/Card';
import { InfoIcon } from '../../components/icons';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SegmentedControl } from '../../components/SegmentedControl';
import {
  useAssignments,
  useReviewStatistics,
  useSnapshotDeltas,
  useSnapshots,
} from '../../db/hooks';
import { usePref } from '../../db/prefs';
import type { StageCounts } from '../../db/schema';
import { accuracy } from '../../domain/accuracy';
import { fmtTime, lessonWindow } from '../../domain/lessonWindow';
import { intervalFor } from '../../domain/srs';
import type { TimelineRange } from '../../domain/timeline';
import { steadyStateReviewsPerDay, workload } from '../../domain/workload';
import { useNow } from '../../hooks/useNow';
import styles from './Timeline.module.css';
import { LessonsToggle, RANGES, rangeTotal, TimelineCard, TimelineChart } from './TimelineChart';
import { granularityFor, useIsDesktop, useLessonSystem, useTimelineData } from './useTimelineData';

export function TimelineScreen() {
  const desktop = useIsDesktop();
  if (desktop) {
    return (
      <>
        <ScreenHeader title="Timeline" />
        <TimelineCard title="Upcoming reviews" />
        <div className={styles.cards}>
          <LessonWindowCard />
          <InFlightCard />
        </div>
      </>
    );
  }
  return (
    <>
      <PhoneTimeline />
      <LessonWindowCard />
      <InFlightCard />
    </>
  );
}

function PhoneTimeline() {
  const [range, setRange] = useState<TimelineRange>('7d');
  const [withLessons, setWithLessons] = useState(false);
  const granularity = granularityFor(range, false);
  const data = useTimelineData(range, granularity, withLessons);
  return (
    <>
      <ScreenHeader title="Timeline" aside={data && `${rangeTotal(data)} reviews ahead`} />
      <SegmentedControl label="Range" options={RANGES} value={range} onChange={setRange} />
      <section aria-label="Upcoming reviews" className={styles.panel}>
        <LessonsToggle checked={withLessons} onChange={setWithLessons} />
        {data ? (
          <TimelineChart key={range} data={data} granularity={granularity} />
        ) : (
          <p className={styles.loading}>Loading reviews</p>
        )}
      </section>
    </>
  );
}

/** Left offset on the 24-hour strip, from minutes since midnight. */
const pos = (m: number) => `${(((m % 1440) + 1440) % 1440) * (100 / 1440)}%`;
/** Centred on its time, sliding inward within 2.4 hours of either end so it stays on the strip. */
function labelAt(m: number) {
  const f = (((m % 1440) + 1440) % 1440) / 1440;
  const shift = f < 0.5 ? Math.min(f * 500, 50) : Math.max(100 - (1 - f) * 500, 50);
  return { left: pos(m), transform: `translateX(-${shift}%)` };
}

function LessonWindowCard() {
  const id = useId();
  const system = useLessonSystem();
  const [wakeMin] = usePref('wakeMin');
  const [sleepMin] = usePref('sleepMin');
  const [lessonMin] = usePref('lessonMin');
  const w = useMemo(
    () => system && lessonWindow(system, { wakeMin, sleepMin, lessonMin }),
    [system, wakeMin, sleepMin, lessonMin],
  );
  if (!system || !w) return null;
  const a1 = intervalFor(system, 1);
  const a2 = intervalFor(system, 2);
  const back1 = (m: number) => m + a1 * 60;
  const back2 = (m: number) => m + (a1 + a2) * 60;
  const [big, ...rest] = (w.label ?? 'No window').split(' or ');

  return (
    <section aria-labelledby={`${id}h`} className={styles.lessonCard}>
      <div className={styles.cardHead}>
        <div className={styles.cardTitle}>
          <h2 id={`${id}h`}>When to do lessons</h2>
          {/* Native popover: opens on click or tap, closes on Escape or a tap outside. */}
          <button
            type="button"
            popoverTarget={`${id}i`}
            aria-label="How this is worked out"
            className={styles.infoButton}
          >
            <InfoIcon size={18} />
          </button>
          <div id={`${id}i`} popover="auto" className={styles.infoPopover}>
            Based on your day, {fmtTime(wakeMin)} to {fmtTime(sleepMin)}. Change your waking hours
            and lesson time in{' '}
            <Link to="/settings" hash="preferences">
              Settings
            </Link>
            .
          </div>
        </div>
        <span className={styles.cardAside}>
          Your day {fmtTime(wakeMin)} to {fmtTime(sleepMin)}
        </span>
      </div>
      <div className={styles.windowLead}>
        <span className={styles.windowBig}>{big}</span>
        {rest.length > 0 && <span className={styles.windowSmall}>or {rest.join(' or ')}</span>}
      </div>
      <div aria-hidden="true" className={styles.strip}>
        <div className={styles.stripTrack}>
          {w.strip.map((kind, s) => (
            <span key={s} className={styles[kind]} />
          ))}
        </div>
        <span
          className={`${styles.stripMark} ${styles.stripLesson}`}
          style={{ left: pos(lessonMin) }}
        />
        <span className={styles.stripMark} style={{ left: pos(back1(lessonMin)) }} />
        <span className={styles.stripMark} style={{ left: pos(back2(lessonMin)) }} />
      </div>
      <div aria-hidden="true" className={styles.stripLabels}>
        <span style={labelAt(0)}>{fmtTime(0)}</span>
        <span className={styles.lessonLabel} style={labelAt(lessonMin)}>
          Lessons {fmtTime(lessonMin)}
        </span>
        <span style={labelAt(back1(lessonMin))}>{fmtTime(back1(lessonMin))}</span>
        <span style={labelAt(back2(lessonMin))}>{fmtTime(back2(lessonMin))}</span>
      </div>
      <p className={styles.note}>
        Apprentice 1 comes back {a1} hours after a lesson and Apprentice 2 {a2} hours after that.{' '}
        {w.label ? (
          <>
            Lessons in the window keep both inside your day.
            {w.evening &&
              ` At ${fmtTime(w.evening.from)} they land at ${fmtTime(back1(w.evening.from))} and ${fmtTime(back2(w.evening.from))}.`}
          </>
        ) : (
          w.closest &&
          `No lesson time keeps both inside your day. The closest is ${fmtTime(w.closest.min)}, with reviews ${w.closest.hoursOutside} hours outside it.`
        )}{' '}
        Lessons at {fmtTime(lessonMin)} come back at {fmtTime(back1(lessonMin))} and{' '}
        {fmtTime(back2(lessonMin))}
        {w.lessonTimeFits ? '.' : ', outside the window.'}
      </p>
    </section>
  );
}

const FLIGHT: [keyof StageCounts, string, string][] = [
  ['a1', 'A1', 'a1'],
  ['a2', 'A2', 'a2'],
  ['a3', 'A3', 'a3'],
  ['a4', 'A4', 'a4'],
  ['g1', 'G1', 'guru'],
  ['g2', 'G2', 'guru-2'],
  ['m', 'M', 'master'],
  ['e', 'E', 'enlightened'],
];

function InFlightCard() {
  const assignments = useAssignments();
  const stats = useReviewStatistics();
  const snapshots = useSnapshots();
  const deltas = useSnapshotDeltas();
  const [lessonsPerDay] = usePref('lessonsPerDay');
  const now = useNow();
  const stages = useMemo(() => assignments && workload(assignments).stages, [assignments]);
  const itemAccuracy = useMemo(() => {
    if (!stats || !snapshots || !deltas) return null;
    const a = accuracy(stats, snapshots, deltas, now);
    return ((a.recentAvailable && a.recent30) || a.lifetime).itemEstimate;
  }, [stats, snapshots, deltas, now]);
  if (!stages) return null;
  const steady = itemAccuracy ? steadyStateReviewsPerDay(lessonsPerDay, itemAccuracy) : null;

  return (
    <Card title="In flight">
      <ul className={styles.flight}>
        {FLIGHT.map(([key, short, token], i) => (
          <li key={key}>
            <span className={styles.flightBar} style={{ background: `var(--srs-${token})` }} />
            <span className={styles.flightN}>{stages[key].toLocaleString()}</span>
            <abbr title={stageName(i + 1)}>
              <span aria-hidden="true">{short}</span>
              <span className="visually-hidden">{stageName(i + 1)}</span>
            </abbr>
          </li>
        ))}
      </ul>
      {steady !== null && itemAccuracy && (
        <p className={styles.note}>
          At {lessonsPerDay} lessons a day, reviews settle at about {steady.toLocaleString()} a day
          once burns start: {lessonsPerDay} lessons times 8 reviews each to burn, divided by an
          estimated item accuracy of {Math.round(itemAccuracy * 100)}%.
        </p>
      )}
    </Card>
  );
}
