import Dexie from 'dexie';
import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import type { KanjiResource, RadicalResource, VocabularyResource } from '../api/types';
import { openDb } from '../db/schema';
import { HOUR_MS } from '../domain/srs';
import { SAMPLE_VERSION, seedSampleDb } from './index';

const NOW = Date.UTC(2026, 9, 3, 14, 37);
const DAY = 24 * HOUR_MS;

async function seeded(now = NOW) {
  const db = openDb('wanistats-sample');
  await seedSampleDb(db, now);
  return {
    db,
    subjects: await db.subjects.toArray(),
    assignments: await db.assignments.toArray(),
    stats: await db.reviewStatistics.toArray(),
    progressions: await db.levelProgressions.toArray(),
    resets: await db.resets.toArray(),
    srs: await db.srsSystems.toArray(),
    user: await db.user.get('me'),
    snapshots: await db.snapshots.orderBy('date').toArray(),
    deltas: await db.snapshotDeltas.toArray(),
    meta: Object.fromEntries((await db.meta.toArray()).map((r) => [r.key, r.value])),
    syncState: await db.syncState.toArray(),
  };
}

type Seed = Awaited<ReturnType<typeof seeded>>;
let s: Seed;

// Seeding simulates every review; give it room when the whole suite runs in parallel.
beforeAll(async () => {
  s = await seeded();
  s.db.close();
  await Dexie.delete('wanistats-sample');
}, 30_000);
afterEach(() => Dexie.delete('wanistats-sample'));

const ms = (iso: string | null) => (iso === null ? NaN : Date.parse(iso));

describe('seedSampleDb', () => {
  test('clears the sample database before filling it, keeping prefs', async () => {
    const db = openDb('wanistats-sample');
    await db.prefs.put({ key: 'stale', value: 1 });
    await db.subjects.put({ ...(await seeded()).subjects[0]!, id: 999_999 });
    await seedSampleDb(db, NOW);
    expect(await db.prefs.get('stale')).toEqual({ key: 'stale', value: 1 });
    expect(await db.subjects.get(999_999)).toBeUndefined();
    db.close();
  });

  test('refuses to touch the live database', async () => {
    const db = openDb('wanistats-u1');
    await expect(seedSampleDb(db, NOW)).rejects.toThrow();
    db.close();
  });

  test('is deterministic apart from now', async () => {
    const shift = 10 * DAY + 3 * HOUR_MS;
    const later = await seeded(NOW + shift);
    later.db.close();
    expect(later.subjects).toEqual(s.subjects);
    expect(later.assignments.map((a) => ms(a.data.available_at) - shift)).toEqual(
      s.assignments.map((a) => ms(a.data.available_at)),
    );
    expect(later.stats.map((r) => r.data)).toEqual(
      s.stats.map((r) => ({
        ...r.data,
        created_at: new Date(ms(r.data.created_at) + shift).toISOString(),
      })),
    );
  });
});

describe('shapes', () => {
  test('every assignment and statistic references a subject of the same type', () => {
    const byId = new Map(s.subjects.map((x) => [x.id, x]));
    for (const r of [...s.assignments, ...s.stats]) {
      expect(byId.get(r.data.subject_id)?.object).toBe(r.data.subject_type);
    }
    expect(new Set(s.assignments.map((a) => a.data.subject_id)).size).toBe(s.assignments.length);
  });

  test('component and amalgamation ids resolve to the right types', () => {
    const byId = new Map(s.subjects.map((x) => [x.id, x]));
    const typeOf = (id: number) => byId.get(id)?.object;
    for (const x of s.subjects) {
      if (x.object === 'kanji') {
        expect(x.data.component_subject_ids.length).toBeGreaterThan(0);
        for (const id of x.data.component_subject_ids) {
          expect(typeOf(id)).toBe('radical');
          expect(byId.get(id)!.data.level).toBeLessThanOrEqual(x.data.level);
        }
        for (const id of x.data.amalgamation_subject_ids) expect(typeOf(id)).toBe('vocabulary');
        for (const id of x.data.visually_similar_subject_ids) expect(typeOf(id)).toBe('kanji');
      }
      if (x.object === 'vocabulary') {
        expect(x.data.component_subject_ids.length).toBeGreaterThan(0);
        for (const id of x.data.component_subject_ids) {
          expect(typeOf(id)).toBe('kanji');
          expect(byId.get(id)!.data.level).toBeLessThanOrEqual(x.data.level);
        }
      }
      if (x.object === 'radical') {
        expect(x.data.amalgamation_subject_ids.length).toBeGreaterThan(0);
        for (const id of x.data.amalgamation_subject_ids) expect(typeOf(id)).toBe('kanji');
      }
    }
  });

  test('carries no proprietary content', () => {
    for (const x of s.subjects) {
      expect(x.data.characters).toBeTruthy();
      expect(x.data.meaning_mnemonic).toBe('');
      if (x.object === 'radical') expect(x.data.character_images).toEqual([]);
      if (x.object === 'kanji') expect(x.data.reading_mnemonic).toBe('');
      if (x.object === 'vocabulary' || x.object === 'kana_vocabulary') {
        expect(x.data.context_sentences).toEqual([]);
        expect(x.data.pronunciation_audios).toEqual([]);
      }
    }
  });

  test('covers every subject type with a few hundred kanji over levels 1 to 14', () => {
    const count = (t: string) => s.subjects.filter((x) => x.object === t).length;
    expect(count('radical')).toBeGreaterThan(60);
    expect(count('kanji')).toBeGreaterThan(250);
    expect(count('vocabulary')).toBeGreaterThan(200);
    expect(count('kana_vocabulary')).toBeGreaterThan(5);
    expect(Math.max(...s.subjects.map((x) => x.data.level))).toBe(14);
  });

  test('levels 1 and 2 use the accelerated system, the rest the normal one', () => {
    expect(s.srs.map((x) => x.id)).toEqual([1, 2]);
    const [normal, accelerated] = s.srs;
    expect(normal!.data.stages[1]).toEqual({
      interval: 14400,
      interval_unit: 'seconds',
      position: 1,
    });
    expect(accelerated!.data.stages[1]!.interval).toBe(7200);
    for (const x of s.subjects) {
      expect(x.data.spaced_repetition_system_id).toBe(x.data.level <= 2 ? 2 : 1);
    }
  });
});

