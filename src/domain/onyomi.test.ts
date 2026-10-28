import { describe, expect, it } from 'vitest';
import type {
  KanjiReading,
  ReviewStatistic,
  ReviewStatisticResource,
  VocabularyReading,
} from '../api/types';
import { assignment, kanji, vocab } from './test/fixtures';
import { checkReading, findAnchor, normalizeReading, readingLeeches } from './onyomi';

const on = (reading: string, accepted = true): KanjiReading => ({
  reading,
  primary: accepted,
  accepted_answer: accepted,
  type: 'onyomi',
});
const kun = (reading: string, accepted = false): KanjiReading => ({
  reading,
  primary: false,
  accepted_answer: accepted,
  type: 'kunyomi',
});

function makeKanji(id: number, chars: string, readings: KanjiReading[], words: number[] = []) {
  const k = kanji(id, 9);
  k.data.characters = chars;
  k.data.meanings = [{ meaning: `m${id}`, primary: true, accepted_answer: true }];
  k.data.readings = readings;
  k.data.amalgamation_subject_ids = words;
  return k;
}

function makeWord(id: number, chars: string, reading: string, level = 9) {
  const v = vocab(id, level);
  v.data.characters = chars;
  v.data.meanings = [{ meaning: `w${id}`, primary: true, accepted_answer: true }];
  v.data.readings = [{ reading, primary: true, accepted_answer: true } as VocabularyReading];
  return v;
}

function stat(subjectId: number, s: Partial<ReviewStatistic>): ReviewStatisticResource {
  return {
    id: subjectId,
    object: 'review_statistic',
    url: '',
    data_updated_at: null,
    data: {
      created_at: '',
      hidden: false,
      meaning_correct: 10,
      meaning_incorrect: 1,
      meaning_current_streak: 1,
      meaning_max_streak: 1,
      reading_correct: 10,
      reading_incorrect: 0,
      reading_current_streak: 1,
      reading_max_streak: 1,
      percentage_correct: 0,
      subject_id: subjectId,
      subject_type: 'kanji',
      ...s,
    },
  };
}

describe('readingLeeches', () => {
  const ho = makeKanji(1, '保', [on('ほ'), kun('たも')], [101, 102, 103, 104]);
  const shi = makeKanji(2, '試', [on('し'), kun('ため')]);
  const tori = makeKanji(3, '取', [on('しゅ', false), kun('と', true)]);
  const noise = makeKanji(4, '一', [on('いち')]);
  const words = [
    makeWord(101, '保つ', 'たもつ', 5),
    makeWord(102, '保存する', 'ほぞんする', 5),
    makeWord(103, '保持', 'ほじ', 12),
    makeWord(104, '保険', 'ほけん', 10),
  ];
  const subjects = [ho, shi, tori, noise, ...words];
  const assignments = [
    assignment(ho, { stage: 5 }),
    assignment(shi, { stage: 2 }),
    assignment(tori, { stage: 2 }),
    assignment(noise, { stage: 2 }),
  ];
  const stats = [
    stat(1, { reading_correct: 6, reading_incorrect: 18 }),
    stat(2, { reading_correct: 10, reading_incorrect: 5 }),
    stat(3, { reading_correct: 0, reading_incorrect: 20 }),
    stat(4, { reading_correct: 50, reading_incorrect: 1 }),
  ];
  const report = readingLeeches({ subjects, assignments, stats });

  it('totals errors across every kanji with history', () => {
    expect(report).toMatchObject({ kanji: 4, readingIncorrect: 44, meaningIncorrect: 4 });
  });

  it('ranks by misses, accuracy and stage, skipping kun-only and noisy kanji', () => {
    // 保: 18 * 0.75 * 0.8 = 10.8. 試: 5 * (1/3) * 1 = 1.67.
    expect(report.leeches.map((l) => l.characters)).toEqual(['保', '試']);
    expect(report.leeches[0]).toMatchObject({
      targetReadings: ['ほ'],
      readingAccuracy: 0.25,
      readingIncorrect: 18,
      srsStage: 5,
    });
    expect(report.leeches[0]!.score).toBeCloseTo(10.8);
  });

  it('lists only kanji up to the chosen stage', () => {
    const r = readingLeeches({ subjects, assignments, stats, maxStage: 4 });
    expect(r.leeches.map((l) => l.characters)).toEqual(['試']);
    expect(r.kanji).toBe(4);
  });

  it('weights burned items down without dropping them', () => {
    const r = readingLeeches({
      subjects,
      assignments: [assignment(ho, { stage: 9 })],
      stats: [stat(1, { reading_correct: 6, reading_incorrect: 18 })],
    });
    expect(r.leeches[0]!.score).toBeCloseTo(1.35);
  });

  it('anchors to the shortest, lowest level word that shows the on’yomi', () => {
    expect(report.leeches[0]!.anchor).toEqual({
      characters: '保険',
      reading: 'ほけん',
      meaning: 'w104',
      level: 10,
    });
    expect(report.leeches[1]!.anchor).toBeUndefined();
  });
});

describe('findAnchor', () => {
  it('drops 〜 entries and words where the kanji takes another reading', () => {
    const k = makeKanji(1, '上', [on('じょう')], [101, 102, 103]);
    const v = new Map(
      [
        makeWord(101, '〜以上', 'いじょう', 1),
        makeWord(102, '上手', 'うわて', 1),
        makeWord(103, '以上', 'いじょう', 3),
      ].map((w) => [w.id, w]),
    );
    expect(findAnchor(k, v)?.characters).toBe('以上');
  });

  it('prefers the word the user knows best, even if longer or later', () => {
    const k = makeKanji(1, '保', [on('ほ')], [101, 102]);
    const v = new Map(
      [makeWord(101, '保険', 'ほけん', 3), makeWord(102, '保護者', 'ほごしゃ', 20)].map((w) => [
        w.id,
        w,
      ]),
    );
    expect(findAnchor(k, v)?.characters).toBe('保険');
    expect(
      findAnchor(
        k,
        v,
        new Map([
          [102, 7],
          [101, 2],
        ]),
      )?.characters,
    ).toBe('保護者');
  });
});

describe('checkReading', () => {
  const [ho] = readingLeeches({
    subjects: [makeKanji(1, '保', [on('ほ'), kun('たも')])],
    assignments: [assignment(makeKanji(1, '保', []), { stage: 5 })],
    stats: [stat(1, { reading_correct: 0, reading_incorrect: 5 })],
  }).leeches;

  it('accepts the on’yomi in hiragana or katakana', () => {
    expect(checkReading(ho!, ' ほ ')).toEqual({ kind: 'correct' });
    expect(checkReading(ho!, 'ホ')).toEqual({ kind: 'correct' });
  });

  it('names the kun’yomi as a near miss', () => {
    expect(checkReading(ho!, 'たも')).toEqual({ kind: 'other', type: 'kunyomi' });
  });

  it('grades anything else wrong and asks again for leftover romaji', () => {
    expect(checkReading(ho!, 'ぼ')).toEqual({ kind: 'wrong' });
    expect(checkReading(ho!, 'hお')).toEqual({ kind: 'retry' });
    expect(checkReading(ho!, '')).toEqual({ kind: 'retry' });
  });
});

describe('normalizeReading', () => {
  it('spells out katakana long vowels the way WaniKani writes on’yomi', () => {
    expect(normalizeReading('キュー')).toBe('きゅう');
    expect(normalizeReading('ケー')).toBe('けい');
    expect(normalizeReading('ソー')).toBe('そう');
  });
});
