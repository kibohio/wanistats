import { HOUR_MS } from '../../domain/srs';
import { formatTime, type Clock } from '../../format';
export { plural } from '../../format';

export const DAY_MS = 24 * HOUR_MS;

const dayMonth = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });

export const fmtDateTime = (ms: number, clock: Clock) =>
  `${dayMonth.format(ms)}, ${formatTime(ms, clock)}`;
export const fmtDays = (days: number) => days.toFixed(1);

/** "3 d 10 h". */
export function fmtSpan(ms: number): string {
  const h = Math.round(ms / HOUR_MS);
  return `${Math.floor(h / 24)} d ${h % 24} h`;
}
