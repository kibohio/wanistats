import { describe, expect, it } from 'vitest';
import type { SpacedRepetitionSystem } from '../api/types';
import { lessonWindow } from './lessonWindow';

function system(hours: number[]): SpacedRepetitionSystem {
  return {
    name: 'test',
    description: '',
    created_at: '',
    unlocking_stage_position: 0,
    starting_stage_position: 1,
    passing_stage_position: 5,
    burning_stage_position: 9,
    stages: [
      { interval: null, interval_unit: null, position: 0 },
      ...hours.map((h, i) => ({ interval: h, interval_unit: 'hours' as const, position: i + 1 })),
      { interval: null, interval_unit: null, position: 9 },
    ],
  };
}
const normal = system([4, 8, 23, 47, 167, 335, 719, 2879]);
const accelerated = system([2, 4, 8, 23, 167, 335, 719, 2879]);
const day = { wakeHour: 7, sleepHour: 23, lessonHour: 9 };

describe('lessonWindow', () => {
  it('finds the morning window and the evening slot on the default day', () => {
    const w = lessonWindow(normal, day);
    expect(w.morning).toEqual({ from: 7, to: 11 });
    expect(w.evening).toEqual({ from: 19, to: 19 });
    expect(w.label).toBe('07:00 to 11:00 or 19:00 sharp');
    expect(w.lessonTimeFits).toBe(true);
    expect(w.closest).toBeNull();
    expect(w.strip[6]).toBe('asleep');
    expect(w.strip[11]).toBe('window');
    expect(w.strip[12]).toBe('awake');
    expect(w.strip[19]).toBe('evening');
    expect(w.strip[23]).toBe('asleep');
  });

  it('has no evening slot when the second review comes back before the next wake', () => {
    const w = lessonWindow(accelerated, day);
    expect(w.morning).toEqual({ from: 7, to: 17 });
    expect(w.evening).toBeNull();
    expect(w.label).toBe('07:00 to 17:00');
  });

  it('labels a multi-hour evening slot as a range', () => {
    const w = lessonWindow(system([2, 10, 23]), day);
    expect(w.evening).toEqual({ from: 19, to: 21 });
    expect(w.label).toBe('07:00 to 11:00 or 19:00 to 21:00');
  });

  it('handles waking hours that cross midnight', () => {
    const w = lessonWindow(normal, { wakeHour: 14, sleepHour: 6, lessonHour: 20 });
    expect(w.morning).toEqual({ from: 14, to: 18 });
    expect(w.evening).toEqual({ from: 2, to: 2 });
    expect(w.label).toBe('14:00 to 18:00 or 02:00 sharp');
    expect(w.lessonTimeFits).toBe(false);
    expect(w.strip[2]).toBe('evening');
    expect(w.strip[10]).toBe('asleep');
    expect(w.strip[20]).toBe('awake');
  });

  it('says when no window exists and suggests the closest hour', () => {
    const w = lessonWindow(normal, { wakeHour: 9, sleepHour: 17, lessonHour: 9 });
    expect(w.morning).toBeNull();
    expect(w.evening).toBeNull();
    expect(w.label).toBeNull();
    expect(w.lessonTimeFits).toBe(false);
    // 09:00 brings Apprentice 2 back at 21:00, 4 hours after sleep; nothing does better.
    expect(w.closest).toEqual({ hour: 9, hoursOutside: 4 });
  });
});
