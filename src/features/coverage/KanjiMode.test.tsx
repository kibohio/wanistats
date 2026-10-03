import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import type { SubjectResource } from '../../api/types';
import { accountDb, sessionDb } from '../../db/useAppMode';
import { KanjiMode } from './KanjiMode';

afterEach(async () => {
  vi.unstubAllGlobals();
  await sessionDb.auth.clear();
  await accountDb('u').subjects.clear();
});

test('a logged-in user without the kanji pack gets a download prompt; WK level still works', async () => {
  await sessionDb.auth.put('tok', 'token');
  await sessionDb.meta.put({ key: 'activeUserId', value: 'u' });
  await accountDb('u').subjects.put({
    id: 1,
    object: 'kanji',
    data: {
      characters: '一',
      level: 1,
      lesson_position: 0,
      hidden_at: null,
      meanings: [{ meaning: 'one', primary: true, accepted_answer: true }],
      auxiliary_meanings: [],
      readings: [],
      component_subject_ids: [],
      amalgamation_subject_ids: [],
      visually_similar_subject_ids: [],
      document_url: 'https://www.wanikani.com/kanji/%E4%B8%80',
    },
  } as unknown as SubjectResource);
  // jsdom has no layout; the grid still renders rows within the window height.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({ packs: [{ id: 'kanji', label: 'Kanji lists', bytes: 2048 }] }),
    ),
  );

  render(
    <QueryClientProvider client={new QueryClient()}>
      <KanjiMode />
    </QueryClientProvider>,
  );

  expect(await screen.findByText(/needs the kanji lists/)).toBeInTheDocument();
  expect(await screen.findByText('Kanji lists, 2 KB')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'WK level' }));
  expect(await screen.findByRole('heading', { name: 'Level 1' })).toBeInTheDocument();
  expect(screen.queryByText(/needs the kanji lists/)).not.toBeInTheDocument();
  expect(screen.getByText('0 of 1 known')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '一, One, Not started' }));
  const sheet = await screen.findByRole('dialog', { name: 'one' });
  expect(within(sheet).getByRole('link', { name: 'Open in WaniKani' })).toHaveAttribute(
    'href',
    'https://www.wanikani.com/kanji/%E4%B8%80',
  );
});
