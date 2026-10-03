import { HOUR_MS } from '../../domain/srs';

export const DAY_MS = 24 * HOUR_MS;

const date = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const short = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
const dateTime = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

export const fmtDate = (ms: number) => date.format(ms);
export const fmtShort = (ms: number) => short.format(ms);
export const fmtDateTime = (ms: number) => dateTime.format(ms);
export const fmtDays = (days: number) => days.toFixed(1);

/** "3 d 10 h". */
export function fmtSpan(ms: number): string {
  const h = Math.round(ms / HOUR_MS);
  return `${Math.floor(h / 24)} d ${h % 24} h`;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
