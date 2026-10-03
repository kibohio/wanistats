import { expect, test } from 'vitest';
import type { AssignmentResource, SubjectResource } from '../api/types';
import type { KanjiPack } from './coverage';
import { cumulativeCoverage, levelChart, readingCoverage } from './levelCharts';

function kanji(id: number, characters: string, level: number, hidden = false): SubjectResource {
  return {
    id,
    object: 'kanji',
    data: { characters, level, hidden_at: hidden ? '2026-01-01T00:00:00Z' : null },
  } as unknown as SubjectResource;
}
function asg(subjectId: number, stage: number, passed: boolean): AssignmentResource {
  return {
    object: 'assignment',
    data: { subject_id: subjectId, srs_stage: stage, passed_at: passed ? '2026-01-01' : null },
  } as AssignmentResource;
}

// Ranks 1, 2, 3, 600, 2600, 0.
const pack: KanjiPack = {
  chars: ['人', '日', '一', '曜', '鬱', '龍'],
  rank: [1, 1, 1, 597, 2000, -2600],
  grade: [1, 1, 1, 2, 8, 9],
  strokes: [2, 4, 1, 18, 29, 16],
  jlpt: [5, 5, 5, 4, 1, 0],
};
const subjects = [
  kanji(1, '一', 1),
  kanji(2, '人', 1),
  kanji(3, '曜', 3),
  kanji(4, '鬱', 3),
  kanji(5, '龍', 3),
  // Not in the pack at all.
  kanji(6, '凧', 3),
  kanji(7, '日', 3, true),
  { id: 8, object: 'radical', data: { characters: '日', level: 1 } } as unknown as SubjectResource,
];
const assignments = [asg(1, 9, true), asg(2, 4, true), asg(3, 3, false), asg(4, 8, true)];

test('JLPT: one bar per level up to the highest, hidden and non-kanji left out', () => {
  const chart = levelChart('jlpt', subjects, assignments, pack);
  expect(chart.categories.map((c) => c.label)).toEqual([
    'N5',
    'N4',
    'N3',
    'N2',
    'N1',
    'No JLPT level',
  ]);
  expect(chart.levels).toEqual([
    { level: 1, counts: [2, 0, 0, 0, 0, 0], knownCounts: [2, 0, 0, 0, 0, 0], total: 2, known: 2 },
    { level: 2, counts: [0, 0, 0, 0, 0, 0], knownCounts: [0, 0, 0, 0, 0, 0], total: 0, known: 0 },
    { level: 3, counts: [0, 1, 0, 0, 1, 2], knownCounts: [0, 0, 0, 0, 1, 0], total: 4, known: 1 },
  ]);
});

test('Jōyō groups by grade, Jinmeiyō and unlisted kanji fall in Not Jōyō', () => {
  const chart = levelChart('joyo', subjects, assignments, pack);
  expect(chart.categories.at(-1)?.label).toBe('Not Jōyō');
  expect(chart.categories).toHaveLength(8);
  // Grade 1, grade 2, secondary school, then not Jōyō (龍 grade 9, 凧 missing).
  expect(chart.levels[2]!.counts).toEqual([0, 1, 0, 0, 0, 0, 1, 2]);
});

test('frequency bands by Jiten rank, unranked last', () => {
  const chart = levelChart('frequency', subjects, assignments, pack);
  expect(chart.categories.map((c) => c.label)).toEqual([
    '1 to 500',
    '501 to 1,000',
    '1,001 to 1,500',
    '1,501 to 2,000',
    '2,001 to 2,500',
    '2,501 and up',
    'Not ranked',
  ]);
  expect(chart.levels[2]!.counts).toEqual([0, 1, 0, 0, 0, 1, 2]);
});

test('known follows the threshold', () => {
  // Guru: passed at least once. Burned: stage 9 now.
  expect(levelChart('jlpt', subjects, assignments, pack, 9).levels.map((l) => l.known)).toEqual([
    1, 0, 0,
  ]);
});

test('no kanji, no bars', () => {
  expect(levelChart('jlpt', [], [], pack).levels).toEqual([]);
});

test('cumulative: share of each group taught through each level, hidden and unlisted left out', () => {
  const curve = cumulativeCoverage('jlpt', subjects, pack, assignments);
  expect(curve.series.map((s) => [s.label, s.size])).toEqual([
    ['N5', 3],
    ['N4', 1],
    ['N3', 0],
    ['N2', 0],
    ['N1', 1],
  ]);
  expect(curve.rows.map((r) => r.covered)).toEqual([
    [2, 0, 0, 0, 0],
    [2, 0, 0, 0, 0],
    // 日 is hidden, so N5 stays at 2 of 3.
    [2, 1, 0, 0, 1],
  ]);
  expect(curve.rows[2]!.pct).toEqual([(100 * 2) / 3, 100, 0, 0, 100]);
});

test('cumulative: known now per group at the threshold', () => {
  const guru = cumulativeCoverage('jlpt', subjects, pack, assignments);
  // 一 and 人 passed (N5), 曜 never passed (N4), 鬱 passed (N1).
  expect(guru.series.map((s) => s.known)).toEqual([2, 0, 0, 0, 1]);
  expect(guru.series[0]!.knownPct).toBeCloseTo(66.667, 2);
  const burned = cumulativeCoverage('jlpt', subjects, pack, assignments, 9);
  expect(burned.series.map((s) => s.known)).toEqual([1, 0, 0, 0, 0]);
});

test('cumulative: Jōyō leaves Jinmeiyō out of every group', () => {
  const curve = cumulativeCoverage('joyo', subjects, pack);
  expect(curve.series.map((s) => s.size)).toEqual([3, 1, 0, 0, 0, 0, 1]);
  expect(curve.rows.at(-1)!.covered).toEqual([2, 1, 0, 0, 0, 0, 1]);
});

test('reading: Zipf-weighted share of ranked kanji appearances, one series', () => {
  const curve = readingCoverage(subjects, pack, assignments);
  // Ranks 1, 2, 3, 600, 2600; 龍 is unranked and weighs nothing.
  const w = [1, 1 / 2, 1 / 3, 1 / 600, 1 / 2600];
  const all = w.reduce((a, b) => a + b);
  expect(curve.estimated).toBe(true);
  expect(curve.series).toHaveLength(1);
  expect(curve.series[0]!.size).toBe(5);
  // Level 1 teaches 一 (rank 3) and 人 (rank 1).
  expect(curve.rows[0]!.pct[0]).toBeCloseTo((100 * (1 + 1 / 3)) / all, 6);
  expect(curve.rows[2]!.pct[0]).toBeCloseTo((100 * (1 + 1 / 3 + 1 / 600 + 1 / 2600)) / all, 6);
  expect(curve.series[0]!.knownPct).toBeCloseTo((100 * (1 + 1 / 3 + 1 / 2600)) / all, 6);
});

test('no kanji, no rows', () => {
  expect(cumulativeCoverage('jlpt', [], pack).rows).toEqual([]);
  expect(readingCoverage([], pack).rows).toEqual([]);
});
