import type {
  AssignmentResource,
  KanjiReading,
  ReviewStatisticResource,
  SubjectResource,
  SubjectType,
  VocabularyReading,
} from '../api/types';
import type { AccuracyBreakdown, AccuracyFigures } from './accuracy';
import { leechScore, type Leech } from './leeches';

const DAY_MS = 86_400_000;
const IMAGE_HOST = 'https://files.wanikani.com/';

export interface Reading {
  reading: string;
  primary: boolean;
  /** Kanji only. */
  type?: 'onyomi' | 'kunyomi' | 'nanori';
}

export interface Answers {
  meaningCorrect: number;
  meaningTotal: number;
  readingCorrect: number;
  readingTotal: number;
}

export interface Item {
  id: number;
  type: SubjectType;
  /** Null for radicals that exist only as images. */
  characters: string | null;
  /** SVG on files.wanikani.com, set only when `characters` is null. */
  imageUrl: string | null;
  meaning: string;
  /** Accepted meanings, primary first, then whitelisted auxiliary meanings. */
  meanings: string[];
  reading: string | null;
  readings: Reading[];
  level: number;
  /** srs_stage, or null when locked. */
  stage: number | null;
  availableAt: number | null;
  /** Whole days since the lesson; null before it. */
  daysIn: number | null;
  answers: Answers | null;
  /** WaniKani's percentage_correct as a fraction; null with no answers. */
  accuracy: number | null;
  incorrect: number;
  leechScore: number;
  leech: Leech | null;
  /** Visually similar kanji, in the leech report's order when the item is a leech. */
  lookAlikeIds: number[];
  documentUrl: string;
}

const time = (iso: string | null) => (iso ? Date.parse(iso) : null);

function svgUrl(subject: SubjectResource): string | null {
  if (subject.object !== 'radical' || subject.data.characters) return null;
  const svg = subject.data.character_images.find((i) => i.content_type === 'image/svg+xml');
  return svg?.url.startsWith(IMAGE_HOST) ? svg.url : null;
}

/** One row per visible subject, joined with its assignment, statistics and leech entry. */
export function buildItems(input: {
  subjects: SubjectResource[];
  assignments: AssignmentResource[];
  stats: ReviewStatisticResource[];
  leeches: Leech[];
  now: number;
}): Item[] {
  const assignments = new Map(input.assignments.map((a) => [a.data.subject_id, a.data]));
  const stats = new Map(input.stats.map((s) => [s.data.subject_id, s.data]));
  const leeches = new Map(input.leeches.map((l) => [l.subjectId, l]));
  const visible = new Set(
    input.subjects
      .filter((s) => !s.data.hidden_at && !assignments.get(s.id)?.hidden)
      .map((s) => s.id),
  );

  const items: Item[] = [];
  for (const subject of input.subjects) {
    if (!visible.has(subject.id)) continue;
    const { data } = subject;
    const a = assignments.get(subject.id);
    const s = stats.get(subject.id);
    const leech = leeches.get(subject.id) ?? null;
    const readings: Reading[] =
      'readings' in data
        ? data.readings
            .filter((r) => r.accepted_answer)
            .map((r: KanjiReading | VocabularyReading) => ({
              reading: r.reading,
              primary: r.primary,
              ...('type' in r && { type: r.type }),
            }))
        : [];
    const answers = s && {
      meaningCorrect: s.meaning_correct,
      meaningTotal: s.meaning_correct + s.meaning_incorrect,
      readingCorrect: s.reading_correct,
      readingTotal: s.reading_correct + s.reading_incorrect,
    };
    const started = time(a?.started_at ?? null);
    items.push({
      id: subject.id,
      type: subject.object,
      characters: data.characters,
      imageUrl: svgUrl(subject),
      meaning: data.meanings.find((m) => m.primary)?.meaning ?? data.slug,
      meanings: [
        ...data.meanings
          .filter((m) => m.accepted_answer)
          .sort((x, y) => Number(y.primary) - Number(x.primary))
          .map((m) => m.meaning),
        ...data.auxiliary_meanings.filter((m) => m.type === 'whitelist').map((m) => m.meaning),
      ],
      reading: readings.find((r) => r.primary)?.reading ?? null,
      readings,
      level: data.level,
      stage: a?.unlocked_at ? a.srs_stage : null,
      availableAt: time(a?.available_at ?? null),
      daysIn: started === null ? null : Math.floor((input.now - started) / DAY_MS),
      answers: answers ?? null,
      accuracy:
        s && answers && answers.meaningTotal + answers.readingTotal > 0
          ? s.percentage_correct / 100
          : null,
      incorrect: s ? s.meaning_incorrect + s.reading_incorrect : 0,
      leechScore: s ? leechScore(s) : 0,
      leech,
      lookAlikeIds:
        leech?.lookAlikeIds ??
        (subject.object === 'kanji'
          ? subject.data.visually_similar_subject_ids.filter((id) => visible.has(id))
          : []),
      documentUrl: data.document_url,
    });
  }
  return items;
}

