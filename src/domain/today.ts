import type {
  AssignmentResource,
  SpacedRepetitionSystemResource,
  SubjectResource,
} from '../api/types';
import type { Snapshot } from '../db/schema';
import { kanjiGroups, weightedKanjiCoverage, type KanjiGroup, type KanjiPack } from './coverage';
import type { LevelUpKanji, LevelUpProjection } from './levelUp';
import { daysBetweenKeys, windowStartKey } from './localDate';
import type { LevelOverride } from './pace';
import { daysSinceLastSnapshot } from './snapshots';
import { floorHour } from './srs';
import { TREND_DAYS, type Band, type LoadPoint } from './workload';

const byEarliest = (a: LevelUpKanji, b: LevelUpKanji) =>
  a.earliestGuruAt - b.earliestGuruAt || a.subjectId - b.subjectId;

/** Passed kanji first, then the rest in the order they can reach Guru. */
export function orderedKanji(p: LevelUpProjection): LevelUpKanji[] {
  return [...p.kanji.filter((k) => k.passed), ...p.kanji.filter((k) => !k.passed).sort(byEarliest)];
}

export interface LevelUpGroup {
  kind: 'review' | 'lesson' | 'locked';
  /** Next review; overdue reviews sit at the current hour. Null for lessons and locked kanji. */
  at: number | null;
  stage: number | null;
  subjectIds: number[];
  critical: number;
  /** Right answers in a row still needed to reach Guru. */
  reviewsToGuru: number;
  /** Holds the k-th kanji: the level-up date rests on this group. */
  decisive: boolean;
}

/** Unpassed current-level kanji grouped by next review time and stage. */
export function levelUpGroups(
  p: LevelUpProjection,
  subjects: SubjectResource[],
  systems: SpacedRepetitionSystemResource[],
  now: number,
): LevelUpGroup[] {
  const systemOf = new Map(subjects.map((s) => [s.id, s.data.spaced_repetition_system_id]));
  const passing = new Map(systems.map((s) => [s.id, s.data.passing_stage_position]));
  const unpassed = p.kanji.filter((k) => !k.passed).sort(byEarliest);
  const decisiveId = p.k > 0 ? unpassed[p.k - 1]?.subjectId : undefined;
  const groups = new Map<string, LevelUpGroup>();
  for (const k of unpassed) {
    const kind = k.locked ? 'locked' : k.stage ? 'review' : 'lesson';
    const at = kind === 'review' ? Math.max(k.nextReviewAt ?? now, floorHour(now)) : null;
    const key = `${kind}:${at}:${k.stage}`;
    let g = groups.get(key);
    if (!g) {
      const pass = passing.get(systemOf.get(k.subjectId) ?? -1) ?? 5;
      const from = kind === 'review' ? k.stage! : 1;
      g = {
        kind,
        at,
        stage: k.stage,
        subjectIds: [],
        critical: 0,
        reviewsToGuru: pass - from,
        decisive: false,
      };
      groups.set(key, g);
    }
    g.subjectIds.push(k.subjectId);
    if (k.critical) g.critical++;
    if (k.subjectId === decisiveId) g.decisive = true;
  }
  const rank = { review: 0, lesson: 1, locked: 2 };
  return [...groups.values()].sort(
    (a, b) => rank[a.kind] - rank[b.kind] || (a.at ?? 0) - (b.at ?? 0) || b.stage! - a.stage!,
  );
}

/** Current-level radicals at Guru, for "Radicals done." */
export function radicalProgress(
  subjects: SubjectResource[],
  assignments: AssignmentResource[],
  level: number,
): { passed: number; total: number } {
  const passed = new Set(assignments.filter((a) => a.data.passed_at).map((a) => a.data.subject_id));
  const radicals = subjects.filter(
    (s) => s.object === 'radical' && s.data.level === level && !s.data.hidden_at,
  );
  return { passed: radicals.filter((s) => passed.has(s.id)).length, total: radicals.length };
}

/** Right end of the workload gauge: the band in the middle, room for heavy loads. */
export function gaugeMax(load: number, band: Band): number {
  return Math.max(band.min + band.max, Math.ceil(load / 50) * 50);
}

export function peakBin(bins: { total: number }[]): { index: number; total: number } | null {
  let best: { index: number; total: number } | null = null;
  bins.forEach((b, index) => {
    if (b.total > (best?.total ?? 0)) best = { index, total: b.total };
  });
  return best;
}

/** Reviews waiting on WaniKani right now. */
export function reviewsAvailableNow(assignments: AssignmentResource[], now: number): number {
  return assignments.filter(
    ({ data: a }) =>
      !a.hidden &&
      a.started_at &&
      a.srs_stage >= 1 &&
      a.srs_stage <= 8 &&
      a.available_at &&
      Date.parse(a.available_at) <= now,
  ).length;
}

/** Saved prefs (true include, false exclude) in the shape paceStats takes. */
export function overridesFromPrefs(
  saved: Record<number, boolean>,
): Partial<Record<number, LevelOverride>> {
  return Object.fromEntries(
    Object.entries(saved).map(([level, on]) => [level, on ? 'include' : 'exclude']),
  );
}

export const GAP_NOTICE_DAYS = 3;

/** Date of the last snapshot before today when it is more than 3 days old, else null. */
export function gapNotice(snapshots: Pick<Snapshot, 'date'>[], now: number): string | null {
  const gap = daysSinceLastSnapshot(snapshots, now);
  return gap && gap.days > GAP_NOTICE_DAYS ? gap.since : null;
}

/** SVG polyline points for the load trend, x by date across the 30-day window. */
export function trendPoints(
  points: LoadPoint[],
  now: number,
  box: { width: number; height: number },
): { points: string; min: number; max: number } {
  const start = windowStartKey(now, TREND_DAYS);
  const loads = points.map((p) => p.load);
  const min = Math.min(...loads);
  const max = Math.max(...loads);
  const xy = points.map((p) => {
    const x = (daysBetweenKeys(start, p.to) / (TREND_DAYS - 1)) * box.width;
    const y = max === min ? box.height / 2 : ((max - p.load) / (max - min)) * box.height;
    return `${+x.toFixed(1)},${+y.toFixed(1)}`;
  });
  return { points: xy.join(' '), min, max };
}

export interface CoverageSummary {
  jlpt: KanjiGroup[];
  joyo: { known: number; total: number; pct: number };
  weighted: { pct: number; estimated: true };
}

/** The desktop coverage card: kanji known by JLPT level, Joyo share and weighted coverage. */
export function coverageSummary(
  subjects: SubjectResource[],
  assignments: AssignmentResource[],
  pack: KanjiPack,
): CoverageSummary {
  let known = 0;
  let total = 0;
  for (const g of kanjiGroups('joyo', subjects, assignments, pack)) {
    known += g.known;
    total += g.total;
  }
  return {
    jlpt: kanjiGroups('jlpt', subjects, assignments, pack),
    joyo: { known, total, pct: total ? (100 * known) / total : 0 },
    weighted: weightedKanjiCoverage(subjects, assignments, pack),
  };
}
