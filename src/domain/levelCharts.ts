import type { AssignmentResource, SubjectResource } from '../api/types';
import {
  decodeRanks,
  groupDefs,
  GURU,
  progressBySubject,
  type KanjiPack,
  type KnownStage,
  type PackEntry,
  zipfWeight,
} from './coverage';

export type LevelChartView = 'jlpt' | 'joyo' | 'frequency';

export interface LevelBar {
  level: number;
  /** Kanji per category, parallel to `categories`. */
  counts: number[];
  /** Known kanji per category, at the known stage. */
  knownCounts: number[];
  total: number;
  known: number;
}

export interface LevelChart {
  /** The view's groups, then one for kanji in none of them. */
  categories: { key: string; label: string }[];
  /** Levels 1 to the highest level with a kanji; empty levels have zero counts. */
  levels: LevelBar[];
}

const NONE: Record<LevelChartView, string> = {
  jlpt: 'No JLPT level',
  joyo: 'Not Jōyō',
  frequency: 'Not ranked',
};

/** The kanji each WaniKani level teaches, broken down by JLPT level, Jōyō grade or rank band. */
export function levelChart(
  view: LevelChartView,
  subjects: SubjectResource[],
  assignments: AssignmentResource[],
  pack: KanjiPack,
  minStage: KnownStage = GURU,
): LevelChart {
  const defs = groupDefs(view);
  const progress = progressBySubject(assignments, minStage);
  const ranks = decodeRanks(pack.rank);
  const entryOf = new Map<string, PackEntry>(
    pack.chars.map((c, i) => [c, { grade: pack.grade[i]!, jlpt: pack.jlpt[i]!, rank: ranks[i]! }]),
  );
  const kanji = subjects.filter(
    (s) => s.object === 'kanji' && !s.data.hidden_at && s.data.characters,
  );
  const top = Math.max(0, ...kanji.map((s) => s.data.level));
  const levels = Array.from({ length: top }, (_, i) => ({
    level: i + 1,
    counts: Array<number>(defs.length + 1).fill(0),
    knownCounts: Array<number>(defs.length + 1).fill(0),
    total: 0,
    known: 0,
  }));
  for (const s of kanji) {
    const bar = levels[s.data.level - 1]!;
    const entry = entryOf.get(s.data.characters!);
    const at = entry ? defs.findIndex((d) => d.has(entry)) : -1;
    const cat = at < 0 ? defs.length : at;
    bar.counts[cat]! += 1;
    bar.total += 1;
    if (progress.get(s.id)?.known) {
      bar.knownCounts[cat]! += 1;
      bar.known += 1;
    }
  }
  return {
    categories: [
      ...defs.map(({ key, label }) => ({ key, label })),
      { key: 'none', label: NONE[view] },
    ],
    levels,
  };
}

export interface CoverageCurve {
  series: {
    key: string;
    label: string;
    /** Kanji in the group. */
    size: number;
    /** Kanji in the group known now, at the known stage. */
    known: number;
    knownPct: number;
  }[];
  /** Levels 1 to the highest level with a kanji. `covered` counts kanji, parallel to `series`. */
  rows: { level: number; covered: number[]; pct: number[] }[];
}

type Group = { key: string; label: string; has: (e: PackEntry) => boolean };

function coverageCurve(
  groups: Group[],
  weigh: (e: PackEntry) => number,
  subjects: SubjectResource[],
  pack: KanjiPack,
  assignments: AssignmentResource[],
  minStage: KnownStage,
): CoverageCurve {
  const progress = progressBySubject(assignments, minStage);
  const kanji = subjects.filter(
    (s) => s.object === 'kanji' && !s.data.hidden_at && s.data.characters,
  );
  const levelOf = new Map(kanji.map((s) => [s.data.characters!, s.data.level]));
  const known = new Set(
    kanji.filter((s) => progress.get(s.id)?.known).map((s) => s.data.characters),
  );
  const top = Math.max(0, ...kanji.map((s) => s.data.level));
  const zero = () => groups.map(() => 0);
  const size = zero();
  const total = zero();
  const knownN = zero();
  const knownW = zero();
  const addedN = Array.from({ length: top }, zero);
  const addedW = Array.from({ length: top }, zero);
  const ranks = decodeRanks(pack.rank);
  pack.chars.forEach((c, i) => {
    const e = { grade: pack.grade[i]!, jlpt: pack.jlpt[i]!, rank: ranks[i]! };
    const w = weigh(e);
    const level = levelOf.get(c);
    groups.forEach((g, gi) => {
      if (!g.has(e)) return;
      size[gi]! += 1;
      total[gi]! += w;
      if (known.has(c)) {
        knownN[gi]! += 1;
        knownW[gi]! += w;
      }
      if (level) {
        addedN[level - 1]![gi]! += 1;
        addedW[level - 1]![gi]! += w;
      }
    });
  });
  const share = (w: number, gi: number) => (total[gi] ? (100 * w) / total[gi]! : 0);
  const n = zero();
  const w = zero();
  return {
    series: groups.map((g, gi) => ({
      key: g.key,
      label: g.label,
      size: size[gi]!,
      known: knownN[gi]!,
      knownPct: share(knownW[gi]!, gi),
    })),
    rows: addedN.map((added, li) => {
      added.forEach((a, gi) => {
        n[gi]! += a;
        w[gi]! += addedW[li]![gi]!;
      });
      return { level: li + 1, covered: [...n], pct: w.map(share) };
    }),
  };
}

/** Share of each JLPT level, Jōyō grade or rank band taught by WaniKani levels 1 to N. */
export function cumulativeCoverage(
  view: LevelChartView,
  subjects: SubjectResource[],
  pack: KanjiPack,
  assignments: AssignmentResource[] = [],
  minStage: KnownStage = GURU,
): CoverageCurve {
  return coverageCurve(groupDefs(view), () => 1, subjects, pack, assignments, minStage);
}

/**
 * Share of kanji appearances in Jiten's corpus covered by WaniKani levels 1 to N, weighted by
 * Zipf rank. Only one kanji list exists, so one series.
 */
export function readingCoverage(
  subjects: SubjectResource[],
  pack: KanjiPack,
  assignments: AssignmentResource[] = [],
  minStage: KnownStage = GURU,
): CoverageCurve & { estimated: true } {
  const all = { key: 'all', label: 'Jiten, all media', has: (e: PackEntry) => e.rank > 0 };
  const curve = coverageCurve(
    [all],
    (e) => zipfWeight(e.rank),
    subjects,
    pack,
    assignments,
    minStage,
  );
  return { ...curve, estimated: true };
}
