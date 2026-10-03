import { describe, expect, it } from 'vitest';
import { formatSyncTime } from '../format';
import { historyReadout } from './ProfileMenu';

describe('historyReadout', () => {
  const now = new Date(2026, 9, 3, 15).getTime();

  it('names the first day and the last snapshot time', () => {
    const at = new Date(2026, 9, 3, 14, 2);
    const text = historyReadout(
      { days: 12, first: '2026-09-21', last: '2026-10-03', lastTakenAt: at.toISOString() },
      '24h',
      now,
    );
    expect(text).toMatch(/^History: 12 days recorded since .*21.*\. Last snapshot today at /);
    expect(text.endsWith(`${formatSyncTime(at.getTime(), '24h', now)}.`)).toBe(true);
  });

  it('reads plainly with no history', () => {
    expect(historyReadout({ days: 0 }, '24h', now)).toBe('History: 0 days recorded.');
  });
});
