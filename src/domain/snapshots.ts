import type {
  AssignmentResource,
  ReviewStatisticResource,
  SubjectResource,
  User,
} from '../api/types';
import { daysBetweenKeys, localDateKey, shiftDate } from './localDate';
import { loadFromStages, stageCountsFromAssignments } from './workload';
import type { ReviewCounters, Snapshot, SnapshotDelta } from '../db/schema';

export const RETENTION_DAYS = 400;
export function buildSnapshot(
  assignments: AssignmentResource[],
  reviewStatistics: ReviewStatisticResource[],
  subjects: SubjectResource[],
  user: User,
  now: number,
): Snapshot {
  const hiddenSubjects = new Set(subjects.filter((s) => s.data.hidden_at).map((s) => s.id));
  let lessonsAvailable = 0;
  let passedKanji = 0;
  let passedVocab = 0;
  const visible = assignments.filter(
    (a) => !a.data.hidden && !hiddenSubjects.has(a.data.subject_id),
  );
  const stages = stageCountsFromAssignments(visible);
  for (const { data: a } of visible) {
    if (a.unlocked_at && !a.started_at) lessonsAvailable++;
    if (a.passed_at) {
      if (a.subject_type === 'kanji') passedKanji++;
      else if (a.subject_type !== 'radical') passedVocab++;
    }
  }
  const reviews = zero();
  for (const c of Object.values(countersBySubject(reviewStatistics))) addInto(reviews, c);
  return {
    date: localDateKey(now),
    takenAt: new Date(now).toISOString(),
    stages,
    load: loadFromStages(stages),
    lessonsAvailable,
    reviews,
    passedKanji,
    passedVocab,
    level: user.level,
  };
}

/** Per-subject lifetime counters. Persisted as the baseline the next snapshot diffs against. */
export type Counters = Record<number, ReviewCounters>;

const COUNTER_KEYS: (keyof ReviewCounters)[] = [
  'meaningCorrect',
  'meaningIncorrect',
  'readingCorrect',
  'readingIncorrect',
];
const zero = (): ReviewCounters => ({
  meaningCorrect: 0,
  meaningIncorrect: 0,
  readingCorrect: 0,
  readingIncorrect: 0,
});
function addInto(target: ReviewCounters, c: ReviewCounters) {
  for (const k of COUNTER_KEYS) target[k] += c[k];
}

export function countersBySubject(reviewStatistics: ReviewStatisticResource[]): Counters {
  const out: Counters = {};
  for (const { data: s } of reviewStatistics) {
    if (s.hidden) continue;
    out[s.subject_id] = {
      meaningCorrect: s.meaning_correct,
      meaningIncorrect: s.meaning_incorrect,
      readingCorrect: s.reading_correct,
      readingIncorrect: s.reading_incorrect,
    };
  }
  return out;
}

/** One row per subject whose counters grew since `prev`. Decreases (data corrections) clamp to 0. */
export function computeDeltas(prev: Counters, current: Counters, date: string): SnapshotDelta[] {
  const out: SnapshotDelta[] = [];
  for (const [id, cur] of Object.entries(current)) {
    const before = prev[Number(id)] ?? zero();
    const d = { date, subjectId: Number(id), ...zero() };
    for (const k of COUNTER_KEYS) d[k] = Math.max(0, cur[k] - before[k]);
    if (COUNTER_KEYS.some((k) => d[k] > 0)) out.push(d);
  }
  return out;
}

export interface SnapshotSpan {
  /** The snapshot's date: the last day of the span. */
  date: string;
  /** First day the span covers. Equals `date` unless days were missed. */
  from: string;
  days: number;
}

/** A snapshot's deltas cover (previous snapshot date, date]. Charts draw each span as one bar. */
export function snapshotSpans(snapshots: Pick<Snapshot, 'date'>[]): SnapshotSpan[] {
  const dates = snapshots.map((s) => s.date).sort();
  return dates.map((date, i) => {
    const days = i === 0 ? 1 : daysBetweenKeys(dates[i - 1], date);
    return { date, from: shiftDate(date, 1 - days), days };
  });
}

export interface ReviewsSpan extends SnapshotSpan {
  /** Subjects with a correct-count delta: an approximate review count. */
  reviews: number;
  perDay: number;
}

export function reviewsPerDay(
  snapshots: Pick<Snapshot, 'date'>[],
  deltas: SnapshotDelta[],
): ReviewsSpan[] {
  const byDate = new Map<string, number>();
  for (const d of deltas) {
    if (d.meaningCorrect + d.readingCorrect > 0) byDate.set(d.date, (byDate.get(d.date) ?? 0) + 1);
  }
  return snapshotSpans(snapshots).map((s) => {
    const reviews = byDate.get(s.date) ?? 0;
    return { ...s, reviews, perDay: reviews / s.days };
  });
}

/** Rows dated more than RETENTION_DAYS before `today` merge into monthly rows keyed YYYY-MM. */
export function rollUpDeltas(deltas: SnapshotDelta[], today: string): SnapshotDelta[] {
  const cutoff = shiftDate(today, -RETENTION_DAYS);
  const out: SnapshotDelta[] = [];
  const monthly = new Map<string, SnapshotDelta>();
  for (const d of deltas) {
    if (d.date >= cutoff) {
      out.push(d);
      continue;
    }
    const month = d.date.slice(0, 7);
    const key = `${month}#${d.subjectId}`;
    let row = monthly.get(key);
    if (!row) monthly.set(key, (row = { date: month, subjectId: d.subjectId, ...zero() }));
    addInto(row, d);
  }
  return out.concat([...monthly.values()]);
}

/** The latest snapshot before today, for "First snapshot since Tue. The days in between are merged." */
export function daysSinceLastSnapshot(
  snapshots: Pick<Snapshot, 'date'>[],
  now: number,
): { since: string; days: number } | null {
  const today = localDateKey(now);
  let since: string | null = null;
  for (const { date } of snapshots) if (date < today && (!since || date > since)) since = date;
  return since ? { since, days: daysBetweenKeys(since, today) } : null;
}
