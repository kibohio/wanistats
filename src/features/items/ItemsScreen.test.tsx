import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import type { AccuracyBreakdown, AccuracyReport } from '../../domain/accuracy';
import type { Item } from '../../domain/items';
import { ItemsView } from './ItemsScreen';

const now = Date.UTC(2026, 9, 1, 12);
// jsdom lacks scrollTo, which the window virtualizer calls while measuring.
window.scrollTo = () => {};

function item(
  id: number,
  characters: string,
  meaning: string,
  reading: string,
  stage: number,
  leech = false,
): Item {
  return {
    id,
    type: 'kanji',
    characters,
    imageUrl: null,
    meaning,
    meanings: [meaning],
    reading,
    readings: [{ reading, primary: true, type: 'onyomi' }],
    level: 5,
    stage,
    availableAt: stage < 9 ? now + 3_600_000 : null,
    daysIn: 40,
    answers: null,
    accuracy: 0.8,
    incorrect: leech ? 9 : 1,
    leechScore: leech ? 9 : 0.5,
    leech: leech
      ? {
          subjectId: id,
          subjectType: 'kanji',
          score: 9,
          incorrect: 9,
          recentMisses: null,
          recentlyStruggling: false,
          lookAlikeIds: [],
        }
      : null,
    lookAlikeIds: [],
    relatedIds: [],
    documentUrl: '',
  };
}

const items = [
  { ...item(1, '末', 'End', 'まつ', 2, true), relatedIds: [3] },
  item(2, '未', 'Not yet', 'み', 3),
  item(3, '氷', 'Ice', 'ひょう', 5),
  item(4, '永', 'Eternity', 'えい', 9),
];

const figures = { question: 0.9, meaning: 0.9, reading: 0.8, itemEstimate: 0.75, answers: 100 };
const breakdown = {
  ...figures,
  bySubjectType: {
    radical: figures,
    kanji: figures,
    vocabulary: figures,
    kana_vocabulary: figures,
  },
} as AccuracyBreakdown;
const report: AccuracyReport = {
  lifetime: breakdown,
  recentAvailable: false,
  recent7: null,
  recent30: null,
};

const meanings = () =>
  within(screen.getByRole('list', { name: 'Items' }))
    .getAllByRole('button')
    .map((b) => items.find((i) => b.textContent.includes(i.meaning))?.meaning);

test('presets show counts and filter; search narrows by meaning, kana and romaji', async () => {
  const user = userEvent.setup();
  render(<ItemsView items={items} accuracy={report} recentLeeches={false} now={now} />);

  const preset = (name: RegExp) => screen.getByRole('button', { name });
  expect(preset(/^Leeches 1$/)).toHaveAttribute('aria-pressed', 'true');
  expect(preset(/^Apprentice 2$/)).toBeInTheDocument();
  expect(preset(/^Burned 1$/)).toBeInTheDocument();
  expect(meanings()).toEqual(['End']);
  expect(screen.getByText(/Recent accuracy appears after a week/)).toBeInTheDocument();

  await user.click(preset(/^Apprentice/));
  expect(meanings()).toEqual(['End', 'Not yet']);

  // Pressing the active preset again clears it and shows every item.
  await user.click(preset(/^Apprentice/));
  expect(meanings()).toHaveLength(4);

  const search = screen.getByRole('searchbox', { name: 'Search items' });
  await user.type(search, 'yet');
  expect(meanings()).toEqual(['Not yet']);

  await user.clear(search);
  await user.type(search, 'ひょう');
  expect(meanings()).toEqual(['Ice']);

  await user.clear(search);
  await user.type(search, 'matsu');
  await screen.findByText('End');
  expect(meanings()).toEqual(['End']);

  await user.click(preset(/^Burned/));
  expect(screen.getByText('No items match.')).toBeInTheDocument();
});

test('the item sheet moves to related items and back', async () => {
  const user = userEvent.setup();
  render(<ItemsView items={items} accuracy={report} recentLeeches={false} now={now} />);

  await user.click(within(screen.getByRole('list', { name: 'Items' })).getByText('End'));
  const sheet = screen.getByRole('dialog', { name: 'End' });
  expect(within(sheet).getByText('9.0, from 9 wrong answers')).toBeInTheDocument();

  await user.click(within(sheet).getByRole('button', { name: /Ice, ひょう, Guru 1/ }));
  expect(screen.getByRole('dialog', { name: 'Ice' })).toContainElement(
    document.activeElement as HTMLElement,
  );
  await user.click(screen.getByRole('button', { name: 'Back to End' }));
  expect(screen.getByRole('dialog', { name: 'End' })).toBeInTheDocument();
});
