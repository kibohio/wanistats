import { expect, test } from 'vitest';
import { formatDateRange } from './format';

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
