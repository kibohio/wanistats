import { describe, expect, it } from 'vitest';
import type { ReviewStatisticResource } from '../api/types';
import type { AccuracyBreakdown, AccuracyFigures } from './accuracy';
import {
  buildItems,
  filterItems,
  hiragana,
  presetCounts,
  stageGroup,
  stageName,
  weakestPart,
  type Item,
} from './items';
import { assignment, DAY_MS, kanji, radical, T0, vocab } from './test/fixtures';

const HOUR = 3_600_000;
const now = T0 + 30 * DAY_MS;

function stat(
  subjectId: number,
  s: Partial<ReviewStatisticResource['data']> = {},
): ReviewStatisticResource {
  return {
    id: subjectId + 5000,
    object: 'review_statistic',
    url: '',
    data_updated_at: null,
    data: {
      created_at: '',
      hidden: false,
      meaning_correct: 8,
      meaning_incorrect: 2,
      meaning_current_streak: 1,
      meaning_max_streak: 1,
      reading_correct: 6,
      reading_incorrect: 4,
      reading_current_streak: 1,
      reading_max_streak: 1,
      percentage_correct: 70,
      subject_id: subjectId,
      subject_type: 'kanji',
      ...s,
    },
  };
}

function setup() {
  const end = kanji(1, 5);
  end.data.characters = '末';
  end.data.meanings = [
    { meaning: 'End', primary: true, accepted_answer: true },
    { meaning: 'Tip', primary: false, accepted_answer: true },
  ];
  end.data.auxiliary_meanings = [{ meaning: 'Last', type: 'whitelist' }];
  end.data.readings = [{ reading: 'まつ', primary: true, accepted_answer: true, type: 'onyomi' }];
  end.data.visually_similar_subject_ids = [2];
  const notYet = kanji(2, 5);
  notYet.data.characters = '未';
  notYet.data.meanings = [{ meaning: 'Not yet', primary: true, accepted_answer: true }];
  notYet.data.readings = [{ reading: 'み', primary: true, accepted_answer: true, type: 'onyomi' }];
  const anime = vocab(3, 6);
  anime.data.characters = 'アニメ';
  anime.data.meanings = [{ meaning: 'Animation', primary: true, accepted_answer: true }];
  const hidden = vocab(4, 6, [], { hidden: true });
  const imageOnly = radical(5, 1);
  imageOnly.data.characters = null;
  imageOnly.data.meanings = [{ meaning: 'Gun', primary: true, accepted_answer: true }];
  imageOnly.data.character_images = [
    { url: 'https://files.wanikani.com/a.png', content_type: 'image/png', metadata: {} },
    { url: 'https://files.wanikani.com/a.svg', content_type: 'image/svg+xml', metadata: {} },
  ];
  const locked = kanji(6, 7);

  const subjects = [end, notYet, anime, hidden, imageOnly, locked];
  const assignments = [
    assignment(end, { stage: 2, availableAt: now + 3 * HOUR }),
    assignment(notYet, { stage: 5, availableAt: now + 48 * HOUR }),
    assignment(anime, { stage: 9 }),
    assignment(hidden, { stage: 1 }),
    assignment(imageOnly, { stage: 0 }),
  ];
  const stats = [
    stat(1, { meaning_incorrect: 6, reading_incorrect: 5 }),
    stat(2, { meaning_incorrect: 0, reading_incorrect: 0, meaning_current_streak: 4 }),
    stat(4),
  ];
  return { subjects, assignments, stats };
}

const items = () => {
  const { subjects, assignments, stats } = setup();
  return buildItems({ subjects, assignments, stats, leeches: [], now });
};
const ids = (list: Item[]) => list.map((i) => i.id);

