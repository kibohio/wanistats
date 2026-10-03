// WaniKani API v2, revision 20170710. Timestamps are ISO 8601 strings.

export type SubjectType = 'radical' | 'kanji' | 'vocabulary' | 'kana_vocabulary';

export interface Resource<O extends string, D> {
  id: number;
  object: O;
  url: string;
  data_updated_at: string | null;
  data: D;
}

export interface Collection<R> {
  object: 'collection';
  url: string;
  pages: { per_page: number; next_url: string | null; previous_url: string | null };
  total_count: number;
  data_updated_at: string | null;
  data: R[];
}

export interface ApiError {
  error: string;
  code: number;
}

// /user

export interface User {
  id: string;
  username: string;
  level: number;
  profile_url: string;
  started_at: string;
  current_vacation_started_at: string | null;
  subscription: {
    active: boolean;
    type: 'free' | 'recurring' | 'lifetime' | 'unknown';
    max_level_granted: number;
    period_ends_at: string | null;
  };
  preferences: {
    default_voice_actor_id: number;
    extra_study_autoplay_audio: boolean;
    lessons_autoplay_audio: boolean;
    lessons_batch_size: number;
    lessons_presentation_order: string;
    reviews_autoplay_audio: boolean;
    reviews_display_srs_indicator: boolean;
    reviews_presentation_order: string;
  };
}

/** /user returns a report: no top-level id. */
export interface UserReport {
  object: 'user';
  url: string;
  data_updated_at: string;
  data: User;
}

// /subjects

export interface Meaning {
  meaning: string;
  primary: boolean;
  accepted_answer: boolean;
}

export interface AuxiliaryMeaning {
  meaning: string;
  type: 'whitelist' | 'blacklist';
}

export interface KanjiReading {
  reading: string;
  primary: boolean;
  accepted_answer: boolean;
  type: 'kunyomi' | 'onyomi' | 'nanori';
}

export interface VocabularyReading {
  reading: string;
  primary: boolean;
  accepted_answer: boolean;
}

export interface CharacterImage {
  url: string;
  content_type: 'image/svg+xml' | 'image/png';
  metadata: {
    inline_styles?: boolean;
    color?: string;
    dimensions?: string;
    style_name?: string;
  };
}

export interface PronunciationAudio {
  url: string;
  content_type: string;
  metadata: {
    gender: string;
    source_id: number;
    pronunciation: string;
    voice_actor_id: number;
    voice_actor_name: string;
    voice_description: string;
  };
}

export interface ContextSentence {
  en: string;
  ja: string;
}

interface SubjectBase {
  auxiliary_meanings: AuxiliaryMeaning[];
  /** Null for radicals that only exist as images. */
  characters: string | null;
  created_at: string;
  document_url: string;
  hidden_at: string | null;
  lesson_position: number;
  level: number;
  meaning_mnemonic: string;
  meanings: Meaning[];
  slug: string;
  spaced_repetition_system_id: number;
}

export interface Radical extends SubjectBase {
  amalgamation_subject_ids: number[];
  character_images: CharacterImage[];
}

export interface Kanji extends SubjectBase {
  amalgamation_subject_ids: number[];
  component_subject_ids: number[];
  meaning_hint: string | null;
  reading_hint: string | null;
  reading_mnemonic: string;
  readings: KanjiReading[];
  visually_similar_subject_ids: number[];
}

export interface Vocabulary extends SubjectBase {
  component_subject_ids: number[];
  context_sentences: ContextSentence[];
  parts_of_speech: string[];
  pronunciation_audios: PronunciationAudio[];
  reading_mnemonic: string;
  readings: VocabularyReading[];
}

export interface KanaVocabulary extends SubjectBase {
  context_sentences: ContextSentence[];
  parts_of_speech: string[];
  pronunciation_audios: PronunciationAudio[];
}

export type RadicalResource = Resource<'radical', Radical>;
export type KanjiResource = Resource<'kanji', Kanji>;
export type VocabularyResource = Resource<'vocabulary', Vocabulary>;
export type KanaVocabularyResource = Resource<'kana_vocabulary', KanaVocabulary>;
/** Discriminated by `object`. */
export type SubjectResource =
  RadicalResource | KanjiResource | VocabularyResource | KanaVocabularyResource;

// /assignments

export interface Assignment {
  available_at: string | null;
  burned_at: string | null;
  created_at: string;
  hidden: boolean;
  passed_at: string | null;
  resurrected_at: string | null;
  /** 0 lesson queue, 1-4 Apprentice, 5-6 Guru, 7 Master, 8 Enlightened, 9 Burned. */
  srs_stage: number;
  started_at: string | null;
  subject_id: number;
  subject_type: SubjectType;
  unlocked_at: string | null;
}

export type AssignmentResource = Resource<'assignment', Assignment>;

// /review_statistics

export interface ReviewStatistic {
  created_at: string;
  hidden: boolean;
  meaning_correct: number;
  meaning_current_streak: number;
  meaning_incorrect: number;
  meaning_max_streak: number;
  percentage_correct: number;
  reading_correct: number;
  reading_current_streak: number;
  reading_incorrect: number;
  reading_max_streak: number;
  subject_id: number;
  subject_type: SubjectType;
}

export type ReviewStatisticResource = Resource<'review_statistic', ReviewStatistic>;

// /level_progressions

export interface LevelProgression {
  abandoned_at: string | null;
  completed_at: string | null;
  created_at: string;
  level: number;
  passed_at: string | null;
  started_at: string | null;
  unlocked_at: string | null;
}

export type LevelProgressionResource = Resource<'level_progression', LevelProgression>;

// /resets

export interface Reset {
  confirmed_at: string | null;
  created_at: string;
  original_level: number;
  target_level: number;
}

export type ResetResource = Resource<'reset', Reset>;

// /spaced_repetition_systems

export type IntervalUnit = 'milliseconds' | 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks';

export interface SrsStage {
  /** Null for the lesson stage (position 0) and the burning stage. */
  interval: number | null;
  interval_unit: IntervalUnit | null;
  position: number;
}

export interface SpacedRepetitionSystem {
  burning_stage_position: number;
  created_at: string;
  description: string;
  name: string;
  passing_stage_position: number;
  stages: SrsStage[];
  starting_stage_position: number;
  unlocking_stage_position: number;
}

export type SpacedRepetitionSystemResource = Resource<
  'spaced_repetition_system',
  SpacedRepetitionSystem
>;
