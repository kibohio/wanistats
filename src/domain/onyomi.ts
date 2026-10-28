import type {
  AssignmentResource,
  KanjiResource,
  KanjiReading,
  ReviewStatisticResource,
  SubjectResource,
  VocabularyResource,
} from '../api/types';
import { hiragana } from './items';

export const LIST_SIZE = 25;
/** Guru 2: Master and up are mostly settled. */
export const DEFAULT_MAX_STAGE = 6;
const MIN_READING_MISSES = 2;

export interface Anchor {
  characters: string;
  reading: string;
  meaning: string;
}

export interface ReadingLeech {
  subjectId: number;
  characters: string;
  level: number;
  meaning: string;
  /** Accepted on'yomi: the answers the drill wants. */
  targetReadings: string[];
  /** Every other reading WaniKani lists, for naming a near miss. */
  otherReadings: KanjiReading[];
  readingAccuracy: number;
  readingIncorrect: number;
  srsStage: number;
  score: number;
  anchor?: Anchor;
}

export interface ReadingReport {
  kanji: number;
  readingIncorrect: number;
  meaningIncorrect: number;
  /** Worst first, at most LIST_SIZE. */
  leeches: ReadingLeech[];
}

const isTarget = (r: KanjiReading) => r.accepted_answer && r.type === 'onyomi';

// Items still in reviews cost the most; a burned one only says the reading was once hard.
function stageWeight(stage: number): number {
  if (stage <= 4) return 1;
  if (stage <= 6) return 0.8;
  if (stage === 7) return 0.4;
  if (stage === 8) return 0.2;
  return 0.1;
}

/** A two-character word that shows one of the target on'yomi, lowest level first. */
export function findAnchor(
  kanji: KanjiResource,
  vocab: Map<number, VocabularyResource>,
): Anchor | undefined {
  const targets = kanji.data.readings.filter(isTarget).map((r) => r.reading);
  const primary = (v: VocabularyResource) =>
    v.data.readings.find((r) => r.primary) ?? v.data.readings[0];
  const shows = (reading: string) => targets.some((t) => reading.includes(t));
  const [best] = kanji.data.amalgamation_subject_ids
    .flatMap((id) => vocab.get(id) ?? [])
    .filter(
      ({ data: v }) =>
        !v.hidden_at &&
        !!v.characters &&
        v.characters.length >= 2 &&
        !/[〜～]/.test(v.characters) &&
        !v.characters.endsWith('する') &&
        v.readings.some((r) => r.accepted_answer && shows(r.reading)),
    )
    .sort(
      (a, b) =>
        a.data.characters!.length - b.data.characters!.length ||
        a.data.level - b.data.level ||
        Number(!shows(primary(a)!.reading)) - Number(!shows(primary(b)!.reading)),
    );
  if (!best) return undefined;
  return {
    characters: best.data.characters!,
    reading: primary(best)!.reading,
    meaning: (best.data.meanings.find((m) => m.primary) ?? best.data.meanings[0])?.meaning ?? '',
  };
}

export function readingLeeches(input: {
  subjects: SubjectResource[];
  assignments: AssignmentResource[];
  stats: ReviewStatisticResource[];
  /** Highest srs_stage to list; the headline totals still count every kanji. */
  maxStage?: number;
}): ReadingReport {
  const { maxStage = 9 } = input;
  const kanjiById = new Map<number, KanjiResource>();
  const vocab = new Map<number, VocabularyResource>();
  for (const s of input.subjects) {
    if (s.object === 'kanji' && !s.data.hidden_at) kanjiById.set(s.id, s);
    else if (s.object === 'vocabulary') vocab.set(s.id, s);
  }
  const stages = new Map(input.assignments.map((a) => [a.data.subject_id, a.data.srs_stage]));

  const report: ReadingReport = { kanji: 0, readingIncorrect: 0, meaningIncorrect: 0, leeches: [] };
  for (const { data: s } of input.stats) {
    const kanji = kanjiById.get(s.subject_id);
    if (s.hidden || !kanji) continue;
    report.kanji++;
    report.readingIncorrect += s.reading_incorrect;
    report.meaningIncorrect += s.meaning_incorrect;

    const attempts = s.reading_correct + s.reading_incorrect;
    const targets = kanji.data.readings.filter(isTarget);
    const srsStage = stages.get(s.subject_id);
    if (!attempts || !targets.length || srsStage === undefined || srsStage > maxStage) continue;
    if (s.reading_incorrect < MIN_READING_MISSES) continue;
    const readingAccuracy = s.reading_correct / attempts;
    report.leeches.push({
      subjectId: kanji.id,
      characters: kanji.data.characters ?? '',
      level: kanji.data.level,
      meaning: kanji.data.meanings.find((m) => m.primary)?.meaning ?? '',
      targetReadings: targets.map((r) => r.reading),
      otherReadings: kanji.data.readings.filter((r) => !isTarget(r)),
      readingAccuracy,
      readingIncorrect: s.reading_incorrect,
      srsStage,
      score: s.reading_incorrect * (1 - readingAccuracy) * stageWeight(srsStage),
    });
  }

  report.leeches.sort((a, b) => b.score - a.score || a.subjectId - b.subjectId);
  report.leeches = report.leeches.slice(0, LIST_SIZE);
  for (const l of report.leeches) l.anchor = findAnchor(kanjiById.get(l.subjectId)!, vocab);
  return report;
}

const VOWEL_ROWS = [
  ['あかさたなはまやらわがざだばぱぁゃゎ', 'あ'],
  ['いきしちにひみりぎじぢびぴぃ', 'い'],
  ['うくすつぬふむゆるぐずづぶぷぅゅ', 'う'],
  // WaniKani writes long e and o sounds as えい and おう: けい, こう.
  ['えけせてねへめれげぜでべぺぇ', 'い'],
  ['おこそとのほもよろをごぞどぼぽぉょ', 'う'],
] as const;

/** Trimmed hiragana with katakana long-vowel marks spelled out, so キュー matches きゅう. */
export function normalizeReading(input: string): string {
  return hiragana(input.trim()).replace(/(.)ー/g, (_, c: string) => {
    const row = VOWEL_ROWS.find(([kana]) => kana.includes(c));
    return c + (row?.[1] ?? '');
  });
}

export type ReadingVerdict =
  | { kind: 'correct' }
  /** Another reading of the same kanji, usually the kun'yomi. */
  | { kind: 'other'; type: KanjiReading['type'] }
  | { kind: 'wrong' }
  /** Empty, or romaji left over. Ask again without counting. */
  | { kind: 'retry' };

export function checkReading(leech: ReadingLeech, input: string): ReadingVerdict {
  const answer = normalizeReading(input);
  if (!answer || /[a-z]/i.test(answer)) return { kind: 'retry' };
  if (leech.targetReadings.some((r) => normalizeReading(r) === answer)) return { kind: 'correct' };
  const other = leech.otherReadings.find((r) => normalizeReading(r.reading) === answer);
  return other ? { kind: 'other', type: other.type } : { kind: 'wrong' };
}
