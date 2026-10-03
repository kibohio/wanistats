// Runtime locale, so the clock is 24-hour or 12-hour as the user expects.
const clock = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const dayMonth = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
const fullDate = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** "14:02" for today, "2 Oct 14:02" for any other day. */
export function formatSyncTime(ms: number, now = Date.now()): string {
  const today = new Date(ms).toDateString() === new Date(now).toDateString();
  return today ? clock.format(ms) : `${dayMonth.format(ms)} ${clock.format(ms)}`;
}

/** Local YYYY-MM-DD to "21 Sep 2026". */
export function formatLocalDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return fullDate.format(new Date(y!, m! - 1, d));
}
