import { describe, expect, test } from 'vitest';
import type { AssignmentResource, SubjectResource } from '../api/types';
import type { Snapshot } from '../db/schema';
import {
  coverageGrowth,
  decodeRanks,
  kanjiGroups,
  weightedKanjiCoverage,
  wordCoverage,
  zipfWeight,
  type KanjiPack,
  type WordsPack,
} from './coverage';

function subj(
  id: number,
  object: SubjectResource['object'],
  characters: string,
  level: number,
  extra: Record<string, unknown> = {},
): SubjectResource {
  return {
    id,
    object,
    data: { characters, level, lesson_position: 0, hidden_at: null, readings: [], ...extra },
  } as unknown as SubjectResource;
}
function asg(subjectId: number, stage: number, passed: boolean): AssignmentResource {
  return {
    id: subjectId + 100,
    object: 'assignment',
    data: {
      subject_id: subjectId,
      srs_stage: stage,
      passed_at: passed ? '2026-01-01T00:00:00Z' : null,
      hidden: false,
    },
  } as AssignmentResource;
}

test('decodeRanks undoes delta encoding, including the rank-0 tail', () => {
  expect(decodeRanks([1, 1, 598, -600])).toEqual([1, 2, 600, 0]);
});

test('zipfWeight is 1/rank^s and 0 for unranked', () => {
  expect(zipfWeight(4)).toBe(0.25);
  expect(zipfWeight(4, 2)).toBe(1 / 16);
  expect(zipfWeight(0)).toBe(0);
});

describe('kanji', () => {
  // Ranks 1, 2, 3, 600, 2500, 0. 鬱 is not in WaniKani (its subject is hidden), nor is 龍.
  const pack: KanjiPack = {
    chars: ['人', '鬱', '日', '一', '曜', '龍'],
    rank: [1, 1, 1, 597, 1900, -2500],
    grade: [1, 8, 1, 1, 2, 9],
    strokes: [2, 29, 4, 1, 18, 16],
    jlpt: [5, 5, 5, 5, 4, 0],
  };
  const subjects = [
    subj(10, 'kanji', '一', 1, { lesson_position: 0 }),
    subj(11, 'kanji', '人', 1, { lesson_position: 1 }),
    subj(12, 'kanji', '日', 2),
    subj(13, 'kanji', '曜', 3),
    subj(14, 'kanji', '鬱', 40, { hidden_at: '2026-01-01T00:00:00Z' }),
    subj(15, 'radical', '一', 1),
  ];
  const assignments = [asg(10, 9, true), asg(11, 4, false), asg(12, 5, true)];
  const summary = (groups: ReturnType<typeof kanjiGroups>) =>
    groups.map((g) => [g.label, g.cells.map((c) => c.char).join(''), g.known, g.total]);

  test('JLPT groups N5 to N1, non-WaniKani kanji last', () => {
    expect(summary(kanjiGroups('jlpt', subjects, assignments, pack))).toEqual([
      ['N5', '人日一鬱', 2, 4],
      ['N4', '曜', 0, 1],
      ['N3', '', 0, 0],
      ['N2', '', 0, 0],
      ['N1', '', 0, 0],
    ]);
  });

  test('Jōyō by grade, then secondary school; Jinmeiyō left out', () => {
    expect(summary(kanjiGroups('joyo', subjects, assignments, pack))).toEqual([
      ['Grade 1', '人日一', 2, 3],
      ['Grade 2', '曜', 0, 1],
      ['Grade 3', '', 0, 0],
      ['Grade 4', '', 0, 0],
      ['Grade 5', '', 0, 0],
      ['Grade 6', '', 0, 0],
      ['Secondary school', '鬱', 0, 1],
    ]);
  });

  test('frequency bands of 500 up to 2,500, then the rest; unranked left out', () => {
    expect(summary(kanjiGroups('frequency', subjects, assignments, pack))).toEqual([
      ['1 to 500', '人日鬱', 1, 3],
      ['501 to 1,000', '一', 1, 1],
      ['1,001 to 1,500', '', 0, 0],
      ['1,501 to 2,000', '', 0, 0],
      ['2,001 to 2,500', '曜', 0, 1],
      ['2,501 and up', '', 0, 0],
    ]);
  });

  test('WK level view needs no pack and follows lesson order', () => {
    const groups = kanjiGroups('level', subjects, assignments);
    expect(summary(groups)).toEqual([
      ['Level 1', '一人', 1, 2],
      ['Level 2', '日', 1, 1],
      ['Level 3', '曜', 0, 1],
    ]);
    expect(groups[0].pct).toBe(50);
    expect(groups[0].cells[0]).toEqual({
      char: '一',
      subjectId: 10,
      level: 1,
      stage: 9,
      known: true,
      inWaniKani: true,
      rank: 0,
    });
    expect(kanjiGroups('level', subjects, assignments, pack)[0].cells[0].rank).toBe(600);
  });

  test('cells outside WaniKani carry no subject', () => {
    const n5 = kanjiGroups('jlpt', subjects, assignments, pack)[0];
    expect(n5.cells[3]).toEqual({
      char: '鬱',
      subjectId: null,
      level: null,
      stage: 0,
      known: false,
      inWaniKani: false,
      rank: 2,
    });
  });

  test('weighted coverage uses Zipf weights and is flagged estimated', () => {
    const w = weightedKanjiCoverage(subjects, assignments, pack);
    const all = 1 + 1 / 2 + 1 / 3 + 1 / 600 + 1 / 2500;
    expect(w.estimated).toBe(true);
    expect(w.pct).toBeCloseTo((100 * (1 / 3 + 1 / 600)) / all, 10);
  });
});

