import { localDayStart } from '../../domain/localDate';

// Runtime locale throughout, like src/format.ts.
const clockFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const weekdayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const dayMonthFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
const dayDateFmt = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
const fullDayFmt = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

export const clock = (ms: number) => clockFmt.format(ms);
/** "Tue 6 Oct" */
export const dayDate = (ms: number) => dayDateFmt.format(ms);
/** "6 Oct" */
export const dayMonth = (ms: number) => dayMonthFmt.format(ms);
/** "Saturday 3 October" */
export const fullDay = (ms: number) => fullDayFmt.format(ms);

const dayOffset = (ms: number, now: number) =>
  Math.round((localDayStart(ms) - localDayStart(now)) / 86_400_000);

/** "Today", "Tonight", "Tomorrow", "Sun" or "6 Oct", plus the time; "Now" when due. */
export function when(ms: number, now: number): string {
  if (ms <= now) return 'Now';
  const d = dayOffset(ms, now);
  const day =
    d === 0
      ? new Date(ms).getHours() >= 19
        ? 'Tonight'
        : 'Today'
      : d === 1
        ? 'Tomorrow'
        : d < 7
          ? weekdayFmt.format(ms)
          : dayMonth(ms);
  return `${day} ${clock(ms)}`;
}

/** Tile label: "18:00" today, "Sun 09:00" later, "Now" when due. */
export function shortWhen(ms: number, now: number): string {
  if (ms <= now) return 'Now';
  const d = dayOffset(ms, now);
  return d === 0 ? clock(ms) : `${d < 7 ? weekdayFmt.format(ms) : dayMonth(ms)} ${clock(ms)}`;
}

/** Local YYYY-MM-DD as "Tue" within the last week, else "21 Sep". */
export function sinceDay(date: string, now: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const ms = new Date(y!, m! - 1, d).getTime();
  return -dayOffset(ms, now) < 7 ? weekdayFmt.format(ms) : dayMonth(ms);
}

export function stageName(stage: number | null): string {
  if (stage === null) return 'Locked';
  if (stage === 0) return 'In lessons';
  if (stage <= 4) return `Apprentice ${stage}`;
  if (stage <= 6) return `Guru ${stage - 4}`;
  return ['Master', 'Enlightened', 'Burned'][stage - 7] ?? 'Burned';
}

export const pct = (x: number | null) => (x === null ? 'n/a' : `${Math.round(x * 100)}%`);
export const days1 = (n: number) => n.toFixed(1);
export const int = (n: number) => Math.round(n).toLocaleString();

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
export const word = (n: number) => WORDS[n] ?? String(n);
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
