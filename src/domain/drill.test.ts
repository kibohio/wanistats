import { describe, expect, it } from 'vitest';
import { advance, checkAnswer, REQUEUE_GAP, startDrill, type DrillState } from './drill';
import type { Item } from './items';

const item = (id: number, meanings: string[], readings: string[] = []): Item =>
  ({
    id,
    type: readings.length ? 'kanji' : 'radical',
    meanings,
    readings: readings.map((reading, i) => ({ reading, primary: i === 0 })),
  }) as Item;

const water = item(1, ['Water'], ['すい', 'みず']);
const ground = item(2, ['Ground']);
const government = item(3, ['Government', 'Administration'], ['せいふ']);

describe('startDrill', () => {
  it('asks meaning and reading for kanji, meaning only without readings', () => {
    const { queue } = startDrill([water, ground], () => 0.5);
    expect(queue).toHaveLength(3);
    expect(queue.filter((q) => q.itemId === 2)).toEqual([{ itemId: 2, kind: 'meaning' }]);
  });
});

describe('advance', () => {
  const state = (n: number): DrillState => ({
    queue: Array.from({ length: n }, (_, i) => ({ itemId: i + 1, kind: 'meaning' as const })),
    missed: [],
    answers: 0,
    correct: 0,
  });

  it('drops a right answer', () => {
    const next = advance(state(3), 'typo');
    expect(next.queue.map((q) => q.itemId)).toEqual([2, 3]);
    expect(next).toMatchObject({ answers: 1, correct: 1, missed: [] });
  });

  it('requeues a wrong answer a few questions later and records the miss once', () => {
    const once = advance(state(10), 'wrong');
    expect(once.queue.findIndex((q) => q.itemId === 1)).toBe(REQUEUE_GAP);
    expect(once).toMatchObject({ answers: 1, correct: 0, missed: [1] });
    const short = advance({ ...state(2), missed: [1] }, 'wrong');
    expect(short.queue.map((q) => q.itemId)).toEqual([2, 1]);
    expect(short.missed).toEqual([1]);
  });
});

describe('checkAnswer', () => {
  it('accepts any accepted meaning, ignoring case, spacing and punctuation', () => {
    expect(checkAnswer(government, 'meaning', '  administration ')).toBe('correct');
    expect(checkAnswer(item(4, ["One's self"]), 'meaning', 'ones  self')).toBe('correct');
  });

  it('allows typos by answer length', () => {
    expect(checkAnswer(government, 'meaning', 'goverment')).toBe('typo');
    expect(checkAnswer(water, 'meaning', 'watr')).toBe('typo');
    expect(checkAnswer(item(5, ['Big']), 'meaning', 'bag')).toBe('wrong');
    expect(checkAnswer(water, 'meaning', 'fire')).toBe('wrong');
  });

  it('asks again for kana typed as a meaning, or a blank answer', () => {
    expect(checkAnswer(water, 'meaning', 'みず')).toBe('retry');
    expect(checkAnswer(water, 'meaning', ' ')).toBe('retry');
  });

  it('checks readings in either kana script', () => {
    expect(checkAnswer(water, 'reading', 'みず')).toBe('correct');
    expect(checkAnswer(water, 'reading', 'スイ')).toBe('correct');
    expect(checkAnswer(water, 'reading', 'みづ')).toBe('wrong');
  });

  it('asks again for a reading with leftover latin letters', () => {
    expect(checkAnswer(water, 'reading', 'みzu')).toBe('retry');
    expect(checkAnswer(water, 'reading', '')).toBe('retry');
  });
});