describe('words', () => {
  const pack: WordsPack = {
    words: ['こと', '事', '生', 'ドア', '人', '猫'],
    readings: ['', 'こと', 'なま', '', 'ひと', 'ねこ'],
    rank: [1, 1, 1, 1, 1, 1],
  };
  const v = (id: number, chars: string, reading: string, level = 1, extra = {}) =>
    subj(id, 'vocabulary', chars, level, {
      readings: [{ reading, primary: true, accepted_answer: true }],
      ...extra,
    });
  const subjects = [
    v(20, '事', 'こと'),
    v(21, '生', 'なま', 5),
    subj(22, 'kana_vocabulary', 'ドア', 3),
    v(23, '猫', 'ねこ', 2, { hidden_at: '2026-01-01T00:00:00Z' }),
  ];
  const assignments = [asg(20, 5, true), asg(21, 3, false), asg(22, 9, true)];

  test('top-N and weighted coverage, coming up, and not in WaniKani', () => {
    const c = wordCoverage(subjects, assignments, pack, [2, 4, 6]);
    expect(c.top).toEqual([
      { size: 2, known: 1, pct: 50 },
      { size: 4, known: 2, pct: 50 },
      { size: 6, known: 2, pct: (100 * 2) / 6 },
    ]);
    const all = 1 + 1 / 2 + 1 / 3 + 1 / 4 + 1 / 5 + 1 / 6;
    expect(c.weighted.estimated).toBe(true);
    expect(c.weighted.pct).toBeCloseTo((100 * (1 / 2 + 1 / 4)) / all, 10);
    expect(c.comingUp).toEqual([{ word: '生', reading: 'なま', rank: 3, subjectId: 21, level: 5 }]);
    expect(c.notInWaniKani.map((w) => w.word)).toEqual(['こと', '人', '猫']);
  });
});

describe('coverageGrowth', () => {
  const s = (date: string, passedKanji: number, passedVocab: number) =>
    ({ date, passedKanji, passedVocab }) as Snapshot;
  const now = Date.parse('2026-10-03T12:00:00Z');

  test('compares the latest snapshot with the one 30 days back', () => {
    const snaps = [
      s('2026-08-01', 10, 20),
      s('2026-09-03', 35, 60),
      s('2026-09-02', 30, 50),
      s('2026-10-03', 77, 90),
    ];
    expect(coverageGrowth(snaps, now)).toEqual({ kanji: 42, vocab: 30, days: 30 });
  });

  test('falls back to the earliest snapshot when history is short', () => {
    expect(coverageGrowth([s('2026-10-03', 8, 4), s('2026-09-30', 5, 1)], now)).toEqual({
      kanji: 3,
      vocab: 3,
      days: 3,
    });
    expect(coverageGrowth([s('2026-10-03', 8, 4)], now)).toBeNull();
  });
});
