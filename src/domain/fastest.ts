import type { SpacedRepetitionSystemResource, SubjectResource } from '../api/types';
import { HOUR_MS, pathToGuru } from './srs';

/**
 * Spec 9.4: shortest possible time in each level (ms), from the subject graph.
 * A kanji whose components all come from earlier levels can start at level start; otherwise it waits
 * for its slowest same-level component to reach Guru. The level takes the needed-th fastest kanji.
 */
export function minLevelTimes(
  subjects: SubjectResource[],
  systems: SpacedRepetitionSystemResource[],
): Map<number, number> {
  const byId = new Map(subjects.map((s) => [s.id, s]));
  const path = new Map(systems.map((s) => [s.id, pathToGuru(s.data, 0) * HOUR_MS]));
  const pathOf = (s: SubjectResource) => path.get(s.data.spaced_repetition_system_id) ?? 0;

  const perLevel = new Map<number, number[]>();
  for (const s of subjects) {
    if (s.object !== 'kanji' || s.data.hidden_at) continue;
    let start = 0;
    for (const id of s.data.component_subject_ids) {
      const c = byId.get(id);
      if (c && !c.data.hidden_at && c.data.level >= s.data.level) start = Math.max(start, pathOf(c));
    }
    const list = perLevel.get(s.data.level) ?? [];
    list.push(start + pathOf(s));
    perLevel.set(s.data.level, list);
  }

  const out = new Map<number, number>();
  for (const [level, list] of perLevel) {
    list.sort((a, b) => a - b);
    out.set(level, list[Math.ceil(0.9 * list.length) - 1]);
  }
  return out;
}

/** Sum of minimum times for levels `from` up to but not including `to`. */
export function sumMinLevelTimes(times: Map<number, number>, from: number, to: number): number {
  let sum = 0;
  for (let level = from; level < to; level++) sum += times.get(level) ?? 0;
  return sum;
}
