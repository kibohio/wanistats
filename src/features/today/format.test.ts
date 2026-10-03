import { expect, test } from 'vitest';
import { shortWhen } from './format';

test('tile labels drop the minutes on the hour only in 12-hour locales', () => {
  const now = new Date(2026, 9, 3, 12).getTime();
  const twelveHour = /^h1[12]$/.test(
    new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hourCycle ?? '',
  );
  const onHour = shortWhen(new Date(2026, 9, 4, 16).getTime(), now);
  expect(onHour.includes(':00')).toBe(!twelveHour);
  expect(shortWhen(new Date(2026, 9, 3, 16, 30).getTime(), now)).toContain('30');
  expect(shortWhen(now - 1, now)).toBe('Now');
});
