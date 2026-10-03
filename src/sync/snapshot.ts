import Dexie from 'dexie';
import type { WaniStatsDb } from '../db/schema';
import {
  buildSnapshot,
  computeDeltas,
  countersBySubject,
  localDateKey,
  RETENTION_DAYS,
  rollUpDeltas,
  shiftDate,
  type Counters,
} from '../domain/snapshots';

/**
 * Writes today's snapshot unless one exists. Deltas diff against the per-subject counters
 * saved with the previous snapshot (meta 'snapshotBaseline'), so a gap of missed days lands
 * in one delta set. Without a baseline (first snapshot, or after an import) only the
 * baseline is saved.
 */
export function writeDailySnapshot(db: WaniStatsDb, now: number): Promise<'written' | 'exists'> {
  const date = localDateKey(now);
  return db.transaction(
    'rw',
    [
      db.snapshots,
      db.snapshotDeltas,
      db.meta,
      db.assignments,
      db.reviewStatistics,
      db.subjects,
      db.user,
    ],
    async () => {
      if (await db.snapshots.get(date)) return 'exists';
      const [assignments, stats, subjects, user, baseline, first] = await Promise.all([
        db.assignments.toArray(),
        db.reviewStatistics.toArray(),
        db.subjects.toArray(),
        db.user.get('me'),
        db.meta.get('snapshotBaseline'),
        db.meta.get('firstSnapshotDate'),
      ]);
      if (!user) throw new Error('Snapshot needs a synced user');

      const counters = countersBySubject(stats);
      await db.snapshots.put(buildSnapshot(assignments, stats, subjects, user, now));
      if (baseline) {
        await db.snapshotDeltas.bulkPut(computeDeltas(baseline.value as Counters, counters, date));
      }
      await db.meta.put({ key: 'snapshotBaseline', value: counters });
      if (!first) await db.meta.put({ key: 'firstSnapshotDate', value: date });

      const old = db.snapshotDeltas
        .where('[date+subjectId]')
        .below([shiftDate(date, -RETENTION_DAYS), Dexie.minKey]);
      const oldRows = await old.toArray();
      if (oldRows.some((d) => d.date.length === 10)) {
        await old.delete();
        await db.snapshotDeltas.bulkPut(rollUpDeltas(oldRows, date));
      }
      return 'written';
    },
  );
}
