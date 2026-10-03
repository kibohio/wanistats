import type { ReviewStatisticResource, SubjectType } from '../api/types';
import type { ReviewCounters, Snapshot, SnapshotDelta } from '../db/schema';
import { windowStartKey } from './localDate';

export interface AccuracyFigures {
  /** Correct answers over all answers, meaning and reading. Null with no answers. */
  question: number | null;
  meaning: number | null;
  reading: number | null;
  /** Share of reviews with every part right. Estimated: label it so. */
  itemEstimate: number | null;
  answers: number;
}

export interface AccuracyBreakdown extends AccuracyFigures {
  bySubjectType: Record<SubjectType, AccuracyFigures>;
}

export interface AccuracyReport {
  lifetime: AccuracyBreakdown;
  /** False until RECENT_MIN_SNAPSHOTS exist: show lifetime instead. */
  recentAvailable: boolean;
  recent7: AccuracyBreakdown | null;
  recent30: AccuracyBreakdown | null;
}

export const RECENT_MIN_SNAPSHOTS = 7;
const TYPES: SubjectType[] = ['radical', 'kanji', 'vocabulary', 'kana_vocabulary'];

interface Row {
  type: SubjectType;
  c: ReviewCounters;
}

const ratio = (a: number, b: number) => (b > 0 ? a / b : null);

function figures(rows: Row[]): AccuracyFigures {
  let mc = 0,
    mi = 0,
    rc = 0,
    ri = 0,
    itemSum = 0,
    weight = 0;
  for (const { c } of rows) {
    mc += c.meaningCorrect;
    mi += c.meaningIncorrect;
    rc += c.readingCorrect;
    ri += c.readingIncorrect;
    // Every review asks the meaning, so meaning answers stand in for reviews. Radicals and
    // kana vocabulary have no reading answers, so their reading rate is 1.
    const w = c.meaningCorrect + c.meaningIncorrect;
    if (w === 0) continue;
    const readingRate = ratio(c.readingCorrect, c.readingCorrect + c.readingIncorrect) ?? 1;
    itemSum += (c.meaningCorrect / w) * readingRate * w;
    weight += w;
  }
  return {
    question: ratio(mc + rc, mc + mi + rc + ri),
    meaning: ratio(mc, mc + mi),
    reading: ratio(rc, rc + ri),
    itemEstimate: ratio(itemSum, weight),
    answers: mc + mi + rc + ri,
  };
}

function breakdown(rows: Row[]): AccuracyBreakdown {
  const bySubjectType = Object.fromEntries(
    TYPES.map((t) => [t, figures(rows.filter((r) => r.type === t))]),
  ) as Record<SubjectType, AccuracyFigures>;
  return { ...figures(rows), bySubjectType };
}

/**
 * Lifetime accuracy from review_statistics and recent accuracy from snapshot deltas. A delta
 * row covering a gap of missed days counts once, in the window that holds its date.
 */
export function accuracy(
  stats: ReviewStatisticResource[],
  snapshots: Pick<Snapshot, 'date'>[],
  deltas: SnapshotDelta[],
  now: number,
): AccuracyReport {
  const typeOf = new Map<number, SubjectType>();
  const lifetime: Row[] = [];
  for (const { data: s } of stats) {
    if (s.hidden) continue;
    typeOf.set(s.subject_id, s.subject_type);
    lifetime.push({
      type: s.subject_type,
      c: {
        meaningCorrect: s.meaning_correct,
        meaningIncorrect: s.meaning_incorrect,
        readingCorrect: s.reading_correct,
        readingIncorrect: s.reading_incorrect,
      },
    });
  }

  const recentAvailable = snapshots.length >= RECENT_MIN_SNAPSHOTS;
  const recent = (days: number) => {
    if (!recentAvailable) return null;
    const start = windowStartKey(now, days);
    const rows: Row[] = [];
    for (const d of deltas) {
      const type = typeOf.get(d.subjectId);
      // Monthly roll-ups ('YYYY-MM') sort before any day of their month, so they drop out.
      if (type && d.date >= start) rows.push({ type, c: d });
    }
    return breakdown(rows);
  };

  return {
    lifetime: breakdown(lifetime),
    recentAvailable,
    recent7: recent(7),
    recent30: recent(30),
  };
}
