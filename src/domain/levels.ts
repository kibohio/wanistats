import type {
  AssignmentResource,
  LevelProgression,
  LevelProgressionResource,
  ResetResource,
  SubjectResource,
  User,
} from '../api/types';

export interface LevelDuration {
  level: number;
  startAt: number;
  /** Null for the current level. */
  endAt: number | null;
  durationMs: number;
  current: boolean;
  /** No usable progression record: start from the earliest radical or kanji unlock, end at the next level's start. */
  estimated: boolean;
}

export interface ResetMarker {
  at: number;
  from: number;
  to: number;
}

export const toMs = (s: string | null) => (s ? Date.parse(s) : null);

export function levelDurations(input: {
  user: User;
  progressions: LevelProgressionResource[];
  resets: ResetResource[];
  subjects: SubjectResource[];
  assignments: AssignmentResource[];
  now: number;
}): { levels: LevelDuration[]; resets: ResetMarker[] } {
  const { user, now } = input;
  const resets = input.resets
    .filter((r) => r.data.confirmed_at)
    .map((r) => ({
      at: Date.parse(r.data.confirmed_at!),
      from: r.data.original_level,
      to: r.data.target_level,
    }));

  const kept = new Map<number, LevelProgression>();
  for (const { data: p } of input.progressions) {
    if (p.abandoned_at || !p.unlocked_at) continue;
    const created = Date.parse(p.created_at);
    if (resets.some((r) => p.level >= r.to && created < r.at)) continue;
    const prev = kept.get(p.level);
    if (!prev || created > Date.parse(prev.created_at)) kept.set(p.level, p);
  }

  // Earliest unlock is stable when WaniKani adds items to old levels later.
  const levelOf = new Map(
    input.subjects
      .filter((s) => !s.data.hidden_at && (s.object === 'radical' || s.object === 'kanji'))
      .map((s) => [s.id, s.data.level]),
  );
  const firstUnlock = new Map<number, number>();
  for (const { data: a } of input.assignments) {
    const level = levelOf.get(a.subject_id);
    const t = toMs(a.unlocked_at);
    if (level === undefined || t === null) continue;
    if (t < (firstUnlock.get(level) ?? Infinity)) firstUnlock.set(level, t);
  }

  const starts: (number | undefined)[] = [];
  for (let level = 1; level <= user.level; level++) {
    starts[level] = toMs(kept.get(level)?.unlocked_at ?? null) ?? firstUnlock.get(level);
  }
  const vacation = toMs(user.current_vacation_started_at);
  const clock = vacation === null ? now : Math.min(now, vacation);

  const levels: LevelDuration[] = [];
  for (let level = 1; level <= user.level; level++) {
    const startAt = starts[level];
    if (startAt === undefined) continue;
    const current = level === user.level;
    const passed = toMs(kept.get(level)?.passed_at ?? null);
    const endAt = current ? null : (passed ?? starts.slice(level + 1).find((s) => s !== undefined));
    if (endAt === undefined) continue;
    levels.push({
      level,
      startAt,
      endAt,
      durationMs: (endAt ?? clock) - startAt,
      current,
      estimated: passed === null && !(current && kept.has(level)),
    });
  }
  return { levels, resets };
}