export function stageName(stage: number | null): string {
  if (stage === null) return 'Locked';
  if (stage === 0) return 'Lesson';
  if (stage <= 4) return `Apprentice ${stage}`;
  if (stage <= 6) return `Guru ${stage - 4}`;
  return ['Master', 'Enlightened', 'Burned'][stage - 7]!;
}

export function stageGroup(stage: number | null): string {
  return stageName(stage).replace(/ \d$/, '');
}

export const PRESETS = ['leeches', 'apprentice', 'next24h', 'guru', 'burned'] as const;
export type Preset = (typeof PRESETS)[number];

function inPreset(item: Item, preset: Preset, now: number): boolean {
  const s = item.stage ?? -1;
  switch (preset) {
    case 'leeches':
      return item.leech !== null;
    case 'apprentice':
      return s >= 1 && s <= 4;
    case 'next24h':
      return s >= 1 && s <= 8 && item.availableAt !== null && item.availableAt <= now + DAY_MS;
    case 'guru':
      return s === 5 || s === 6;
    case 'burned':
      return s === 9;
  }
}

export function presetCounts(items: Item[], now: number): Record<Preset, number> {
  const counts = Object.fromEntries(PRESETS.map((p) => [p, 0])) as Record<Preset, number>;
  for (const item of items) for (const p of PRESETS) if (inPreset(item, p, now)) counts[p]++;
  return counts;
}

/** Katakana to hiragana, so readings and kana words compare in one script. */
export const hiragana = (s: string) =>
  s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

/**
 * Items in the preset (all items with none) matching the query in their characters, kana,
 * meanings or, through `toKana` (wanakana, loaded lazily), romaji.
 */
export function filterItems(
  items: Item[],
  preset: Preset | null,
  query: string,
  now: number,
  toKana?: (romaji: string) => string,
): Item[] {
  const q = query.trim().toLowerCase();
  const inSet = preset ? items.filter((i) => inPreset(i, preset, now)) : items;
  if (!q) return inSet;
  const converted = toKana && /[a-z]/.test(q) ? toKana(q) : q;
  // A half-typed syllable leaves latin letters behind; only whole kana is worth matching.
  const kana = /[a-z]/.test(converted) ? null : hiragana(converted);
  return inSet.filter(
    (i) =>
      i.characters?.toLowerCase().includes(q) ||
      i.meanings.some((m) => m.toLowerCase().includes(q)) ||
      (kana !== null &&
        (i.readings.some((r) => hiragana(r.reading).includes(kana)) ||
          (i.characters !== null && hiragana(i.characters).includes(kana)))),
  );
}

export interface WeakestPart {
  type: SubjectType;
  part: 'meaning' | 'reading';
  rate: number;
}

/** The lowest meaning or reading rate across subject types, for "Kanji reading, weakest". */
export function weakestPart(b: AccuracyBreakdown): WeakestPart | null {
  let weakest: WeakestPart | null = null;
  for (const [type, f] of Object.entries(b.bySubjectType) as [SubjectType, AccuracyFigures][]) {
    for (const part of ['meaning', 'reading'] as const) {
      const rate = f[part];
      if (rate !== null && (!weakest || rate < weakest.rate)) weakest = { type, part, rate };
    }
  }
  return weakest;
}
