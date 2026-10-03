/// <reference lib="dom" />
import { expect, type BrowserContext, type Page } from '@playwright/test';
import type {
  Assignment,
  Collection,
  LevelProgression,
  ReviewStatistic,
  SpacedRepetitionSystem,
  SubjectType,
  User,
  UserReport,
} from '../src/api/types';

/** Fake; never a real WaniKani token. */
export const TOKEN = 'e2e-fake-token';
const API = 'https://api.wanikani.com/v2';
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();

function resource<D>(object: string, id: number, data: D) {
  return { id, object, url: `${API}/${object}s/${id}`, data_updated_at: iso(HOUR), data };
}

function collection<R>(path: string, data: R[]): Collection<R> {
  return {
    object: 'collection',
    url: `${API}/${path}`,
    pages: { per_page: 500, next_url: null, previous_url: null },
    total_count: data.length,
    data_updated_at: data.length ? iso(HOUR) : null,
    data,
  };
}

const user: User = {
  id: 'e2e-user',
  username: 'tester',
  level: 1,
  profile_url: 'https://www.wanikani.com/users/tester',
  started_at: iso(10 * DAY),
  current_vacation_started_at: null,
  subscription: { active: false, type: 'free', max_level_granted: 3, period_ends_at: null },
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

// WaniKani's real intervals in seconds; levels 1-2 use the accelerated system (id 2).
function srs(id: number, name: string, seconds: number[]) {
  const stages = [null, ...seconds, null].map((interval, position) => ({
    interval,
    interval_unit: interval === null ? null : ('seconds' as const),
    position,
  }));
  const data: SpacedRepetitionSystem = {
    burning_stage_position: 9,
    created_at: '2020-01-01T00:00:00.000000Z',
    description: name,
    name,
    passing_stage_position: 5,
    stages,
    starting_stage_position: 1,
    unlocking_stage_position: 0,
  };
  return resource('spaced_repetition_system', id, data);
}
const LATE = [604_800, 1_209_600, 2_592_000, 10_368_000];

// [id, type, level, characters, meaning, srs stage (null = locked), correct, incorrect]
const SUBJECTS: [number, SubjectType, number, string, string, number | null, number, number][] = [
  [1, 'radical', 1, '一', 'Ground', 5, 4, 0],
  [2, 'radical', 1, '大', 'Big', 5, 4, 1],
  [440, 'kanji', 1, '一', 'One', 4, 3, 1],
  [449, 'kanji', 1, '大', 'Big', 2, 1, 2],
  [2467, 'vocabulary', 1, '一', 'One', 1, 0, 0],
  [460, 'kanji', 2, '口', 'Mouth', null, 0, 0],
];

function subject([id, type, level, characters, meaning]: (typeof SUBJECTS)[number]) {
  const kanjiish = type !== 'radical';
  return resource(type, id, {
    auxiliary_meanings: [],
    characters,
    created_at: '2020-01-01T00:00:00.000000Z',
    document_url: `https://www.wanikani.com/${type}/${encodeURIComponent(characters)}`,
    hidden_at: null,
    lesson_position: id,
    level,
    meaning_mnemonic: '',
    meanings: [{ meaning, primary: true, accepted_answer: true }],
    slug: characters,
    spaced_repetition_system_id: 2,
    amalgamation_subject_ids: [],
    component_subject_ids: [],
    character_images: [],
    ...(kanjiish && {
      readings: [{ reading: 'いち', primary: true, accepted_answer: true, type: 'onyomi' }],
      reading_mnemonic: '',
      meaning_hint: null,
      reading_hint: null,
      visually_similar_subject_ids: [],
      context_sentences: [],
      parts_of_speech: [],
      pronunciation_audios: [],
    }),
  });
}

function assignment([id, type, , , , stage]: (typeof SUBJECTS)[number]) {
  const data: Assignment = {
    available_at: iso(-2 * HOUR),
    burned_at: null,
    created_at: iso(3 * DAY),
    hidden: false,
    passed_at: stage! >= 5 ? iso(DAY) : null,
    resurrected_at: null,
    srs_stage: stage!,
    started_at: iso(3 * DAY),
    subject_id: id,
    subject_type: type,
    unlocked_at: iso(3 * DAY),
  };
  return resource('assignment', id + 10_000, data);
}

function reviewStatistic([id, type, , , , , correct, incorrect]: (typeof SUBJECTS)[number]) {
  const data: ReviewStatistic = {
    created_at: iso(3 * DAY),
    hidden: false,
    meaning_correct: correct,
    meaning_current_streak: correct,
    meaning_incorrect: incorrect,
    meaning_max_streak: correct,
    percentage_correct: Math.round((100 * correct) / Math.max(1, correct + incorrect)),
    reading_correct: type === 'radical' ? 0 : correct,
    reading_current_streak: type === 'radical' ? 0 : correct,
    reading_incorrect: type === 'radical' ? 0 : incorrect,
    reading_max_streak: type === 'radical' ? 0 : correct,
    subject_id: id,
    subject_type: type,
  };
  return resource('review_statistic', id + 20_000, data);
}

const progression: LevelProgression = {
  abandoned_at: null,
  completed_at: null,
  created_at: iso(3 * DAY),
  level: 1,
  passed_at: null,
  started_at: iso(3 * DAY),
  unlocked_at: iso(3 * DAY),
};

const started = SUBJECTS.filter((s) => s[5] !== null);
const RESPONSES: Record<string, unknown> = {
  user: {
    object: 'user',
    url: `${API}/user`,
    data_updated_at: iso(HOUR),
    data: user,
  } satisfies UserReport,
  subjects: collection('subjects', SUBJECTS.map(subject)),
  assignments: collection('assignments', started.map(assignment)),
  review_statistics: collection(
    'review_statistics',
    started.filter((s) => s[2] === 1).map(reviewStatistic),
  ),
  level_progressions: collection('level_progressions', [
    resource('level_progression', 1, progression),
  ]),
  resets: collection('resets', []),
  spaced_repetition_systems: collection('spaced_repetition_systems', [
    srs(1, 'Default system for dictionary subjects', [14_400, 28_800, 82_800, 169_200, ...LATE]),
    srs(2, 'Accelerated system for dictionary subjects', [7_200, 14_400, 28_800, 82_800, ...LATE]),
  ]),
};

/**
 * Serves the fixture for every WaniKani API call; any other token gets a 401. context.route
 * rather than page.route so requests that pass through the service worker are caught too.
 */
export async function mockApi(context: BrowserContext) {
  await context.route(`${API}/**`, (route) => {
    const req = route.request();
    const headers = { 'Access-Control-Allow-Origin': '*' };
    if (req.headers().authorization !== `Bearer ${TOKEN}`) {
      return route.fulfill({ status: 401, headers, json: { error: 'Unauthorized', code: 401 } });
    }
    const body = RESPONSES[new URL(req.url()).pathname.replace('/v2/', '')];
    return body
      ? route.fulfill({ headers, json: body })
      : route.fulfill({ status: 404, headers, json: { error: 'Not found', code: 404 } });
  });
}

export async function login(page: Page, token = TOKEN) {
  await page.goto('/login');
  await page.getByLabel('Personal access token').fill(token);
  await page.getByRole('button', { name: 'Connect' }).click();
}

/** Logs in with the fixture account and leaves onboarding for Today. */
export async function loginToToday(page: Page) {
  await login(page);
  await expect(page).toHaveURL(/\/welcome$/);
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page).toHaveURL(/\/$/);
}

export async function openAccountMenu(page: Page) {
  await page.getByRole('button', { name: 'Account and settings' }).click();
  return page.getByRole('dialog', { name: 'Account' });
}

/** The fixture account's database. */
export const ACCOUNT_DB = `wanistats-${user.id}`;

/** Every row of a table, read straight from IndexedDB; the fixture account's by default. */
export function readTable<T = unknown>(page: Page, table: string, db = ACCOUNT_DB): Promise<T[]> {
  return page.evaluate(
    ([table, name]) =>
      new Promise<T[]>((resolve, reject) => {
        const open = indexedDB.open(name);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains(table)) return resolve([]);
          const req = db.transaction(table).objectStore(table).getAll();
          req.onsuccess = () => resolve(req.result as T[]);
          req.onerror = () => reject(req.error);
          db.close();
        };
      }),
    [table, db] as const,
  );
}
