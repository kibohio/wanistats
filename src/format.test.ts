import { expect, test } from 'vitest';
import { formatDateRange, formatMinutes, formatTime, formatWindow } from './format';

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
  expect(formatWindow(w, '24h')).toEqual(['07:00 to 11:00', '19:30 sharp']);
  expect(formatWindow(w, '12h').join(' or ')).toMatch(
    /^7:00\s?AM to 11:00\s?AM or 7:30\s?PM sharp$/i,
  );
});
