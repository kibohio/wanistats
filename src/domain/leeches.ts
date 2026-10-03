import type {
  AssignmentResource,
  ReviewStatistic,
  ReviewStatisticResource,
  SubjectResource,
  SubjectType,
} from '../api/types';
import type { Snapshot, SnapshotDelta } from '../db/schema';
import { windowStartKey } from './localDate';

export const RECENT_LEECH_DAYS = 14;
const MIN_LESSON_AGE_MS = 7 * 86_400_000;

export interface Leech {
  subjectId: number;
  subjectType: SubjectType;
  score: number;
  incorrect: number;
  /** Misses in the last 14 days; null until 14 snapshots exist. */
  recentMisses: number | null;
  recentlyStruggling: boolean;
  /** Visually similar kanji: leeches first, then unlocked, then the rest. */
  lookAlikeIds: number[];
}

export interface LeechReport {
  recentAvailable: boolean;
  /** Recently struggling first, then by score. */
  leeches: Leech[];
}

const meaningOnly = (t: SubjectType) => t === 'radical' || t === 'kana_vocabulary';

export function leechScore(s: ReviewStatistic): number {
  const streak = meaningOnly(s.subject_type)
    ? s.meaning_current_streak
    : Math.min(s.meaning_current_streak, s.reading_current_streak);
  return (s.meaning_incorrect + s.reading_incorrect) / Math.max(1, streak) ** 1.5;
}

export function leeches(input: {
  subjects: SubjectResource[];
  assignments: AssignmentResource[];
  stats: ReviewStatisticResource[];
  snapshots: Pick<Snapshot, 'date'>[];
  deltas: SnapshotDelta[];
  now: number;
}): LeechReport {
  const { now } = input;
  const subjects = new Map(input.subjects.map((s) => [s.id, s]));
  const assignments = new Map(input.assignments.map((a) => [a.data.subject_id, a.data]));
  const isHidden = (id: number) =>
    !!subjects.get(id)?.data.hidden_at || !!assignments.get(id)?.hidden;

  const found: Leech[] = [];
  for (const { data: s } of input.stats) {
    const a = assignments.get(s.subject_id);
    if (s.hidden || !a || isHidden(s.subject_id) || a.srs_stage >= 9 || !a.started_at) continue;
    if (now - Date.parse(a.started_at) <= MIN_LESSON_AGE_MS) continue;
    const score = leechScore(s);
    if (score < 1) continue;
    found.push({
      subjectId: s.subject_id,
      subjectType: s.subject_type,
      score,
      incorrect: s.meaning_incorrect + s.reading_incorrect,
      recentMisses: null,
      recentlyStruggling: false,
      lookAlikeIds: [],
    });
  }

  const recentAvailable = input.snapshots.length >= RECENT_LEECH_DAYS;
  if (recentAvailable) {
    const start = windowStartKey(now, RECENT_LEECH_DAYS);
    const misses = new Map<number, number>();
    for (const d of input.deltas) {
      if (d.date < start) continue;
      misses.set(
        d.subjectId,
        (misses.get(d.subjectId) ?? 0) + d.meaningIncorrect + d.readingIncorrect,
      );
    }
    for (const l of found) {
      l.recentMisses = misses.get(l.subjectId) ?? 0;
      l.recentlyStruggling = l.recentMisses > 0;
    }
  }

  const leechIds = new Set(found.map((l) => l.subjectId));
  const rank = (id: number) => (leechIds.has(id) ? 0 : assignments.get(id)?.unlocked_at ? 1 : 2);
  for (const l of found) {
    const subject = subjects.get(l.subjectId);
    if (subject?.object !== 'kanji') continue;
    l.lookAlikeIds = subject.data.visually_similar_subject_ids
      .filter((id) => subjects.has(id) && !isHidden(id))
      .sort((a, b) => rank(a) - rank(b));
  }

  found.sort(
    (a, b) =>
      Number(b.recentlyStruggling) - Number(a.recentlyStruggling) ||
      b.score - a.score ||
      a.subjectId - b.subjectId,
  );
  return { recentAvailable, leeches: found };
}
