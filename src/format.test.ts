import { expect, test } from 'vitest';
import {
  formatDateRange,
  formatHours,
  formatMinutes,
  formatTime,
  formatMonthRange,
  formatWindow,
  plural,
} from './format';

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d).getTime();
const now = at(2026, 10, 3);

test('a range inside the current year leaves the year out', () => {
  const [a, b] = formatDateRange(at(2026, 11, 2), at(2026, 12, 20), now);
  expect(a).not.toMatch(/2026/);
  expect(b).not.toMatch(/2026/);
});

test('a range in a later year shows the year on both ends', () => {
  const [a, b] = formatDateRange(at(2027, 7, 7), at(2027, 9, 1), now);
  expect(a).toMatch(/2027/);
  expect(b).toMatch(/2027/);
});

test('a range across years shows both years', () => {
  const [a, b] = formatDateRange(at(2027, 7, 7), at(2028, 2, 20), now);
  expect(a).toMatch(/2027/);
  expect(b).toMatch(/2028/);
  const [c, d] = formatDateRange(at(2026, 11, 2), at(2027, 1, 20), now);
  expect(c).toMatch(/2026/);
  expect(d).toMatch(/2027/);
});

test('times follow the clock pref', () => {
  const t = new Date(2026, 9, 3, 16, 5).getTime();
  expect(formatTime(t, '24h')).toBe('16:05');
  expect(formatTime(t, '12h')).toMatch(/^4:05\s?PM$/i);
  expect(formatMinutes(450, '24h')).toBe('07:30');
  expect(formatMinutes(450, '12h')).toMatch(/^7:30\s?AM$/i);
  expect(formatMinutes(1440 + 60, '24h')).toBe('01:00');
});

test('short times drop whole-hour minutes on a 12-hour clock only', () => {
  expect(formatMinutes(960, '12h', true)).toMatch(/^4\s?PM$/i);
  expect(formatMinutes(990, '12h', true)).toMatch(/^4:30\s?PM$/i);
  expect(formatMinutes(960, '24h', true)).toBe('16:00');
});

test('lesson window ranges', () => {
  const w = [{ from: 420, to: 660 }, null, { from: 1170, to: 1170 }];
  expect(formatWindow(w, '24h')).toEqual(['07:00 to 11:00', '19:30']);
  expect(formatWindow(w, '12h').join(' or ')).toMatch(/^7:00\s?AM to 11:00\s?AM or 7:30\s?PM$/i);
});

test('hour spans read as words', () => {
  expect(formatHours(0.5)).toBe('30 minutes');
  expect(formatHours(1)).toBe('1 hour');
  expect(formatHours(1.5)).toBe('1 hour 30 minutes');
  expect(formatHours(4)).toBe('4 hours');
  expect(formatHours(1 / 60)).toBe('1 minute');
});

test('plural', () => {
  expect(plural(1, 'day')).toBe('1 day');
  expect(plural(0, 'day')).toBe('0 days');
  expect(plural(1200, 'review')).toBe('1,200 reviews');
  expect(plural(2, 'kanji', 'kanji')).toBe('2 kanji');
});

test('a finish range shows months, or full dates when both fall in one month', () => {
  const [a, b] = formatMonthRange(at(2027, 7, 7), at(2028, 2, 20), now);
  expect(a).toMatch(/^\D*Jul\D*2027$/);
  expect(b).toMatch(/^\D*Feb\D*2028$/);
  expect(formatMonthRange(at(2027, 7, 7), at(2027, 7, 20), now)[1]).toMatch(/20/);
});
