import Dexie, { type Table } from 'dexie';
import type {
  AssignmentResource,
  LevelProgressionResource,
  ResetResource,
  ReviewStatisticResource,
  SpacedRepetitionSystemResource,
  SubjectResource,
  User,
} from '../api/types';

export type DbName = 'wanistats' | 'wanistats-sample';

export type CollectionName =
  | 'user'
  | 'subjects'
  | 'assignments'
  | 'review_statistics'
  | 'level_progressions'
  | 'resets'
  | 'spaced_repetition_systems';

export interface SyncState {
  collection: CollectionName;
  /** The collection's top-level data_updated_at, sent back as updated_after. */
  lastUpdatedAt: string | null;
  /** ISO time of the last successful sync of this collection. */
  lastSyncAt: string;
  etag?: string;
}

/** Counts per SRS sub-stage: a1-a4 Apprentice, g1-g2 Guru, m Master, e Enlightened, b Burned. */
export interface StageCounts {
  a1: number;
  a2: number;
  a3: number;
  a4: number;
  g1: number;
  g2: number;
  m: number;
  e: number;
  b: number;
}

export interface ReviewCounters {
  meaningCorrect: number;
  meaningIncorrect: number;
  readingCorrect: number;
  readingIncorrect: number;
}

/** One row per local calendar day (spec 9.12). */
export interface Snapshot {
  /** Local date, YYYY-MM-DD. */
  date: string;
  /** ISO time the snapshot was written, for "Last snapshot today at 14:02". */
  takenAt: string;
  stages: StageCounts;
  load: number;
  lessonsAvailable: number;
  /** Lifetime totals summed over review_statistics. */
  reviews: ReviewCounters;
  passedKanji: number;
  passedVocab: number;
  level: number;
}

/**
 * Counter changes for one subject since the previous snapshot. A gap of missed days lands
 * in the next row. Rows older than 400 days are rolled up with date = 'YYYY-MM'.
 */
export interface SnapshotDelta extends ReviewCounters {
  date: string;
  subjectId: number;
}

export interface KeyValue<V = unknown> {
  key: string;
  value: V;
}

export class WaniStatsDb extends Dexie {
  /** Single row: the API token under key 'token'. Only ever read by the API client. */
  auth!: Table<string, 'token'>;
  subjects!: Table<SubjectResource, number>;
  assignments!: Table<AssignmentResource, number>;
  reviewStatistics!: Table<ReviewStatisticResource, number>;
  levelProgressions!: Table<LevelProgressionResource, number>;
  resets!: Table<ResetResource, number>;
  srsSystems!: Table<SpacedRepetitionSystemResource, number>;
  /** Single row under key 'me'. */
  user!: Table<User, 'me'>;
  syncState!: Table<SyncState, CollectionName>;
  snapshots!: Table<Snapshot, string>;
  snapshotDeltas!: Table<SnapshotDelta, [string, number]>;
  prefs!: Table<KeyValue, string>;
  /** onboardingSeen, schemaVersion, firstSnapshotDate. */
  meta!: Table<KeyValue, string>;

  constructor(name: DbName) {
    super(name);
    // API resources are stored as returned, so `data.*` paths match the WaniKani docs.
    this.version(1).stores({
      auth: '',
      subjects: 'id, data.level',
      assignments: 'id, data.subject_id',
      reviewStatistics: 'id, data.subject_id',
      levelProgressions: 'id',
      resets: 'id',
      srsSystems: 'id',
      user: '',
      syncState: 'collection',
      snapshots: 'date',
      snapshotDeltas: '[date+subjectId]',
      prefs: 'key',
      meta: 'key',
    });
  }
}

export function openDb(name: DbName): WaniStatsDb {
  return new WaniStatsDb(name);
}

export interface PackRow {
  id: string;
  version: string;
  /** Decoded pack JSON. */
  data: unknown;
  /** Compressed download size. */
  bytes: number;
  installedAt: string;
}

/** Packs hold no personal data, so they live apart from `wanistats` and survive logout. */
export class PacksDb extends Dexie {
  packs!: Table<PackRow, string>;

  constructor() {
    super('wanistats-packs');
    this.version(1).stores({ packs: 'id' });
  }
}

export function openPacksDb(): PacksDb {
  return new PacksDb();
}
