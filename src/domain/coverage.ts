import type { AssignmentResource, SubjectResource } from '../api/types';
import type { Snapshot } from '../db/schema';
import { daysBetweenKeys, localDateKey, shiftDate } from './localDate';
import { matchWords } from './wordMatch';

/** `kanji` pack, column-oriented. Parallel arrays; 0 means none. */
export interface KanjiPack {
  /** One kanji per entry (some are outside the BMP). Rank order, unranked ones last. */
  chars: string[];
  /** Jiten kanji rank, delta-encoded. Decoded 0 = not in Jiten's list. */
  rank: number[];
  /** KANJIDIC2 grade: 1-6 Kyōiku, 8 rest of Jōyō, 9-10 Jinmeiyō, 0 none. */
  grade: number[];
  strokes: number[];
  /** JLPT level 5 (N5) to 1 (N1), 0 none. */
  jlpt: number[];
}

/** `words-*` packs, in rank order. */
export interface WordsPack {
  words: string[];
  /** Main kana reading; '' marks a kana-only row (the word is written in kana). */
  readings: string[];
  /** Jiten word rank, delta-encoded. */
  rank: number[];
}

export function decodeRanks(deltas: number[]): number[] {
  let r = 0;
  return deltas.map((d) => (r += d));
}

/**
 * Jiten publishes ranks, not counts, so usage share is modelled with Zipf's law: weight
 * 1/rank^s with s = 1, the classic fit for word frequencies. Every weighted figure is an
 * estimate.
 */
export const ZIPF_S = 1;
export const zipfWeight = (rank: number, s = ZIPF_S) => (rank > 0 ? rank ** -s : 0);

export interface Estimate {
  pct: number;
  estimated: true;
}

const pct = (part: number, whole: number) => (whole ? (100 * part) / whole : 0);

/** SRS stage that counts as known: 5 Guru (default), 7 Master, 8 Enlightened, 9 Burned. */
export type KnownStage = 5 | 7 | 8 | 9;
export const GURU: KnownStage = 5;

interface Progress {
  stage: number;
  known: boolean;
}
// Guru means passed at least once, as WaniKani counts it; higher thresholds use the current stage.
export function progressBySubject(
  assignments: AssignmentResource[],
  minStage: KnownStage,
): Map<number, Progress> {
  return new Map(
    assignments.map((a) => [
      a.data.subject_id,
      {
        stage: a.data.srs_stage,
        known: minStage === GURU ? a.data.passed_at !== null : a.data.srs_stage >= minStage,
      },
    ]),
  );
}

// Kanji

export interface KanjiCell {
  char: string;
  subjectId: number | null;
  level: number | null;
  /** Assignment SRS stage; 0 when not started or not in WaniKani. */
  stage: number;
  /** At the known stage (for Guru: passed at least once). */
  known: boolean;
  inWaniKani: boolean;
  /** Jiten rank; 0 when unranked or no pack. */
  rank: number;
}

export interface KanjiGroup {
  key: string;
  label: string;
  /** WaniKani kanji first, by rank (lesson order in the WK level view), then the rest. */
  cells: KanjiCell[];
  known: number;
  total: number;
  pct: number;
}

export type KanjiView = 'jlpt' | 'joyo' | 'frequency' | 'level';

export interface PackEntry {
  grade: number;
  jlpt: number;
  rank: number;
}

const fmt = (n: number) => n.toLocaleString('en-US');
const BAND = 500;
const BANDS = 5;

export function groupDefs(
  view: Exclude<KanjiView, 'level'>,
): { key: string; label: string; has: (e: PackEntry) => boolean }[] {
  if (view === 'jlpt') {
    return [5, 4, 3, 2, 1].map((n) => ({ key: `n${n}`, label: `N${n}`, has: (e) => e.jlpt === n }));
  }
  if (view === 'joyo') {
    return [1, 2, 3, 4, 5, 6, 8].map((g) => ({
      key: `g${g}`,
      label: g === 8 ? 'Secondary school' : `Grade ${g}`,
      has: (e) => e.grade === g,
    }));
  }
  const bands = Array.from({ length: BANDS }, (_, b) => ({
    key: `r${b + 1}`,
    label: `${fmt(b * BAND + 1)} to ${fmt((b + 1) * BAND)}`,
    has: (e: PackEntry) => e.rank > b * BAND && e.rank <= (b + 1) * BAND,
  }));
  const rest = BANDS * BAND;
  return [...bands, { key: 'rest', label: `${fmt(rest + 1)} and up`, has: (e) => e.rank > rest }];
}

function finish(key: string, label: string, cells: KanjiCell[]): KanjiGroup {
  const known = cells.filter((c) => c.known).length;
  return { key, label, cells, known, total: cells.length, pct: pct(known, cells.length) };
}

