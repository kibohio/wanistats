import { describe, expect, it } from 'vitest';
import type { SpacedRepetitionSystem } from '../api/types';
import { formatWindow } from '../format';
import { lessonWindow, type LessonWindow } from './lessonWindow';

const label = (w: LessonWindow) => formatWindow([w.morning, w.evening], '24h').join(' or ') || null;

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
const h = (x: number) => x * 60;
const day = { wakeMin: h(7), sleepMin: h(23), lessonMin: h(9) };

describe('lessonWindow', () => {
  it('finds the morning window and the evening slot on the default day', () => {
    const w = lessonWindow(normal, day);
    expect(w.morning).toEqual({ from: h(7), to: h(11) });
    expect(w.evening).toEqual({ from: h(19), to: h(19) });
    expect(label(w)).toBe('07:00 to 11:00 or 19:00');
    expect(w.lessonTimeFits).toBe(true);
    expect(w.closest).toBeNull();
    // Strip slots are half hours: slot n starts at n * 30 minutes.
    expect(w.strip).toHaveLength(48);
    expect(w.strip[13]).toBe('asleep');
    expect(w.strip[14]).toBe('window');
    expect(w.strip[22]).toBe('window');
    expect(w.strip[23]).toBe('awake');
    expect(w.strip[38]).toBe('evening');
    expect(w.strip[39]).toBe('awake');
    expect(w.strip[46]).toBe('asleep');
  });

  it('has no evening slot when the second review comes back before the next wake', () => {
    const w = lessonWindow(accelerated, day);
    expect(w.morning).toEqual({ from: h(7), to: h(17) });
    expect(w.evening).toBeNull();
    expect(label(w)).toBe('07:00 to 17:00');
  });

  it('labels a multi-hour evening slot as a range', () => {
    const w = lessonWindow(system([2, 10, 23]), day);
    expect(w.evening).toEqual({ from: h(19), to: h(21) });
    expect(label(w)).toBe('07:00 to 11:00 or 19:00 to 21:00');
  });

  it('handles waking hours that cross midnight', () => {
    const w = lessonWindow(normal, { wakeMin: h(14), sleepMin: h(6), lessonMin: h(20) });
    expect(w.morning).toEqual({ from: h(14), to: h(18) });
    expect(w.evening).toEqual({ from: h(2), to: h(2) });
    expect(label(w)).toBe('14:00 to 18:00 or 02:00');
    expect(w.lessonTimeFits).toBe(false);
    expect(w.strip[4]).toBe('evening');
    expect(w.strip[20]).toBe('asleep');
    expect(w.strip[40]).toBe('awake');
  });

  it('works in half hours', () => {
    const w = lessonWindow(normal, { wakeMin: h(7.5), sleepMin: h(23.5), lessonMin: h(19.5) });
    expect(w.morning).toEqual({ from: h(7.5), to: h(11.5) });
    expect(w.evening).toEqual({ from: h(19.5), to: h(19.5) });
    expect(label(w)).toBe('07:30 to 11:30 or 19:30');
    expect(w.lessonTimeFits).toBe(true);
    expect(w.strip[14]).toBe('asleep');
    expect(w.strip[15]).toBe('window');
    expect(w.strip[23]).toBe('window');
    expect(w.strip[24]).toBe('awake');
    expect(w.strip[39]).toBe('evening');
    expect(w.strip[46]).toBe('awake');
    expect(w.strip[47]).toBe('asleep');
  });

  it('loses the evening slot when half an hour shorter leaves no lesson time for it', () => {
    // 19:00 brings Apprentice 2 back at 07:00, before a 07:30 wake; 19:30 brings Apprentice 1 back after 23:00.
    const w = lessonWindow(normal, { wakeMin: h(7.5), sleepMin: h(23), lessonMin: h(9) });
    expect(w.morning).toEqual({ from: h(7.5), to: h(11) });
    expect(w.evening).toBeNull();
    expect(label(w)).toBe('07:30 to 11:00');
  });

  it('places a lesson time on its half-hour slot', () => {
    expect(lessonWindow(normal, { ...day, lessonMin: h(11.5) }).lessonTimeFits).toBe(false);
    expect(lessonWindow(normal, { ...day, lessonMin: h(10.5) }).lessonTimeFits).toBe(true);
  });

  it('says when no window exists and suggests the closest hour', () => {
    const w = lessonWindow(normal, { wakeMin: h(9), sleepMin: h(17), lessonMin: h(9) });
    expect(w.morning).toBeNull();
    expect(w.evening).toBeNull();
    expect(label(w)).toBeNull();
    expect(w.lessonTimeFits).toBe(false);
    // 09:00 brings Apprentice 2 back at 21:00, 4 hours after sleep; nothing does better.
    expect(w.closest).toEqual({ min: h(9), hoursOutside: 4 });
  });

  it('reports half hours outside when the closest time misses by one', () => {
    const w = lessonWindow(normal, { wakeMin: h(9), sleepMin: h(20.5), lessonMin: h(9) });
    expect(label(w)).toBeNull();
    // 09:00 brings Apprentice 2 back at 21:00, half an hour after sleep.
    expect(w.closest).toEqual({ min: h(9), hoursOutside: 0.5 });
  });
});
