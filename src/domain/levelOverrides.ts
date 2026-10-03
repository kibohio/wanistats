import type { LevelOverride, PaceRow } from './pace';

/** Prefs store `levelOverrides` as booleans: true forces include, false forces exclude. */
export function toPaceOverrides(
  stored: Record<number, boolean>,
): Partial<Record<number, LevelOverride>> {
  return Object.fromEntries(
    Object.entries(stored).map(([level, include]) => [level, include ? 'include' : 'exclude']),
  );
}

/** Flip one level. An override that matches the automatic rule is dropped, so resets stay clean. */
export function toggleLevel(
  stored: Record<number, boolean>,
  row: Pick<PaceRow, 'level' | 'included' | 'autoExcluded'>,
): Record<number, boolean> {
  const next = { ...stored };
  const include = !row.included;
  if (include === !row.autoExcluded) delete next[row.level];
  else next[row.level] = include;
  return next;
}
