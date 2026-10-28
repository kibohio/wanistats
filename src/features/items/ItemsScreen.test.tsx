import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { expect, test, vi } from 'vitest';
import type { AccuracyBreakdown, AccuracyReport } from '../../domain/accuracy';
import type { Item } from '../../domain/items';
import { ItemsView } from './ItemsScreen';

const now = Date.UTC(2026, 9, 1, 12);
// jsdom lacks scrollTo, which the window virtualizer calls while measuring.
window.scrollTo = () => {};
// ItemsView renders without a router here.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}));

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
  expect(screen.getByRole('button', { name: /End.*9 wrong/ })).toBeInTheDocument();
  expect(screen.getByText(/Recent accuracy appears after a week/)).toBeInTheDocument();

  await user.click(preset(/^Apprentice/));
  expect(meanings()).toEqual(['End', 'Not yet']);

  // Pressing the active preset again clears it and shows every item.
  await user.click(preset(/^Apprentice/));
  expect(meanings()).toHaveLength(4);

  // Group headings are their own rows, ahead of the cards.
  await user.selectOptions(screen.getByLabelText('Group'), 'type');
  expect(screen.getByRole('heading', { name: 'Kanji 4' })).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText('Group'), 'none');

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

test('the drill grades answers, requeues misses and offers them again', async () => {
  const user = userEvent.setup();
  render(<ItemsView items={items} accuracy={report} recentLeeches={false} now={now} />);

  await user.click(screen.getByRole('button', { name: 'Drill 1 item' }));
  const sheet = await screen.findByRole('dialog', { name: 'Drill' });
  const answer = () => within(sheet).getByRole('textbox');
  expect(answer()).toHaveFocus();
  expect(within(sheet).getByText('2 questions left')).toBeInTheDocument();

  await user.type(answer(), 'nope{Enter}');
  expect(within(sheet).getByRole('status')).toHaveTextContent(/^Not quite\./);
  await user.keyboard('{Enter}');
  expect(within(sheet).getByText('2 questions left')).toBeInTheDocument();

  // Romaji turns into kana as it is typed.
  while (screen.queryByRole('dialog', { name: 'Drill' })) {
    const reading = within(sheet).queryByLabelText(/reading/);
    if (reading === answer()) {
      await user.type(answer(), 'matsu');
      expect(answer()).toHaveValue('まつ');
    } else {
      await user.type(answer(), 'end');
    }
    await user.keyboard('{Enter}');
    expect(within(sheet).getByRole('status')).toHaveTextContent('Correct');
    await user.keyboard('{Enter}');
  }

  const done = screen.getByRole('dialog', { name: 'Drill done' });
  expect(within(done).getByText('0 of 1 item right first time')).toBeInTheDocument();
  expect(within(done).getByText('2 of 3 answers right')).toBeInTheDocument();
  await user.click(within(done).getByRole('button', { name: 'Drill missed items again' }));
  expect(screen.getByRole('dialog', { name: 'Drill' })).toBeInTheDocument();
});
