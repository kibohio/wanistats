import type {
  AssignmentResource,
  KanaVocabularyResource,
  KanjiResource,
  LevelProgressionResource,
  RadicalResource,
  ResetResource,
  ReviewStatisticResource,
  SpacedRepetitionSystemResource,
  SubjectResource,
  User,
  VocabularyResource,
} from '../api/types';
import type {
  CollectionName,
  ReviewCounters,
  Snapshot,
  SnapshotDelta,
  StageCounts,
  WaniStatsDb,
} from '../db/schema';
import { floorHour, HOUR_MS, intervalFor } from '../domain/srs';
import { KANA_VOCAB, KANJI, RADICALS, SIMILAR, VOCAB } from './data';

/** Stored in meta as `sampleVersion`; bump when the generated data changes. */
export const SAMPLE_VERSION = 2;

const API = 'https://api.wanikani.com/v2';
const DAY_MS = 24 * HOUR_MS;
const CREATED = '2024-01-01T00:00:00.000Z';
const CURRENT_LEVEL = 12;

// [level, days before now it was unlocked]. Entries from RESET_AT on follow a reset from 8
// back to 6; level 8 after the reset is the idle one.
const TIMELINE: [number, number][] = [
  [1, 335],
  [2, 328],
  [3, 320],
  [4, 309],
  [5, 297],
  [6, 284],
  [7, 272],
  [8, 258],
  [6, 105],
  [7, 94],
  [8, 82],
  [9, 42],
  [10, 29],
  [11, 18],
  [12, 7],
];
const RESET_AT = 8;
// No progression record, so level timing has to estimate it.
const NO_PROGRESSION = 3;
const SNAPSHOT_DAYS = 30;
const MISSED_SNAPSHOT_DAYS = [13, 12, 11];

// Current-level shape: two kanji keep failing at Apprentice 4, two wait in lessons, and the
// kanji built on 頁 stay locked because that radical keeps failing too.
const FAIL_AT_A4 = new Set(['橋', '歌', '頁']);
const LESSON_LATER = new Set(['登', '発']);
const LEECHES = new Set(['遠', '週', '晴', '決', '働', '験', '洗う', '答える']);

// As /spaced_repetition_systems returns them. The only place intervals are written down.
const SRS_INTERVALS: Record<number, (number | null)[]> = {
  1: [null, 14400, 28800, 82800, 169200, 601200, 1206000, 2588400, 10364400, null],
  2: [null, 7200, 14400, 28800, 82800, 601200, 1206000, 2588400, 10364400, null],
};
const SRS_NAMES: Record<number, string> = { 1: 'Default', 2: 'Accelerated' };

const STAGE_KEYS = ['a1', 'a2', 'a3', 'a4', 'g1', 'g2', 'm', 'e', 'b'] as const;
const COLLECTIONS: CollectionName[] = [
  'user',
  'subjects',
  'assignments',
  'review_statistics',
  'level_progressions',
  'resets',
  'spaced_repetition_systems',
];

type Counters = [
  meaningCorrect: number,
  meaningIncorrect: number,
  readingCorrect: number,
  readingIncorrect: number,
];
interface Event {
  t: number;
  stage: number;
  c: Counters;
}
interface Track {
  subject: SubjectResource;
  unlockedAt: number | null;
  startedAt: number | null;
  passedAt: number | null;
  burnedAt: number | null;
  availableAt: number | null;
  stage: number;
  events: Event[];
  streaks: [meaningCurrent: number, meaningMax: number, readingCurrent: number, readingMax: number];
}

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rows = (table: string) => table.trim().split('\n');
const iso = (ms: number) => new Date(ms).toISOString();
const isoOrNull = (ms: number | null) => (ms === null ? null : iso(ms));
const pad = (n: number) => String(n).padStart(2, '0');
const localDate = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

