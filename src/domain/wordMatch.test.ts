import { expect, test } from 'vitest';
import type { SubjectResource } from '../api/types';
import type { WordsPack } from './coverage';
import { matchWords } from './wordMatch';

function vocab(id: number, characters: string, readings: string[], hidden = false) {
  return {
    id,
    object: 'vocabulary',
    data: {
      characters,
      hidden_at: hidden ? '2026-01-01T00:00:00Z' : null,
      readings: readings.map((reading, i) => ({
        reading,
        primary: i === 0,
        accepted_answer: true,
      })),
    },
  } as SubjectResource;
}
function kana(id: number, characters: string) {
  return {
    id,
    object: 'kana_vocabulary',
    data: { characters, hidden_at: null },
  } as SubjectResource;
}

// Row order is rank order, as in the pack.
const pack: WordsPack = {
  words: ['こと', 'ちょっと', '生', '事', '生', '人', '生', 'ドア', '日本'],
  readings: ['', '', 'せい', 'こと', 'なま', 'ひと', 'ウブ', '', 'にほん'],
  rank: [1, 1, 1, 1, 1, 1, 1, 1, 1],
};

test('matches by exact spelling and picks the row with a WaniKani reading', () => {
  const m = matchWords(
    [
      vocab(1, '生', ['なま']),
      vocab(2, '〜人', ['じん']), // no reading match: best-ranked row
      vocab(3, '事', ['こと']),
      kana(4, 'ちょっと'),
      kana(5, 'ドア'),
      vocab(6, '日本', ['にほん'], true), // hidden
      vocab(7, '生まれ', ['うまれ']), // not in pack
    ],
    pack,
  );
  expect([...m].sort((a, b) => a[0] - b[0])).toEqual([
    [1, 4], // ちょっと
    [3, 3], // 事 claims its kanji row only, not こと
    [4, 1], // 生/なま
    [5, 2], // 人
    [7, 5], // ドア
  ]);
});

test('folds katakana readings in the pack', () => {
  expect(matchWords([vocab(1, '生', ['うぶ'])], pack).get(6)).toBe(1);
});
