import { describe, expect, it } from 'vitest';
import type { AssignmentResource } from '../api/types';
import type { Snapshot, StageCounts } from '../db/schema';
import {
  bandStatus,
  loadFromStages,
  loadTrend,
  stageCountsFromAssignments,
  steadyStateReviewsPerDay,
  workload,
} from './workload';

let nextId = 1;
function asg(stage: number, extra: Partial<AssignmentResource['data']> = {}): AssignmentResource {
  const id = nextId++;
  return {
    id,
    object: 'assignment',
    url: '',
    data_updated_at: null,
    data: {
      available_at: null,
      burned_at: null,
      created_at: '2026-01-01T00:00:00Z',
      hidden: false,
      passed_at: null,
      resurrected_at: null,
      srs_stage: stage,
      started_at: stage > 0 ? '2026-01-01T00:00:00Z' : null,
      subject_id: id,
      subject_type: 'kanji',
      unlocked_at: '2026-01-01T00:00:00Z',
      ...extra,
    },
  };
}

const zero: StageCounts = { a1: 0, a2: 0, a3: 0, a4: 0, g1: 0, g2: 0, m: 0, e: 0, b: 0 };

describe('stageCountsFromAssignments', () => {
  it('counts each sub-stage and skips lessons and hidden subjects', () => {
    const list = [
      ...[1, 1, 2, 3, 4, 5, 5, 6, 7, 8, 9].map((s) => asg(s)),
      asg(0),
      asg(3, { hidden: true }),
    ];
    expect(stageCountsFromAssignments(list)).toEqual({
      a1: 2,
      a2: 1,
      a3: 1,
      a4: 1,
      g1: 2,
      g2: 1,
      m: 1,
      e: 1,
      b: 1,
    });
  });
});

describe('load and band', () => {
  it('is apprentice plus a tenth of guru', () => {
    expect(loadFromStages({ ...zero, a1: 50, a4: 50, g1: 100, g2: 55 })).toBe(115.5);
  });
  it('classifies against the band, inclusive', () => {
    const band = { min: 100, max: 150 };
    expect(bandStatus(99.9, band)).toBe('under');
    expect(bandStatus(100, band)).toBe('in');
    expect(bandStatus(150, band)).toBe('in');
    expect(bandStatus(150.1, band)).toBe('over');
  });
  it('summarises a workload with the default band', () => {
    const w = workload([asg(1), asg(5)]);
    expect(w).toMatchObject({ apprentice: 1, guru: 1, load: 1.1, status: 'under' });
  });
});

describe('steadyStateReviewsPerDay', () => {
  it('is lessons times 8 over item accuracy, rounded', () => {
    expect(steadyStateReviewsPerDay(20, 0.8)).toBe(200);
    expect(steadyStateReviewsPerDay(25, 0.87)).toBe(230);
  });
  it('has no answer without an accuracy', () => {
    expect(steadyStateReviewsPerDay(20, 0)).toBeNull();
  });
});

describe('loadTrend', () => {
  const snap = (date: string, load: number) => ({ date, load }) as Snapshot;
  const now = Date.UTC(2026, 9, 31, 12);

  it('is unavailable before 7 snapshots', () => {
    const snaps = ['2026-10-25', '2026-10-26'].map((d) => snap(d, 100));
    expect(loadTrend(snaps, now)).toEqual({ available: false, points: [] });
  });

  it('keeps the last 30 days and shows a gap as one span, not zeros', () => {
    const dates = [
      '2026-09-30',
      '2026-10-01',
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-31',
    ];
    const t = loadTrend(
      dates.map((d, i) => snap(d, 100 + i)),
      now,
    );
    expect(t.available).toBe(true);
    // 2026-10-02 is the window start; the merged row is clamped to it.
    expect(t.points[0]).toEqual({ from: '2026-10-02', to: '2026-10-24', load: 102 });
    expect(t.points.at(-1)).toEqual({ from: '2026-10-29', to: '2026-10-31', load: 107 });
    expect(t.points.map((p) => p.to)).toEqual(dates.slice(2));
  });
});
