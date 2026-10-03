import type { AssignmentResource, SubjectResource } from '../api/types';
import {
  decodeRanks,
  groupDefs,
  GURU,
  progressBySubject,
  type KanjiPack,
  type KnownStage,
  type PackEntry,
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
