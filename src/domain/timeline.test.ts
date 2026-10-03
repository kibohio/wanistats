import { describe, expect, it } from 'vitest';
import type { AssignmentResource, SpacedRepetitionSystem, SubjectType } from '../api/types';
import { timeline } from './timeline';

const now = Date.UTC(2026, 9, 3, 14, 30);
const at = (d: number, h: number) => new Date(Date.UTC(2026, 9, d, h)).toISOString();

function asg(
  subjectId: number,
  stage: number,
  availableAt: string | null,
  type: SubjectType = 'kanji',
  extra: Partial<AssignmentResource['data']> = {},
): AssignmentResource {
  return {
    id: subjectId,
    object: 'assignment',
    url: '',
    data_updated_at: null,
    data: {
      available_at: availableAt,
      burned_at: null,
      created_at: '',
      hidden: false,
      passed_at: null,
      resurrected_at: null,
      srs_stage: stage,
      started_at: stage > 0 ? at(1, 0) : null,
      subject_id: subjectId,
      subject_type: type,
      unlocked_at: at(1, 0),
      ...extra,
    },
  };
}

const assignments = [
  asg(1, 1, at(3, 10), 'radical'), // already available
  asg(2, 5, at(3, 15)),
  asg(3, 7, at(4, 9), 'vocabulary'),
  asg(4, 8, at(5, 0)),
  asg(5, 9, null),
  asg(6, 0, null),
  asg(7, 3, at(3, 16), 'kanji', { hidden: true }),
  asg(8, 2, at(20, 0), 'kana_vocabulary'),
];

const normal: SpacedRepetitionSystem = {
  name: 'normal',
  description: '',
  created_at: '',
  unlocking_stage_position: 0,
  starting_stage_position: 1,
  passing_stage_position: 5,
  burning_stage_position: 9,
  stages: [
    { interval: null, interval_unit: null, position: 0 },
    ...[4, 8, 23, 47, 167, 335, 719, 2879].map((h, i) => ({
      interval: h * 3600,
      interval_unit: 'seconds' as const,
      position: i + 1,
    })),
    { interval: null, interval_unit: null, position: 9 },
  ],
};

describe('timeline', () => {
  it('bins 24 hours by hour from the current hour, overdue items in the first bin', () => {
    const t = timeline(assignments, now, { range: '24h', granularity: 'hour', stackBy: 'stage' });
    expect(t.bins).toHaveLength(24);
    expect(t.bins[0].start).toBe(Date.UTC(2026, 9, 3, 14));
    expect(t.bins[0].subjectIds).toEqual([1]);
    expect(t.bins[1].counts).toEqual({ apprentice: 0, guru: 1, master: 0, enlightened: 0 });
    expect(t.bins[19].counts.master).toBe(1);
    expect(t.total).toBe(3);
    expect(t.bins[23].runningTotal).toBe(3);
  });

  it('bins days from local midnight and marks burns and level-critical items', () => {
    const t = timeline(assignments, now, {
      range: '7d',
      granularity: 'day',
      stackBy: 'stage',
      criticalIds: new Set([2]),
    });
    expect(t.bins).toHaveLength(7);
    expect(t.bins[0].start).toBe(Date.UTC(2026, 9, 3));
    expect(t.bins[0]).toMatchObject({ total: 2, critical: 1, burns: 0, subjectIds: [1, 2] });
    expect(t.bins[2]).toMatchObject({ total: 1, burns: 1, runningTotal: 4 });
  });

  it('stacks by item type with kana vocabulary under vocabulary, and bins weeks', () => {
    const t = timeline(assignments, now, { range: '120d', granularity: 'week', stackBy: 'type' });
    expect(t.keys).toEqual(['radical', 'kanji', 'vocabulary']);
    expect(t.bins).toHaveLength(18);
    expect(t.bins[0].counts).toEqual({ radical: 1, kanji: 2, vocabulary: 1 });
    expect(t.bins[2].counts.vocabulary).toBe(1);
    expect(t.total).toBe(5);
  });

  it('adds estimated reviews from N lessons a day at the lesson hour, hour-truncated', () => {
    const lessons = { perDay: 10, lessonHour: 9, system: normal };
    const h = timeline(assignments, now, {
      range: '24h',
      granularity: 'hour',
      stackBy: 'stage',
      lessons,
    });
    // Today's 09:00 is past; tomorrow's lessons come back 4 hours later.
    expect(h.bins.map((b) => b.estimate).filter((n) => n > 0)).toEqual([10]);
    expect(h.bins[23].estimate).toBe(10);

    const d = timeline(assignments, now, {
      range: '7d',
      granularity: 'day',
      stackBy: 'stage',
      lessons,
    });
    expect(d.bins.slice(0, 3).map((b) => b.estimate)).toEqual([0, 20, 30]);
    expect(d.bins[2].runningEstimate).toBe(50);
    expect(d.bins[0].total).toBe(2);
  });
});
