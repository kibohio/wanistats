/** Local midnight `offsetDays` days after the day containing `ms`. DST-safe. */
export function localDayStart(ms: number, offsetDays = 0): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + offsetDays).getTime();
}

/** Local calendar date as YYYY-MM-DD, the snapshot key format. */
export function localDateKey(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** First date key of a window of `days` local days ending today. */
export function windowStartKey(now: number, days: number): string {
  return localDateKey(localDayStart(now, 1 - days));
}

/** Whole local days between two midnights, robust to 23 and 25 hour days. */
export function daysBetween(fromDayStart: number, toDayStart: number): number {
  return Math.round((toDayStart - fromDayStart) / 86_400_000);
}

export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return localDateKey(new Date(y, m - 1, d + days).getTime());
}
