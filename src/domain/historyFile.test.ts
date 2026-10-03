import { describe, expect, test } from 'vitest';
import type { Snapshot, SnapshotDelta } from '../db/schema';
import {
  exportHistory,
  HISTORY_SCHEMA_VERSION,
  mergeHistory,
  parseHistoryFile,
} from './historyFile';

function snap(date: string, takenAt: string, level = 1): Snapshot {
  return {
    date,
    takenAt,
    stages: { a1: 1, a2: 0, a3: 0, a4: 0, g1: 0, g2: 0, m: 0, e: 0, b: 0 },
    load: 1,
    lessonsAvailable: 0,
    reviews: { meaningCorrect: 1, meaningIncorrect: 0, readingCorrect: 0, readingIncorrect: 0 },
    passedKanji: 0,
    passedVocab: 0,
    level,
  };
}
function delta(date: string, subjectId: number, mc = 1): SnapshotDelta {
  return {
    date,
    subjectId,
    meaningCorrect: mc,
    meaningIncorrect: 0,
    readingCorrect: 0,
    readingIncorrect: 0,
  };
}

const NOW = Date.parse('2026-10-03T10:00:00Z');

test('export then parse round-trips', () => {
  const snapshots = [snap('2026-10-01', '2026-10-01T08:00:00.000Z')];
  const deltas = [delta('2025-06', 3), delta('2026-10-01', 4)];
  const file = exportHistory(snapshots, deltas, NOW);
  expect(file).toEqual({
    schemaVersion: HISTORY_SCHEMA_VERSION,
    exportedAt: '2026-10-03T10:00:00.000Z',
    snapshots,
    snapshotDeltas: deltas,
  });
  expect(parseHistoryFile(JSON.parse(JSON.stringify(file)))).toEqual(file);
});

describe('parseHistoryFile', () => {
  const good = () =>
    JSON.parse(
      JSON.stringify(exportHistory([snap('2026-10-01', 'x')], [delta('2026-10-01', 1)], NOW)),
    );

  test('rejects other schema versions and bad shapes', () => {
    expect(() => parseHistoryFile({ ...good(), schemaVersion: 99 })).toThrow(/version/);
    expect(() => parseHistoryFile(null)).toThrow();
    expect(() => parseHistoryFile({ ...good(), snapshots: {} })).toThrow();
    const badSnap = good();
    badSnap.snapshots[0].stages.a1 = 'x';
    expect(() => parseHistoryFile(badSnap)).toThrow();
    const badDate = good();
    badDate.snapshotDeltas[0].date = '1 Oct';
    expect(() => parseHistoryFile(badDate)).toThrow();
  });

  test('drops unknown fields', () => {
    const f = good();
    f.snapshots[0].extra = 1;
    f.snapshotDeltas[0].extra = 1;
    const parsed = parseHistoryFile(f);
    expect(parsed.snapshots[0]).not.toHaveProperty('extra');
    expect(parsed.snapshotDeltas[0]).not.toHaveProperty('extra');
  });
});

test('merge by date: newer takenAt wins and brings its deltas', () => {
  const existing = {
    snapshots: [
      snap('2026-10-01', '2026-10-01T08:00:00Z', 1),
      snap('2026-10-02', '2026-10-02T20:00:00Z', 1),
    ],
    snapshotDeltas: [delta('2026-10-02', 1, 5), delta('2025-06', 1, 9)],
  };
  const incoming = exportHistory(
    [
      snap('2026-10-01', '2026-10-01T09:00:00Z', 2), // newer: replaces
      snap('2026-10-02', '2026-10-02T08:00:00Z', 2), // older: ignored
      snap('2026-09-30', '2026-09-30T08:00:00Z', 2), // new date: added
    ],
    [
      delta('2026-10-01', 7),
      delta('2026-10-02', 2, 1),
      delta('2026-09-30', 3),
      delta('2025-06', 1, 1),
      delta('2025-05', 1, 4),
    ],
    NOW,
  );
  const merged = mergeHistory(existing, incoming);
  expect(merged.snapshots.map((s) => [s.date, s.level])).toEqual([
    ['2026-09-30', 2],
    ['2026-10-01', 2],
    ['2026-10-02', 1],
  ]);
  expect(merged.snapshotDeltas.map((d) => [d.date, d.subjectId, d.meaningCorrect])).toEqual([
    ['2025-05', 1, 4], // month only in the import: added
    ['2025-06', 1, 9], // month present locally: kept
    ['2026-09-30', 3, 1],
    ['2026-10-01', 7, 1],
    ['2026-10-02', 1, 5],
  ]);
});