/** Kanji grid groups. Every view but 'level' needs the kanji pack; without it they return []. */
export function kanjiGroups(
  view: KanjiView,
  subjects: SubjectResource[],
  assignments: AssignmentResource[],
  pack?: KanjiPack,
  minStage = GURU,
): KanjiGroup[] {
  const progress = progressBySubject(assignments, minStage);
  const ranks = pack ? decodeRanks(pack.rank) : [];
  const rankOf = new Map(pack?.chars.map((c, i) => [c, ranks[i]]));
  const kanji = subjects.filter(
    (s) => s.object === 'kanji' && !s.data.hidden_at && s.data.characters,
  );
  const cellFor = (char: string, s: SubjectResource | undefined): KanjiCell => {
    const p = s && progress.get(s.id);
    return {
      char,
      subjectId: s?.id ?? null,
      level: s?.data.level ?? null,
      stage: p?.stage ?? 0,
      known: p?.known ?? false,
      inWaniKani: !!s,
      rank: rankOf.get(char) ?? 0,
    };
  };

  if (view === 'level') {
    const byLevel = new Map<number, SubjectResource[]>();
    for (const s of kanji) byLevel.set(s.data.level, [...(byLevel.get(s.data.level) ?? []), s]);
    return [...byLevel.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([level, list]) =>
        finish(
          `l${level}`,
          `Level ${level}`,
          list
            .sort((a, b) => a.data.lesson_position - b.data.lesson_position)
            .map((s) => cellFor(s.data.characters!, s)),
        ),
      );
  }

  if (!pack) return [];
  const subjectByChar = new Map(kanji.map((s) => [s.data.characters!, s]));
  const entries = pack.chars.map((char, i) => ({
    cell: cellFor(char, subjectByChar.get(char)),
    entry: { grade: pack.grade[i], jlpt: pack.jlpt[i], rank: ranks[i] },
  }));
  // Unranked (0) sorts after every ranked kanji.
  const order = (a: KanjiCell, b: KanjiCell) =>
    Number(b.inWaniKani) - Number(a.inWaniKani) || (a.rank || Infinity) - (b.rank || Infinity);
  return groupDefs(view).map((g) =>
    finish(
      g.key,
      g.label,
      entries
        .filter((e) => g.has(e.entry))
        .map((e) => e.cell)
        .sort(order),
    ),
  );
}

/** "You know the kanji behind 72% of kanji appearances in Jiten's corpus." */
export function weightedKanjiCoverage(
  subjects: SubjectResource[],
  assignments: AssignmentResource[],
  pack: KanjiPack,
  minStage = GURU,
): Estimate {
  const progress = progressBySubject(assignments, minStage);
  const known = new Set(
    subjects
      .filter((s) => s.object === 'kanji' && !s.data.hidden_at && progress.get(s.id)?.known)
      .map((s) => s.data.characters),
  );
  let all = 0;
  let mine = 0;
  decodeRanks(pack.rank).forEach((r, i) => {
    const w = zipfWeight(r);
    all += w;
    if (known.has(pack.chars[i])) mine += w;
  });
  return { pct: pct(mine, all), estimated: true };
}

// Words

export interface WordRow {
  word: string;
  /** '' for kana-only words. */
  reading: string;
  rank: number;
  subjectId: number | null;
  level: number | null;
}

export interface WordCoverage {
  /** Share of the N most frequent words the user knows in WaniKani. */
  top: { size: number; known: number; pct: number }[];
  weighted: Estimate;
  /** Frequent words in WaniKani the user does not know yet, in rank order. */
  comingUp: WordRow[];
  /** Frequent words WaniKani does not teach, in rank order. */
  notInWaniKani: WordRow[];
}

export function wordCoverage(
  subjects: SubjectResource[],
  assignments: AssignmentResource[],
  pack: WordsPack,
  sizes = [1000, 5000, 10000],
  minStage = GURU,
): WordCoverage {
  const progress = progressBySubject(assignments, minStage);
  const levelOf = new Map(subjects.map((s) => [s.id, s.data.level]));
  const matches = matchWords(subjects, pack);
  const ranks = decodeRanks(pack.rank);
  const known = pack.words.map((_, i) => {
    const id = matches.get(i);
    return id !== undefined && !!progress.get(id)?.known;
  });

  let all = 0;
  let mine = 0;
  const comingUp: WordRow[] = [];
  const notInWaniKani: WordRow[] = [];
  pack.words.forEach((word, i) => {
    const w = zipfWeight(ranks[i]);
    all += w;
    if (known[i]) {
      mine += w;
      return;
    }
    const subjectId = matches.get(i) ?? null;
    const row = {
      word,
      reading: pack.readings[i],
      rank: ranks[i],
      subjectId,
      level: subjectId === null ? null : (levelOf.get(subjectId) ?? null),
    };
    (subjectId === null ? notInWaniKani : comingUp).push(row);
  });

  return {
    top: sizes.map((size) => {
      const k = known.slice(0, size).filter(Boolean).length;
      return { size, known: k, pct: pct(k, Math.min(size, known.length)) };
    }),
    weighted: { pct: pct(mine, all), estimated: true },
    comingUp,
    notInWaniKani,
  };
}

// Growth

/**
 * "+42 kanji known in the last 30 days": latest snapshot against the latest one at least
 * `days` before today, or the earliest one when history is shorter. Null with under two snapshots.
 */
export function coverageGrowth(
  snapshots: Pick<Snapshot, 'date' | 'passedKanji' | 'passedVocab'>[],
  now: number,
  days = 30,
): { kanji: number; vocab: number; days: number } | null {
  if (snapshots.length < 2) return null;
  const sorted = snapshots.toSorted((a, b) => (a.date < b.date ? -1 : 1));
  const last = sorted[sorted.length - 1];
  const cutoff = shiftDate(localDateKey(now), -days);
  const base = sorted.findLast((s) => s.date <= cutoff) ?? sorted[0];
  return {
    kanji: last.passedKanji - base.passedKanji,
    vocab: last.passedVocab - base.passedVocab,
    days: daysBetweenKeys(base.date, last.date),
  };
}
