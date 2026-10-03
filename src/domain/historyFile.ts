import type { ReviewCounters, Snapshot, SnapshotDelta, StageCounts } from '../db/schema';

/** 2 added `account`. Version 1 files, with no account, still import. */
export const HISTORY_SCHEMA_VERSION = 2;

export interface HistoryAccount {
  userId: string;
  username: string;
}

export interface HistoryFile {
  schemaVersion: number;
  exportedAt: string;
  account?: HistoryAccount;
  snapshots: Snapshot[];
  snapshotDeltas: SnapshotDelta[];
}

export interface History {
  snapshots: Snapshot[];
  snapshotDeltas: SnapshotDelta[];
}

export function exportHistory(
  snapshots: Snapshot[],
  snapshotDeltas: SnapshotDelta[],
  now: number,
  account?: HistoryAccount,
): HistoryFile {
  return {
    schemaVersion: HISTORY_SCHEMA_VERSION,
    exportedAt: new Date(now).toISOString(),
    ...(account && { account }),
    snapshots,
    snapshotDeltas,
  };
}

const STAGES: (keyof StageCounts)[] = ['a1', 'a2', 'a3', 'a4', 'g1', 'g2', 'm', 'e', 'b'];
const COUNTERS: (keyof ReviewCounters)[] = [
  'meaningCorrect',
  'meaningIncorrect',
  'readingCorrect',
  'readingIncorrect',
];
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_OR_MONTH = /^\d{4}-\d{2}(-\d{2})?$/;

type Obj = Record<string, unknown>;
function fail(): never {
  throw new Error('This file is not a WaniStats history export.');
}
function obj(v: unknown): Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Obj) : fail();
}
function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fail();
}
function str(v: unknown, re?: RegExp): string {
  return typeof v === 'string' && (!re || re.test(v)) ? v : fail();
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : fail();
}
// Rebuilding each row from known keys both validates and drops anything unexpected.
function pick<K extends string>(o: Obj, keys: K[]): Record<K, number> {
  return Object.fromEntries(keys.map((k) => [k, num(o[k])])) as Record<K, number>;
}

/** Validates an untrusted, JSON-parsed history file. Throws an Error with user-facing copy. */
export function parseHistoryFile(input: unknown): HistoryFile {
  const f = obj(input);
  if (f.schemaVersion !== 1 && f.schemaVersion !== HISTORY_SCHEMA_VERSION) {
    throw new Error('This history file comes from an unsupported version of WaniStats.');
  }
  const account = f.account === undefined ? undefined : obj(f.account);
  return {
    schemaVersion: f.schemaVersion,
    exportedAt: str(f.exportedAt),
    ...(account && { account: { userId: str(account.userId), username: str(account.username) } }),
    snapshots: arr(f.snapshots).map((v) => {
      const s = obj(v);
      return {
        date: str(s.date, DAY),
        takenAt: str(s.takenAt),
        stages: pick(obj(s.stages), STAGES),
        reviews: pick(obj(s.reviews), COUNTERS),
        ...pick(s, ['load', 'lessonsAvailable', 'passedKanji', 'passedVocab', 'level']),
      };
    }),
    snapshotDeltas: arr(f.snapshotDeltas).map((v) => {
      const d = obj(v);
      return { date: str(d.date, DAY_OR_MONTH), ...pick(d, ['subjectId', ...COUNTERS]) };
    }),
  };
}

/** The file's account when it belongs to someone other than `userId`; files without one match. */
export function otherAccount(file: HistoryFile, userId: string): HistoryAccount | undefined {
  return file.account && file.account.userId !== userId ? file.account : undefined;
}

/**
 * Merge by date. An incoming snapshot replaces the local one only if its takenAt is newer, and
 * then that date's deltas come from the import too. Monthly roll-up rows have no snapshot, so
 * an imported month is used only when the device has none for it.
 */
export function mergeHistory(existing: History, incoming: History): History {
  const local = new Map(existing.snapshots.map((s) => [s.date, s]));
  const winners = new Set<string>();
  for (const s of incoming.snapshots) {
    const mine = local.get(s.date);
    if (!mine || Date.parse(s.takenAt) > Date.parse(mine.takenAt)) {
      local.set(s.date, s);
      winners.add(s.date);
    }
  }
  const localDeltaDates = new Set(existing.snapshotDeltas.map((d) => d.date));
  const fromImport = (date: string) =>
    date.length === 10 ? winners.has(date) : !localDeltaDates.has(date);
  const deltas = [
    ...existing.snapshotDeltas.filter((d) => !winners.has(d.date)),
    ...incoming.snapshotDeltas.filter((d) => fromImport(d.date)),
  ];
  const byKey = (a: SnapshotDelta, b: SnapshotDelta) =>
    a.date === b.date ? a.subjectId - b.subjectId : a.date < b.date ? -1 : 1;
  return {
    snapshots: [...local.values()].sort((a, b) => (a.date < b.date ? -1 : 1)),
    snapshotDeltas: deltas.sort(byKey),
  };
}