describe('the sample user', () => {
  test('is level 12 with an active subscription and no vacation', () => {
    expect(s.user).toMatchObject({
      username: 'sample',
      level: 12,
      current_vacation_started_at: null,
      subscription: { active: true, max_level_granted: 60 },
    });
    const months = (NOW - ms(s.user!.started_at)) / (30 * DAY);
    expect(months).toBeGreaterThan(10);
    expect(months).toBeLessThan(12);
  });

  test('current level has about 30 kanji, 18 passed, the rest mixed or locked', () => {
    const kanji = s.subjects.filter(
      (x): x is KanjiResource => x.object === 'kanji' && x.data.level === 12,
    );
    const assigned = new Map(s.assignments.map((a) => [a.data.subject_id, a.data]));
    const states = kanji.map((k) => assigned.get(k.id));
    expect(kanji.length).toBe(30);
    expect(states.filter((a) => a?.passed_at).length).toBe(18);
    expect(states.filter((a) => !a).length).toBe(3);
    expect(states.filter((a) => a && !a.started_at).length).toBe(2);
    const inReview = states.filter((a) => a?.started_at && !a.passed_at).map((a) => a!.srs_stage);
    expect(inReview.length).toBe(7);
    expect(new Set(inReview).size).toBeGreaterThan(1);
  });

  test('has assignments in every stage, lessons, and reviews spread over 120 days', () => {
    const stages = new Set(s.assignments.map((a) => a.data.srs_stage));
    expect([...stages].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const lessons = s.assignments.filter((a) => a.data.srs_stage === 0);
    expect(lessons.length).toBeGreaterThan(10);
    for (const a of lessons) expect(a.data.available_at).toBeNull();
    for (const a of s.assignments.filter((x) => x.data.srs_stage === 9)) {
      expect(a.data.burned_at).not.toBeNull();
      expect(a.data.available_at).toBeNull();
    }
    const ahead = s.assignments.map((a) => ms(a.data.available_at) - NOW).filter((d) => d > 0);
    expect(ahead.some((d) => d < DAY)).toBe(true);
    expect(ahead.some((d) => d > 60 * DAY && d < 120 * DAY)).toBe(true);
    for (const a of s.assignments) {
      if (a.data.available_at) expect(ms(a.data.available_at) % HOUR_MS).toBe(0);
    }
  });

  test('has a reset with abandoned progressions, an idle level and one missing progression', () => {
    expect(s.resets).toHaveLength(1);
    const reset = s.resets[0]!.data;
    expect(reset.target_level).toBeLessThan(reset.original_level);
    const abandoned = s.progressions.filter((p) => p.data.abandoned_at);
    expect(abandoned.length).toBeGreaterThan(0);
    for (const p of abandoned) {
      expect(p.data.level).toBeGreaterThanOrEqual(reset.target_level);
      expect(ms(p.data.created_at)).toBeLessThan(ms(reset.confirmed_at));
    }
    const live = s.progressions.filter((p) => !p.data.abandoned_at).map((p) => p.data);
    const levels = live.map((p) => p.level);
    const missing = [...Array(12).keys()].map((i) => i + 1).filter((l) => !levels.includes(l));
    expect(missing).toEqual([3]);
    expect(live.find((p) => p.level === 12)?.passed_at).toBeNull();
    const days = live
      .filter((p) => p.passed_at)
      .map((p) => (ms(p.passed_at) - ms(p.unlocked_at)) / DAY);
    expect(Math.max(...days)).toBeGreaterThan(35);
  });

  test('has a handful of clear leeches that are not burned', () => {
    const assigned = new Map(s.assignments.map((a) => [a.data.subject_id, a.data]));
    const clear = s.stats.filter((r) => {
      const d = r.data;
      const streak =
        d.subject_type === 'radical'
          ? d.meaning_current_streak
          : Math.min(d.meaning_current_streak, d.reading_current_streak);
      const score = (d.meaning_incorrect + d.reading_incorrect) / Math.max(1, streak) ** 1.5;
      return score >= 3 && !assigned.get(d.subject_id)?.burned_at;
    });
    expect(clear.length).toBeGreaterThanOrEqual(5);
    expect(clear.length).toBeLessThan(30);
  });

  test('vocabulary spellings are unique', () => {
    const words = s.subjects.filter((x) => x.object === 'vocabulary').map((x) => x.data.characters);
    expect(new Set(words).size).toBe(words.length);
  });

  test('vocabulary is unlocked only after its kanji pass', () => {
    const assigned = new Map(s.assignments.map((a) => [a.data.subject_id, a.data]));
    for (const v of s.subjects.filter((x): x is VocabularyResource => x.object === 'vocabulary')) {
      const a = assigned.get(v.id);
      if (!a) continue;
      for (const id of v.data.component_subject_ids) {
        expect(ms(assigned.get(id)!.passed_at)).toBeLessThanOrEqual(ms(a.unlocked_at));
      }
    }
  });

  test('radicals have plain characters and the current level adds a few', () => {
    const l12 = s.subjects.filter(
      (x): x is RadicalResource => x.object === 'radical' && x.data.level === 12,
    );
    expect(l12.map((r) => r.data.characters).sort()).toEqual(['癶', '豆', '隹', '頁'].sort());
  });
});

describe('history', () => {
  test('30 days of snapshots with a gap, ending today', () => {
    const dates = s.snapshots.map((x) => x.date);
    expect(dates.at(-1)).toBe('2026-10-03');
    expect(ms(`${dates[0]}T00:00:00Z`)).toBe(Date.UTC(2026, 8, 4));
    const steps = dates.slice(1).map((d, i) => (ms(d) - ms(dates[i]!)) / DAY);
    expect(steps.filter((x) => x > 1)).toEqual([4]);
    expect(steps.every((x) => x >= 1)).toBe(true);
    for (const x of s.snapshots) expect(ms(x.takenAt)).toBeLessThanOrEqual(NOW);
  });

  test('snapshots follow the current state', () => {
    const first = s.snapshots[0]!;
    const last = s.snapshots.at(-1)!;
    expect(last.passedKanji).toBeGreaterThan(first.passedKanji);
    expect(last.level).toBe(12);
    const levels = s.snapshots.map((x) => x.level);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
    expect(first.level).toBeLessThan(11);
    expect(new Set(s.snapshots.map((x) => x.load)).size).toBeGreaterThan(10);
    expect(last.load).toBeGreaterThanOrEqual(110);
    expect(last.load).toBeLessThanOrEqual(140);
    const total = s.stats.reduce((n, r) => n + r.data.meaning_correct, 0);
    expect(last.reviews.meaningCorrect).toBeLessThanOrEqual(total);
    expect(last.reviews.meaningCorrect).toBeGreaterThan(first.reviews.meaningCorrect);
  });

  test('deltas land on snapshot dates after the first and sum to the counter change', () => {
    const dates = new Set(s.snapshots.slice(1).map((x) => x.date));
    for (const d of s.deltas) expect(dates.has(d.date)).toBe(true);
    const first = s.snapshots[0]!;
    const last = s.snapshots.at(-1)!;
    const sum = s.deltas.reduce((n, d) => n + d.readingIncorrect, 0);
    expect(sum).toBe(last.reviews.readingIncorrect - first.reviews.readingIncorrect);
  });

  test('meta and sync state', () => {
    expect(s.meta).toMatchObject({
      onboardingSeen: true,
      firstSnapshotDate: s.snapshots[0]!.date,
      sampleVersion: SAMPLE_VERSION,
    });
    expect(s.syncState).toHaveLength(7);
    for (const row of s.syncState) {
      const ago = NOW - ms(row.lastSyncAt);
      expect(ago).toBeGreaterThan(0);
      expect(ago).toBeLessThan(15 * 60_000);
    }
  });
});
