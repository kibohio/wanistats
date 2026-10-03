import { stageName } from '../../domain/items';
import { useMemo, useState } from 'react';
import { Card } from '../../components/Card';
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
import { fmtHour, lessonWindow } from '../../domain/lessonWindow';
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

/** Left offset on the 24-hour strip. */
const pos = (h: number) => `${(((h % 24) + 24) % 24) * (100 / 24)}%`;
const at = (h: number) => fmtHour(h % 24);
/** Centred on its hour, sliding inward within 2.4 hours of either end so it stays on the strip. */
function labelAt(h: number) {
  const f = (((h % 24) + 24) % 24) / 24;
  const shift = f < 0.5 ? Math.min(f * 500, 50) : Math.max(100 - (1 - f) * 500, 50);
  return { left: pos(h), transform: `translateX(-${shift}%)` };
}

function LessonWindowCard() {
  const system = useLessonSystem();
  const [wakeHour] = usePref('wakeHour');
  const [sleepHour] = usePref('sleepHour');
  const [lessonHour] = usePref('lessonHour');
  const w = useMemo(
    () => system && lessonWindow(system, { wakeHour, sleepHour, lessonHour }),
    [system, wakeHour, sleepHour, lessonHour],
  );
  if (!system || !w) return null;
  const a1 = intervalFor(system, 1);
  const a2 = intervalFor(system, 2);
  const [big, ...rest] = (w.label ?? 'No window').split(' or ');

  return (
    <Card
      title="When to do lessons"
      aside={`Your day ${fmtHour(wakeHour)} to ${fmtHour(sleepHour)}`}
    >
      <div className={styles.windowLead}>
        <span className={styles.windowBig}>{big}</span>
        {rest.length > 0 && <span className={styles.windowSmall}>or {rest.join(' or ')}</span>}
      </div>
      <div aria-hidden="true" className={styles.strip}>
        <div className={styles.stripTrack}>
          {w.strip.map((kind, h) => (
            <span key={h} className={styles[kind]} />
          ))}
        </div>
        <span
          className={`${styles.stripMark} ${styles.stripLesson}`}
          style={{ left: pos(lessonHour) }}
        />
        <span className={styles.stripMark} style={{ left: pos(lessonHour + a1) }} />
        <span className={styles.stripMark} style={{ left: pos(lessonHour + a1 + a2) }} />
      </div>
      <div aria-hidden="true" className={styles.stripLabels}>
        <span style={labelAt(0)}>{fmtHour(0)}</span>
        <span className={styles.lessonLabel} style={labelAt(lessonHour)}>
          Lessons {fmtHour(lessonHour)}
        </span>
        <span style={labelAt(lessonHour + a1)}>{at(lessonHour + a1)}</span>
        <span style={labelAt(lessonHour + a1 + a2)}>{at(lessonHour + a1 + a2)}</span>
      </div>
      <p className={styles.note}>
        Apprentice 1 comes back {a1} hours after a lesson and Apprentice 2 {a2} hours after that.{' '}
        {w.label ? (
          <>
            Lessons in the window keep both inside your day.
            {w.evening &&
              ` At ${fmtHour(w.evening.from)} they land at ${at(w.evening.from + a1)} and ${at(w.evening.from + a1 + a2)}.`}
          </>
        ) : (
          w.closest &&
          `No lesson time keeps both inside your day. The closest is ${fmtHour(w.closest.hour)}, with reviews ${w.closest.hoursOutside} hours outside it.`
        )}{' '}
        Lessons at {fmtHour(lessonHour)} come back at {at(lessonHour + a1)} and{' '}
        {at(lessonHour + a1 + a2)}
        {w.lessonTimeFits ? '.' : ', outside the window.'}
      </p>
    </Card>
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
