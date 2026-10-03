import { describe, expect, it } from 'vitest';
import type { AssignmentResource, SubjectResource } from '../api/types';
import { earliestLevelUp } from './levelUp';
import { HOUR_MS } from './srs';
import { assignment, DAY_MS, iso, kanji, radical, SYSTEMS, T0, user } from './test/fixtures';

const h = (n: number) => T0 + n * HOUR_MS;
const now = h(10.5);

function scenario() {
  const r1 = radical(1, 3);
  const r2 = radical(2, 3);
  const ks = Array.from({ length: 10 }, (_, i) => kanji(10 + i, 3, i === 9 ? [1, 2] : [1]));
  const subjects: SubjectResource[] = [
    r1,
    r2,
    ...ks,
    kanji(90, 3, [], { hidden: true }),
    kanji(91, 4, [1]),
  ];
  const assignments: AssignmentResource[] = [
    ...ks.slice(0, 5).map((k) => assignment(k, { stage: 5, passedAt: h(-50) })),
    assignment(ks[5], { stage: 4, availableAt: h(12) }), // next review passes: Guru at 12:00
    assignment(ks[6], { stage: 2, availableAt: h(8) }), // overdue: now + 70h, truncated
    assignment(ks[7]), // in lessons: ceilHour(now) + 82h
    // ks[8], ks[9] locked. r1 at stage 3 Gurus at floor(14:00 + 47h); r2 locked itself.
    assignment(r1, { stage: 3, availableAt: h(14) }),
  ];
  return { ks, subjects, assignments };
}

describe('earliestLevelUp', () => {
  it('follows the six steps with locked kanji and hour truncation', () => {
    const { ks, subjects, assignments } = scenario();
    const p = earliestLevelUp({ user: user(3), subjects, assignments, systems: SYSTEMS, now });
    expect(p).toMatchObject({
      status: 'projected',
      level: 3,
      total: 10,
      needed: 9,
      passed: 5,
      unpassed: 5,
      k: 4,
      slack: 1,
      slackHolds: false,
      earliestAt: h(61 + 82),
    });
    const byId = new Map(p.kanji.map((k) => [k.subjectId, k]));
    expect(byId.get(ks[5].id)).toMatchObject({
      earliestGuruAt: h(12),
      stage: 4,
      nextReviewAt: h(12),
      critical: true,
      locked: false,
      passed: false,
    });
    expect(byId.get(ks[6].id)!.earliestGuruAt).toBe(h(80));
    expect(byId.get(ks[7].id)).toMatchObject({ earliestGuruAt: h(93), stage: 0 });
    expect(byId.get(ks[8].id)).toMatchObject({
      earliestGuruAt: h(143),
      locked: true,
      stage: null,
      critical: true,
    });
    // Latest component (locked r2, 93h) gates it.
    expect(byId.get(ks[9].id)).toMatchObject({ earliestGuruAt: h(175), critical: false });
    expect(byId.get(ks[0].id)).toMatchObject({ passed: true, critical: false });
    expect(p.kanji.filter((k) => k.critical)).toHaveLength(4);
  });

  it('has zero slack when every kanji is needed', () => {
    const ks = Array.from({ length: 5 }, (_, i) => kanji(10 + i, 3));
    const p = earliestLevelUp({
      user: user(3),
      subjects: ks,
      assignments: ks.map((k) => assignment(k)),
      systems: SYSTEMS,
      now,
    });
    expect(p).toMatchObject({ needed: 5, k: 5, slack: 0, slackHolds: false, earliestAt: h(93) });
  });

  it('says the slack sentence holds only when missing any slack kanji keeps the date', () => {
    const ks = Array.from({ length: 10 }, (_, i) => kanji(10 + i, 3));
    const p = earliestLevelUp({
      user: user(3),
      subjects: ks,
      assignments: ks.map((k) => assignment(k)),
      systems: SYSTEMS,
      now,
    });
    expect(p).toMatchObject({ k: 9, slack: 1, slackHolds: true });
  });

  it('uses the accelerated system at level 1', () => {
    const r = radical(1, 1);
    const k = kanji(2, 1, [1]);
    const p = earliestLevelUp({
      user: user(1),
      subjects: [r, k],
      assignments: [assignment(r)],
      systems: SYSTEMS,
      now,
    });
    expect(p.earliestAt).toBe(h(11 + 37 + 37));
  });

  it('is ready when enough kanji have passed', () => {
    const ks = Array.from({ length: 10 }, (_, i) => kanji(10 + i, 3));
    const p = earliestLevelUp({
      user: user(3),
      subjects: ks,
      assignments: ks.map((k, i) => assignment(k, i < 9 ? { stage: 5, passedAt: h(0) } : {})),
      systems: SYSTEMS,
      now,
    });
    expect(p).toMatchObject({
      status: 'ready',
      k: 0,
      slack: 1,
      earliestAt: now,
      slackHolds: false,
    });
  });

  it('freezes the remaining time while on vacation', () => {
    const { subjects, assignments } = scenario();
    const later = now + 5 * DAY_MS;
    const p = earliestLevelUp({
      user: user(3, { current_vacation_started_at: iso(now) }),
      subjects,
      assignments,
      systems: SYSTEMS,
      now: later,
    });
    expect(p.status).toBe('vacation');
    expect(p.earliestAt).toBe(h(143) + 5 * DAY_MS);
  });

  it('is capped at the subscription max level', () => {
    const { subjects, assignments } = scenario();
    const u = user(3);
    u.subscription = { ...u.subscription, type: 'free', max_level_granted: 3 };
    const p = earliestLevelUp({ user: u, subjects, assignments, systems: SYSTEMS, now });
    expect(p.status).toBe('capped');
  });
});