function buildSubjects(): SubjectResource[] {
  const radicalMeaning = new Map(
    rows(RADICALS).map((r) => [r.slice(0, r.indexOf(' ')), r.slice(r.indexOf(' ') + 1)]),
  );
  let level = 1;
  const kanjiRows = rows(KANJI).flatMap((r) => {
    if (r.startsWith('#')) {
      level = Number(r.slice(1));
      return [];
    }
    const [chars, meanings, on, kun, comps] = r.split('|') as [
      string,
      string,
      string,
      string,
      string,
    ];
    return [{ chars, level, meanings, on, kun, comps: comps ? [...comps] : [chars] }];
  });
  // A radical sits at the first level that uses it, so components never come after compounds.
  const radicalLevel = new Map<string, number>();
  for (const k of kanjiRows)
    for (const c of k.comps) if (!radicalLevel.has(c)) radicalLevel.set(c, k.level);
  const kanjiLevel = new Map(kanjiRows.map((k) => [k.chars, k.level]));
  const vocabRows = rows(VOCAB)
    .map((r) => {
      const [chars, reading, meanings] = r.split('|') as [string, string, string];
      const kanji = [...new Set([...chars].filter((c) => /\p{Script=Han}/u.test(c)))];
      const lvl = Math.max(...kanji.map((c) => kanjiLevel.get(c) ?? NaN));
      if (Number.isNaN(lvl)) throw new Error(`Unknown kanji in ${chars}`);
      return { chars, reading, meanings, kanji, level: lvl };
    })
    .sort((a, b) => a.level - b.level);

  let id = 0;
  const position = new Map<number, number>();
  const common = (lvl: number, chars: string, meanings: string, slug: string, path: string) => {
    position.set(lvl, (position.get(lvl) ?? -1) + 1);
    return {
      auxiliary_meanings: [],
      characters: chars,
      created_at: CREATED,
      document_url: `https://www.wanikani.com/${path}/${slug}`,
      hidden_at: null,
      lesson_position: position.get(lvl)!,
      level: lvl,
      meaning_mnemonic: '',
      meanings: meanings
        .split('/')
        .map((meaning, i) => ({ meaning, primary: i === 0, accepted_answer: true })),
      slug,
      spaced_repetition_system_id: lvl <= 2 ? 2 : 1,
    };
  };
  const wrap = <O extends string, D>(object: O, data: D) => ({
    id: ++id,
    object,
    url: `${API}/subjects/${id}`,
    data_updated_at: CREATED,
    data,
  });

  const radicals = new Map<string, RadicalResource>();
  for (const [chars, lvl] of radicalLevel) {
    const meaning = radicalMeaning.get(chars);
    if (!meaning) throw new Error(`No radical meaning for ${chars}`);
    const slug = meaning.replace(/[^a-z]+/g, '-').replace(/-$/, '');
    radicals.set(
      chars,
      wrap('radical', {
        ...common(lvl, chars, meaning, slug, 'radicals'),
        amalgamation_subject_ids: [],
        character_images: [],
      }),
    );
  }
  const kanji = new Map<string, KanjiResource>();
  for (const k of kanjiRows) {
    const readings = [
      ...(k.on ? [{ reading: k.on, type: 'onyomi' as const }] : []),
      ...(k.kun ? [{ reading: k.kun, type: 'kunyomi' as const }] : []),
    ].map((r, i) => ({ ...r, primary: i === 0, accepted_answer: i === 0 }));
    const res: KanjiResource = wrap('kanji', {
      ...common(k.level, k.chars, k.meanings, k.chars, 'kanji'),
      amalgamation_subject_ids: [],
      component_subject_ids: k.comps.map((c) => radicals.get(c)!.id),
      meaning_hint: null,
      reading_hint: null,
      reading_mnemonic: '',
      readings,
      visually_similar_subject_ids: [],
    });
    for (const c of k.comps) radicals.get(c)!.data.amalgamation_subject_ids.push(res.id);
    kanji.set(k.chars, res);
  }
  for (const pair of SIMILAR.split(' ')) {
    const [a, b] = [...pair].map((c) => kanji.get(c)!);
    a!.data.visually_similar_subject_ids.push(b!.id);
    b!.data.visually_similar_subject_ids.push(a!.id);
  }
  const vocab = vocabRows.map((v): VocabularyResource => {
    const res: VocabularyResource = wrap('vocabulary', {
      ...common(v.level, v.chars, v.meanings, v.chars, 'vocabulary'),
      component_subject_ids: v.kanji.map((c) => kanji.get(c)!.id),
      context_sentences: [],
      parts_of_speech: v.meanings.startsWith('to ')
        ? ['verb']
        : v.chars.endsWith('い') && v.reading.endsWith('い')
          ? ['い adjective']
          : ['noun'],
      pronunciation_audios: [],
      reading_mnemonic: '',
      readings: [{ reading: v.reading, primary: true, accepted_answer: true }],
    });
    for (const c of v.kanji) kanji.get(c)!.data.amalgamation_subject_ids.push(res.id);
    return res;
  });
  const kana = rows(KANA_VOCAB).map((r): KanaVocabularyResource => {
    const [chars, meaning, lvl] = r.split('|') as [string, string, string];
    return wrap('kana_vocabulary', {
      ...common(Number(lvl), chars, meaning, chars, 'vocabulary'),
      context_sentences: [],
      parts_of_speech: ['expression'],
      pronunciation_audios: [],
    });
  });
  return [...radicals.values(), ...kanji.values(), ...vocab, ...kana];
}