describe('buildItems', () => {
  it('joins subject, assignment and statistics, skipping hidden subjects', () => {
    const list = items();
    expect(ids(list)).toEqual([1, 2, 3, 5, 6]);
    const end = list[0]!;
    expect(end).toMatchObject({
      characters: '末',
      meaning: 'End',
      meanings: ['End', 'Tip', 'Last'],
      reading: 'まつ',
      level: 5,
      stage: 2,
      availableAt: now + 3 * HOUR,
      daysIn: 30,
      incorrect: 11,
      accuracy: 0.7,
      lookAlikeIds: [2],
    });
    expect(end.leechScore).toBeCloseTo(11);
  });

  it('uses the svg image only when a radical has no characters', () => {
    const list = items();
    expect(list.find((i) => i.id === 5)!.imageUrl).toBe('https://files.wanikani.com/a.svg');
    expect(list.find((i) => i.id === 1)!.imageUrl).toBeNull();
  });

  it('ignores images hosted anywhere but files.wanikani.com', () => {
    const { subjects, assignments, stats } = setup();
    const r = subjects[4]!;
    if (r.object === 'radical')
      r.data.character_images = [
        { url: 'https://evil.example/a.svg', content_type: 'image/svg+xml', metadata: {} },
      ];
    const list = buildItems({ subjects, assignments, stats, leeches: [], now });
    expect(list.find((i) => i.id === 5)!.imageUrl).toBeNull();
  });

  it('links radicals to kanji, kanji to radicals and words to kanji, skipping hidden ones', () => {
    const { subjects, assignments, stats } = setup();
    const [end, , anime, , imageOnly] = subjects;
    if (end?.object === 'kanji') end.data.component_subject_ids = [5];
    if (anime?.object === 'vocabulary') anime.data.component_subject_ids = [1, 4];
    if (imageOnly?.object === 'radical') imageOnly.data.amalgamation_subject_ids = [1, 6];
    const list = buildItems({ subjects, assignments, stats, leeches: [], now });
    const related = (id: number) => list.find((i) => i.id === id)!.relatedIds;
    expect(related(1)).toEqual([5]);
    expect(related(3)).toEqual([1]);
    expect(related(5)).toEqual([1, 6]);
    expect(related(2)).toEqual([]);
  });

  it('marks locked items and items without statistics', () => {
    const locked = items().find((i) => i.id === 6)!;
    expect(locked).toMatchObject({ stage: null, accuracy: null, daysIn: null, incorrect: 0 });
  });
});

describe('stages', () => {
  it('names each stage', () => {
    expect([null, 0, 1, 4, 5, 6, 7, 8, 9].map(stageName)).toEqual([
      'Locked',
      'Lesson',
      'Apprentice 1',
      'Apprentice 4',
      'Guru 1',
      'Guru 2',
      'Master',
      'Enlightened',
      'Burned',
    ]);
    expect([3, 6, 9].map(stageGroup)).toEqual(['Apprentice', 'Guru', 'Burned']);
  });
});

describe('presets and search', () => {
  it('counts each preset', () => {
    const list = items();
    list[0]!.leech = {
      subjectId: 1,
      subjectType: 'kanji',
      score: 11,
      incorrect: 11,
      recentMisses: null,
      recentlyStruggling: false,
      lookAlikeIds: [2],
    };
    expect(presetCounts(list, now)).toEqual({
      leeches: 1,
      apprentice: 1,
      next24h: 1,
      guru: 1,
      burned: 1,
    });
  });

  it('filters by preset, then by query', () => {
    const list = items();
    expect(ids(filterItems(list, 'apprentice', '', now))).toEqual([1]);
    expect(ids(filterItems(list, null, '末', now))).toEqual([1]);
    expect(ids(filterItems(list, null, 'yet', now))).toEqual([2]);
    expect(ids(filterItems(list, null, 'LAST', now))).toEqual([1]);
    expect(ids(filterItems(list, null, 'まつ', now))).toEqual([1]);
    expect(ids(filterItems(list, 'guru', 'end', now))).toEqual([]);
  });

  it('matches romaji against readings and katakana once converted', () => {
    const list = items();
    const toKana = (q: string) => ({ matsu: 'まつ', anime: 'あにめ', mats: 'まts' })[q] ?? q;
    expect(ids(filterItems(list, null, 'matsu', now, toKana))).toEqual([1]);
    expect(ids(filterItems(list, null, 'anime', now, toKana))).toEqual([3]);
    // A half-typed syllable converts only partly and must not match readings.
    expect(ids(filterItems(list, null, 'mats', now, toKana))).toEqual([]);
  });

  it('folds katakana to hiragana', () => {
    expect(hiragana('アニメー')).toBe('あにめー');
  });
});

describe('weakestPart', () => {
  const f = (meaning: number | null, reading: number | null): AccuracyFigures => ({
    question: null,
    meaning,
    reading,
    itemEstimate: null,
    answers: 10,
  });
  it('picks the lowest meaning or reading rate across types', () => {
    const b = {
      bySubjectType: {
        radical: f(0.95, null),
        kanji: f(0.9, 0.82),
        vocabulary: f(0.88, 0.85),
        kana_vocabulary: f(null, null),
      },
    } as AccuracyBreakdown;
    expect(weakestPart(b)).toEqual({ type: 'kanji', part: 'reading', rate: 0.82 });
  });
});
