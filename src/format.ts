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

/** "21 Sep 2026". */
export const formatDate = (ms: number) => fullDate.format(ms);

/** Local YYYY-MM-DD to "21 Sep 2026". */
export function formatLocalDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return formatDate(new Date(y!, m! - 1, d).getTime());
}

/** Both ends as "7 Jul", or "7 Jul 2027" when either end falls outside the current year. */
export function formatDateRange(from: number, to: number, now = Date.now()): [string, string] {
  const year = new Date(now).getFullYear();
  const inYear = new Date(from).getFullYear() === year && new Date(to).getFullYear() === year;
  const fmt = inYear ? dayMonth : fullDate;
  return [fmt.format(from), fmt.format(to)];
}
