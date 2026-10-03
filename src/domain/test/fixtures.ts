import type {
  Assignment,
  AssignmentResource,
  KanjiResource,
  LevelProgression,
  LevelProgressionResource,
  RadicalResource,
  ResetResource,
  Resource,
  SpacedRepetitionSystemResource,
  SubjectResource,
  User,
  VocabularyResource,
} from '../../api/types';
import { HOUR_MS } from '../srs';

export const DAY_MS = 24 * HOUR_MS;
/** 2026-01-01T00:00Z, a convenient origin for hand-made timelines. */
export const T0 = Date.UTC(2026, 0, 1);
export const iso = (ms: number) => new Date(ms).toISOString();

let nextId = 1_000_000;
const resource = <O extends string, D>(object: O, data: D, id = nextId++): Resource<O, D> => ({
  id,
  object,
  url: '',
  data_updated_at: null,
  data,
});

function srs(id: number, hours: number[]): SpacedRepetitionSystemResource {
  return resource(
    'spaced_repetition_system',
    {
      name: id === 1 ? 'Default system for dictionary' : 'Default system for kana',
      description: '',
      created_at: iso(T0),
      unlocking_stage_position: 0,
      starting_stage_position: 1,
      passing_stage_position: 5,
      burning_stage_position: 9,
      stages: [
        { interval: null, interval_unit: null, position: 0 },
        ...hours.map((h, i) => ({
          interval: h * 3600,
          interval_unit: 'seconds' as const,
          position: i + 1,
        })),
        { interval: null, interval_unit: null, position: 9 },
      ],
    },
    id,
  );
}

// WaniKani's two systems, with intervals in seconds as the API returns them.
export const NORMAL = srs(1, [4, 8, 23, 47, 167, 335, 719, 2879]);
export const ACCELERATED = srs(2, [2, 4, 8, 23, 167, 335, 719, 2879]);
export const SYSTEMS = [NORMAL, ACCELERATED];

interface SubjectOpts {
  hidden?: boolean;
  /** Defaults to the accelerated system for radicals and kanji at levels 1 and 2, as on WaniKani. */
  srs?: number;
}

function base(id: number, level: number, accelerable: boolean, opts: SubjectOpts) {
  return {
    auxiliary_meanings: [],
    characters: String(id),
    created_at: iso(T0),
    document_url: '',
    hidden_at: opts.hidden ? iso(T0) : null,
    lesson_position: 0,
    level,
    meaning_mnemonic: '',
    meanings: [],
    slug: String(id),
    spaced_repetition_system_id: opts.srs ?? (accelerable && level <= 2 ? 2 : 1),
  };
}

export const radical = (id: number, level: number, opts: SubjectOpts = {}): RadicalResource =>
  resource(
    'radical',
    { ...base(id, level, true, opts), amalgamation_subject_ids: [], character_images: [] },
    id,
  );

export const kanji = (
  id: number,
  level: number,
  components: number[] = [],
  opts: SubjectOpts = {},
): KanjiResource =>
  resource(
    'kanji',
    {
      ...base(id, level, true, opts),
      amalgamation_subject_ids: [],
      component_subject_ids: components,
      meaning_hint: null,
      reading_hint: null,
      reading_mnemonic: '',
      readings: [],
      visually_similar_subject_ids: [],
    },
    id,
  );

export const vocab = (
  id: number,
  level: number,
  components: number[] = [],
  opts: SubjectOpts = {},
): VocabularyResource =>
  resource(
    'vocabulary',
    {
      ...base(id, level, false, opts),
      component_subject_ids: components,
      context_sentences: [],
      parts_of_speech: [],
      pronunciation_audios: [],
      reading_mnemonic: '',
      readings: [],
    },
    id,
  );

/** Timestamps take ms and are converted to ISO strings. Defaults: unlocked at T0, in lessons. */
export function assignment(
  subject: SubjectResource,
  a: {
    stage?: number;
    unlockedAt?: number | null;
    availableAt?: number | null;
    passedAt?: number | null;
    burnedAt?: number | null;
  } = {},
  extra: Partial<Assignment> = {},
): AssignmentResource {
  const t = (ms: number | null | undefined) => (ms == null ? null : iso(ms));
  return resource('assignment', {
    available_at: t(a.availableAt),
    burned_at: t(a.burnedAt),
    created_at: iso(a.unlockedAt ?? T0),
    hidden: false,
    passed_at: t(a.passedAt),
    resurrected_at: null,
    srs_stage: a.stage ?? 0,
    started_at: a.stage ? iso(a.unlockedAt ?? T0) : null,
    subject_id: subject.id,
    subject_type: subject.object,
    unlocked_at: a.unlockedAt === null ? null : iso(a.unlockedAt ?? T0),
    ...extra,
  });
}

export function progression(
  level: number,
  unlockedAt: number,
  passedAt: number | null = null,
  extra: Partial<LevelProgression> = {},
): LevelProgressionResource {
  return resource('level_progression', {
    abandoned_at: null,
    completed_at: null,
    created_at: iso(unlockedAt),
    level,
    passed_at: passedAt === null ? null : iso(passedAt),
    started_at: iso(unlockedAt),
    unlocked_at: iso(unlockedAt),
    ...extra,
  });
}

export const reset = (
  originalLevel: number,
  targetLevel: number,
  confirmedAt: number | null,
): ResetResource =>
  resource('reset', {
    confirmed_at: confirmedAt === null ? null : iso(confirmedAt),
    created_at: iso(confirmedAt ?? T0),
    original_level: originalLevel,
    target_level: targetLevel,
  });

export function user(level: number, extra: Partial<User> = {}): User {
  return {
    id: 'u1',
    username: 'tester',
    level,
    profile_url: '',
    started_at: iso(T0),
    current_vacation_started_at: null,
    subscription: { active: true, type: 'lifetime', max_level_granted: 60, period_ends_at: null },
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
    ...extra,
  };
}
