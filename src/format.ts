/** The clock pref: 'system' follows the runtime locale. */
export type Clock = 'system' | '12h' | '24h';

const systemIs12h = ['h11', 'h12'].includes(
  new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hourCycle ?? '',
);
const is12h = (c: Clock) => (c === 'system' ? systemIs12h : c === '12h');
const time24 = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const time12 = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});
const hour12 = new Intl.DateTimeFormat(undefined, { hour: 'numeric', hour12: true });

/**
 * "07:30" or "7:30 AM". `short` drops whole-hour minutes on a 12-hour clock ("4 PM"), for tight
 * labels; a 24-hour clock keeps "16:00".
 */
export function formatTime(ms: number, clock: Clock, short = false): string {
  if (!is12h(clock)) return time24.format(ms);
  return short && new Date(ms).getMinutes() === 0 ? hour12.format(ms) : time12.format(ms);
}

/** Minutes since midnight (wrapping), formatted like formatTime. */
export function formatMinutes(min: number, clock: Clock, short = false): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  // A fixed date, so a DST change today can't shift the hour.
  return formatTime(new Date(2000, 0, 1, Math.floor(m / 60), m % 60).getTime(), clock, short);
}

/** A lesson window's ranges: "07:00 to 11:00", or "19:30" when only that one time works. */
export function formatWindow(
  ranges: ({ from: number; to: number } | null)[],
  clock: Clock,
): string[] {
  return ranges
    .filter((r) => r !== null)
    .map((r) =>
      r.from === r.to
        ? formatMinutes(r.from, clock)
        : `${formatMinutes(r.from, clock)} to ${formatMinutes(r.to, clock)}`,
    );
}

const dayMonth = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
const fullDate = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** "14:02" for today, "2 Oct 14:02" for any other day. */
export function formatSyncTime(ms: number, clock: Clock, now = Date.now()): string {
  const today = new Date(ms).toDateString() === new Date(now).toDateString();
  const t = formatTime(ms, clock);
  return today ? t : `${dayMonth.format(ms)} ${t}`;
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

/** "1 item", "2 items". */
export const plural = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString()} ${n === 1 ? one : many}`;

/** A span in hours as words: "30 minutes", "1 hour", "1 hour 30 minutes", "2 hours". */
export function formatHours(hours: number): string {
  const total = Math.round(hours * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return plural(m, 'minute');
  return m ? `${plural(h, 'hour')} ${plural(m, 'minute')}` : plural(h, 'hour');
}