export async function seedSampleDb(db: WaniStatsDb, now: number): Promise<void> {
  // Clearing the wrong database would delete a real user's synced data and history.
  if (db.name !== 'wanistats-sample') throw new Error(`Refusing to seed ${db.name}`);

  const rand = mulberry32(20170710);
  const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
  const base = floorHour(now);

  const levelTimes = TIMELINE.map(
    ([, days], i) =>
      base - days * DAY_MS - (i < TIMELINE.length - 1 ? Math.floor(between(0, 10)) * HOUR_MS : 0),
  );
  const resetAt = levelTimes[RESET_AT]! - 5 * 60_000;
  const levelStart = new Map(TIMELINE.map(([level], i) => [level, levelTimes[i]!]));

  const srsSystems: SpacedRepetitionSystemResource[] = [1, 2].map((id) => ({
    id,
    object: 'spaced_repetition_system',
    url: `${API}/spaced_repetition_systems/${id}`,
    data_updated_at: CREATED,
    data: {
      burning_stage_position: 9,
      created_at: CREATED,
      description: `${SRS_NAMES[id]} intervals`,
      name: `${SRS_NAMES[id]} system`,
      passing_stage_position: 5,
      stages: SRS_INTERVALS[id]!.map((interval, position) => ({
        interval,
        interval_unit: interval === null ? null : 'seconds',
        position,
      })),
      starting_stage_position: 1,
      unlocking_stage_position: 0,
    },
  }));
  const systems = new Map(srsSystems.map((s) => [s.id, s.data]));

  const subjects = buildSubjects();
  const tracks = new Map<number, Track>();

  for (const subject of subjects) {
    const { level, characters: chars } = subject.data;
    const deps =
      subject.object === 'kanji' || subject.object === 'vocabulary'
        ? subject.data.component_subject_ids
        : [];
    const depPassed = deps.map((d) => tracks.get(d)?.passedAt ?? null);
    const unlockedAt =
      level > CURRENT_LEVEL || depPassed.includes(null)
        ? null
        : Math.max(levelStart.get(level)!, ...(depPassed as number[]));
    const track: Track = {
      subject,
      unlockedAt: unlockedAt !== null && unlockedAt <= now ? unlockedAt : null,
      startedAt: null,
      passedAt: null,
      burnedAt: null,
      availableAt: null,
      stage: 0,
      events: [],
      streaks: [0, 0, 0, 0],
    };
    tracks.set(subject.id, track);
    if (track.unlockedAt === null) continue;

    // Perfect answers keep the current level's earliest level-up shape fixed.
    const current =
      level === CURRENT_LEVEL && (subject.object === 'radical' || subject.object === 'kanji');
    const leech = LEECHES.has(chars!);
    const hasReading = subject.object === 'kanji' || subject.object === 'vocabulary';
    const pMeaning = current ? 1 : leech ? 0.7 : between(0.94, 0.995);
    const pReading = current ? 1 : leech ? 0.5 : between(0.88, 0.98);
    // Kanji lessons wait long enough that current-level kanji behind fresh radicals cannot pass yet.
    const lag =
      subject.object === 'radical'
        ? between(0.5, 6)
        : subject.object === 'kanji'
          ? LESSON_LATER.has(chars!)
            ? Infinity
            : between(10, 16)
          : 4 + rand() ** 2 * 85;
    const startedAt = track.unlockedAt + lag * HOUR_MS;
    if (startedAt > now) continue;

    const system = systems.get(subject.data.spaced_repetition_system_id)!;
    const c: Counters = [0, 0, 0, 0];
    const s = track.streaks;
    track.startedAt = startedAt;
    track.stage = 1;
    track.events.push({ t: startedAt, stage: 1, c: [...c] });
    track.availableAt = floorHour(startedAt + intervalFor(system, 1) * HOUR_MS);
    for (;;) {
      const t = track.availableAt + between(1, 10) * HOUR_MS;
      if (t > now) break;
      const forcedMiss = FAIL_AT_A4.has(chars!) && track.stage === 4;
      const meaningOk = rand() < pMeaning && !(forcedMiss && !hasReading);
      const readingOk = !hasReading || (rand() < pReading && !forcedMiss);
      c[meaningOk ? 0 : 1]++;
      s[0] = meaningOk ? s[0] + 1 : 0;
      s[1] = Math.max(s[1], s[0]);
      if (hasReading) {
        c[readingOk ? 2 : 3]++;
        s[2] = readingOk ? s[2] + 1 : 0;
        s[3] = Math.max(s[3], s[2]);
      }
      track.stage =
        meaningOk && readingOk
          ? track.stage + 1
          : Math.max(1, track.stage - (track.stage >= 5 ? 2 : 1));
      track.events.push({ t, stage: track.stage, c: [...c] });
      if (track.stage >= 5 && track.passedAt === null) track.passedAt = t;
      if (track.stage === 9) {
        track.burnedAt = t;
        track.availableAt = null;
        break;
      }
      track.availableAt = floorHour(t + intervalFor(system, track.stage) * HOUR_MS);
    }
  }

  const started = [...tracks.values()].filter((t) => t.unlockedAt !== null);
  const lastChange = (t: Track) => iso(t.events.at(-1)?.t ?? t.unlockedAt!);

  const assignments: AssignmentResource[] = started.map((t, i) => ({
    id: 1000 + i,
    object: 'assignment',
    url: `${API}/assignments/${1000 + i}`,
    data_updated_at: lastChange(t),
    data: {
      available_at: isoOrNull(t.availableAt),
      burned_at: isoOrNull(t.burnedAt),
      created_at: iso(t.unlockedAt!),
      hidden: false,
      passed_at: isoOrNull(t.passedAt),
      resurrected_at: null,
      srs_stage: t.stage,
      started_at: isoOrNull(t.startedAt),
      subject_id: t.subject.id,
      subject_type: t.subject.object,
      unlocked_at: iso(t.unlockedAt!),
    },
  }));

  const reviewStatistics: ReviewStatisticResource[] = started
    .filter((t) => t.startedAt !== null)
    .map((t, i) => {
      const [mc, mi, rc, ri] = t.events.at(-1)!.c;
      const answers = mc + mi + rc + ri;
      return {
        id: 5000 + i,
        object: 'review_statistic',
        url: `${API}/review_statistics/${5000 + i}`,
        data_updated_at: lastChange(t),
        data: {
          created_at: iso(t.startedAt!),
          hidden: false,
          meaning_correct: mc,
          meaning_current_streak: t.streaks[0],
          meaning_incorrect: mi,
          meaning_max_streak: t.streaks[1],
          percentage_correct: answers ? Math.round((100 * (mc + rc)) / answers) : 100,
          reading_correct: rc,
          reading_current_streak: t.streaks[2],
          reading_incorrect: ri,
          reading_max_streak: t.streaks[3],
          subject_id: t.subject.id,
          subject_type: t.subject.object,
        },
      };
    });

  const levelProgressions: LevelProgressionResource[] = TIMELINE.flatMap(([level], i) => {
    if (level === NO_PROGRESSION) return [];
    const abandoned = i < RESET_AT && level >= TIMELINE[RESET_AT]![0];
    const passedAt = i === RESET_AT - 1 || i === TIMELINE.length - 1 ? null : levelTimes[i + 1]!;
    const own = abandoned ? [] : started.filter((t) => t.subject.data.level === level);
    const firstLesson = Math.min(
      ...own.flatMap((t) => (t.startedAt === null ? [] : [t.startedAt])),
    );
    const all = subjects.filter((s) => s.data.level === level).map((s) => tracks.get(s.id)!);
    const completedAt = all.every((t) => t.burnedAt !== null)
      ? Math.max(...all.map((t) => t.burnedAt!))
      : null;
    return [
      {
        abandoned_at: abandoned ? iso(resetAt) : null,
        completed_at: isoOrNull(completedAt),
        created_at: iso(levelTimes[i]!),
        level,
        passed_at: isoOrNull(passedAt),
        started_at: iso(Number.isFinite(firstLesson) ? firstLesson : levelTimes[i]! + 2 * HOUR_MS),
        unlocked_at: iso(levelTimes[i]!),
      },
    ];
  }).map((data, i) => ({
    id: 100 + i,
    object: 'level_progression' as const,
    url: `${API}/level_progressions/${100 + i}`,
    data_updated_at: data.abandoned_at ?? data.passed_at ?? data.started_at,
    data,
  }));

  const resets: ResetResource[] = [
    {
      id: 1,
      object: 'reset',
      url: `${API}/resets/1`,
      data_updated_at: iso(resetAt),
      data: {
        confirmed_at: iso(resetAt),
        created_at: iso(resetAt - 20 * 60_000),
        original_level: TIMELINE[RESET_AT - 1]![0],
        target_level: TIMELINE[RESET_AT]![0],
      },
    },
  ];

  const user: User = {
    id: '5a6a5234-a392-4a87-8f3f-33342afe8a42',
    username: 'sample',
    level: CURRENT_LEVEL,
    profile_url: 'https://www.wanikani.com/users/sample',
    started_at: iso(levelTimes[0]! - 3 * HOUR_MS),
    current_vacation_started_at: null,
    subscription: {
      active: true,
      type: 'recurring',
      max_level_granted: 60,
      period_ends_at: iso(base + 19 * DAY_MS),
    },
    preferences: {
      default_voice_actor_id: 1,
      extra_study_autoplay_audio: false,
      lessons_autoplay_audio: false,
      lessons_batch_size: 5,
      lessons_presentation_order: 'ascending_level_then_subject',
      reviews_autoplay_audio: false,
      reviews_display_srs_indicator: true,
      reviews_presentation_order: 'shuffled',
    },
  };

  // Snapshots replay the simulated history, so they agree with the current state.
  const stateAt = (t: Track, at: number) => {
    let last: Event | undefined;
    for (const e of t.events) if (e.t <= at) last = e;
    return last ?? { t: 0, stage: 0, c: [0, 0, 0, 0] as Counters };
  };
  const snapshots: Snapshot[] = [];
  const snapshotDeltas: SnapshotDelta[] = [];
  let previous: Map<number, Counters> | null = null;
  for (let daysAgo = SNAPSHOT_DAYS - 1; daysAgo >= 0; daysAgo--) {
    if (MISSED_SNAPSHOT_DAYS.includes(daysAgo)) continue;
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - daysAgo);
    const dayStart = day.getTime();
    const at = Math.max(dayStart, Math.min(dayStart + between(7, 21) * HOUR_MS, now - 5 * 60_000));
    const date = localDate(dayStart);

    const stages = Object.fromEntries(STAGE_KEYS.map((k) => [k, 0])) as unknown as StageCounts;
    const reviews: ReviewCounters = {
      meaningCorrect: 0,
      meaningIncorrect: 0,
      readingCorrect: 0,
      readingIncorrect: 0,
    };
    const counters = new Map<number, Counters>();
    let lessonsAvailable = 0;
    let passedKanji = 0;
    let passedVocab = 0;
    for (const t of started) {
      const { stage, c } = stateAt(t, at);
      if (t.unlockedAt! <= at && stage === 0) lessonsAvailable++;
      if (stage > 0) stages[STAGE_KEYS[stage - 1]!]++;
      if (t.passedAt !== null && t.passedAt <= at) {
        if (t.subject.object === 'kanji') passedKanji++;
        else if (t.subject.object !== 'radical') passedVocab++;
      }
      reviews.meaningCorrect += c[0];
      reviews.meaningIncorrect += c[1];
      reviews.readingCorrect += c[2];
      reviews.readingIncorrect += c[3];
      counters.set(t.subject.id, c);
      const prev = previous?.get(t.subject.id);
      if (prev && c.some((n, i) => n !== prev[i])) {
        snapshotDeltas.push({
          date,
          subjectId: t.subject.id,
          meaningCorrect: c[0] - prev[0],
          meaningIncorrect: c[1] - prev[1],
          readingCorrect: c[2] - prev[2],
          readingIncorrect: c[3] - prev[3],
        });
      }
    }
    previous = counters;
    const apprentice = stages.a1 + stages.a2 + stages.a3 + stages.a4;
    snapshots.push({
      date,
      takenAt: iso(at),
      stages,
      load: Math.round((apprentice + (stages.g1 + stages.g2) / 10) * 10) / 10,
      lessonsAvailable,
      reviews,
      passedKanji,
      passedVocab,
      level: TIMELINE[levelTimes.findLastIndex((t) => t <= at)]![0],
    });
  }

  const synced = now - 4 * 60_000;
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
    await Promise.all([
      db.subjects.bulkPut(subjects),
      db.assignments.bulkPut(assignments),
      db.reviewStatistics.bulkPut(reviewStatistics),
      db.levelProgressions.bulkPut(levelProgressions),
      db.resets.bulkPut(resets),
      db.srsSystems.bulkPut(srsSystems),
      db.user.put(user, 'me'),
      db.snapshots.bulkPut(snapshots),
      db.snapshotDeltas.bulkPut(snapshotDeltas),
      db.syncState.bulkPut(
        COLLECTIONS.map((collection) => ({
          collection,
          lastUpdatedAt: iso(synced - 60_000),
          lastSyncAt: iso(synced),
        })),
      ),
      db.meta.bulkPut([
        { key: 'onboardingSeen', value: true },
        { key: 'firstSnapshotDate', value: snapshots[0]!.date },
        { key: 'sampleVersion', value: SAMPLE_VERSION },
        {
          key: 'snapshotBaseline',
          value: Object.fromEntries(
            [...previous!].map(
              ([id, [meaningCorrect, meaningIncorrect, readingCorrect, readingIncorrect]]) => [
                id,
                { meaningCorrect, meaningIncorrect, readingCorrect, readingIncorrect },
              ],
            ),
          ),
        },
      ]),
    ]);
  });
}
