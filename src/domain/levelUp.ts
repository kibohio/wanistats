import type {
  AssignmentResource,
  SpacedRepetitionSystemResource,
  SubjectResource,
  User,
} from '../api/types';
import { toMs } from './levels';
import { ceilHour, floorHour, HOUR_MS, pathToGuru } from './srs';

export interface LevelUpKanji {
  subjectId: number;
  /** Null while locked; 0 in the lesson queue. */
  stage: number | null;
  nextReviewAt: number | null;
  /** passed_at for passed kanji. */
  earliestGuruAt: number;
  passed: boolean;
  /** One of the k earliest unpassed kanji. */
  critical: boolean;
  locked: boolean;
}

export interface LevelUpProjection {
  level: number;
  /**
   * ready: enough kanji have passed, the level-up lands with the next sync.
   * capped: the subscription grants no higher level; times still show when the level would be done.
   * vacation: times assume the vacation ends now.
   */
  status: 'projected' | 'ready' | 'vacation' | 'capped';
  total: number;
  needed: number;
  passed: number;
  unpassed: number;
  k: number;
  slack: number;
  /** "Miss up to {slack} of these {unpassed} and the date holds" is true. */
  slackHolds: boolean;
  /** `now` when ready. */
  earliestAt: number;
  kanji: LevelUpKanji[];
}

/** Spec 9.3. */
export function earliestLevelUp(input: {
  user: User;
  subjects: SubjectResource[];
  assignments: AssignmentResource[];
  systems: SpacedRepetitionSystemResource[];
  now: number;
}): LevelUpProjection {
  const { user, now } = input;
  const vacation = toMs(user.current_vacation_started_at);
  // On vacation, project from the moment it started, then shift by its length so far.
  const clock = vacation === null ? now : Math.min(now, vacation);
  const shift = now - clock;

  const subjects = new Map(input.subjects.map((s) => [s.id, s]));
  const assignments = new Map(input.assignments.map((a) => [a.data.subject_id, a.data]));
  const systems = new Map(input.systems.map((s) => [s.id, s.data]));
  const pathOf = (s: SubjectResource, stage: number) => {
    const system = systems.get(s.data.spaced_repetition_system_id);
    if (!system) throw new Error(`Unknown SRS system ${s.data.spaced_repetition_system_id}`);
    return pathToGuru(system, stage) * HOUR_MS;
  };

  const memo = new Map<number, number>();
  // Earliest Guru on the projection clock, assuming every answer is right.
  const guruAt = (s: SubjectResource): number => {
    const cached = memo.get(s.id);
    if (cached !== undefined) return cached;
    const a = assignments.get(s.id);
    let t: number;
    if (a?.passed_at) {
      t = Date.parse(a.passed_at);
    } else if (a?.unlocked_at && a.srs_stage > 0) {
      const review = Math.max(toMs(a.available_at) ?? clock, clock);
      const path = pathOf(s, a.srs_stage);
      t = path ? floorHour(review + path) : review;
    } else {
      // In lessons, or locked until the latest component reaches Guru.
      let unlock = clock;
      if (!a?.unlocked_at && 'component_subject_ids' in s.data) {
        for (const id of s.data.component_subject_ids) {
          const c = subjects.get(id);
          if (c && !c.data.hidden_at) unlock = Math.max(unlock, guruAt(c));
        }
      }
      t = ceilHour(unlock) + pathOf(s, 0);
    }
    memo.set(s.id, t);
    return t;
  };

  const rows: LevelUpKanji[] = input.subjects
    .filter((s) => s.object === 'kanji' && s.data.level === user.level && !s.data.hidden_at)
    .map((s) => {
      const a = assignments.get(s.id);
      const passed = !!a?.passed_at;
      const locked = !a?.unlocked_at;
      return {
        subjectId: s.id,
        stage: locked ? null : a.srs_stage,
        nextReviewAt: toMs(a?.available_at ?? null),
        earliestGuruAt: guruAt(s) + (passed ? 0 : shift),
        passed,
        critical: false,
        locked,
      };
    });

  const total = rows.length;
  const needed = Math.ceil(0.9 * total);
  const unpassed = rows
    .filter((r) => !r.passed)
    .sort((a, b) => a.earliestGuruAt - b.earliestGuruAt || a.subjectId - b.subjectId);
  const passed = total - unpassed.length;
  const k = Math.max(0, needed - passed);
  const slack = unpassed.length - k;
  unpassed.slice(0, k).forEach((r) => (r.critical = true));
  const earliestAt = k ? unpassed[k - 1].earliestGuruAt : now;

  const status =
    user.level >= user.subscription.max_level_granted
      ? 'capped'
      : k === 0
        ? 'ready'
        : vacation !== null
          ? 'vacation'
          : 'projected';

  return {
    level: user.level,
    status,
    total,
    needed,
    passed,
    unpassed: unpassed.length,
    k,
    slack,
    // Missing any `slack` kanji leaves k on time only if every unpassed kanji lands by the date.
    slackHolds: k > 0 && slack > 0 && unpassed.every((r) => r.earliestGuruAt <= earliestAt),
    earliestAt,
    kanji: rows,
  };
}
