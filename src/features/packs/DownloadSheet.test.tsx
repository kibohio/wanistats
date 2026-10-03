import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { gzipSync } from 'fflate';
import { afterEach, expect, test, vi } from 'vitest';
import { packsDb } from '../../packs/packs';
import type { PackEntry } from '../../packs/types';
import { DownloadSheet } from './DownloadSheet';

const json = new TextEncoder().encode(
  '{"chars":["人"],"rank":[1],"grade":[1],"strokes":[2],"jlpt":[5]}',
);
const gz = gzipSync(json);

async function entry(id: string, label: string, bytes: number): Promise<PackEntry> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', json));
  return {
    id,
    label,
    description: `${label} description.`,
    version: '20261003',
    file: `${id}.20261003.json.gz`,
    bytes,
    uncompressedBytes: json.length,
    sha256: Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join(''),
    records: 1,
    sources: [],
  };
}

afterEach(async () => {
  vi.unstubAllGlobals();
  await packsDb.packs.clear();
});

test('shows manifest sizes and fetches nothing until Download is pressed', async () => {
  const packs = [
    await entry('kanji', 'Kanji frequency and lists', gz.length),
    await entry('words-global', 'Common words, all media', 212_000),
  ];
  const fetch = vi.fn(async (url: string) =>
    url.endsWith('manifest.json') ? Response.json({ packs }) : new Response(gz),
  );
  vi.stubGlobal('fetch', fetch);
  const onClose = vi.fn();
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DownloadSheet open onClose={onClose} preselect={['kanji']} />
    </QueryClientProvider>,
  );

  expect(screen.getByRole('dialog', { name: 'Download coverage data' })).toBeInTheDocument();
  expect(await screen.findByText('212 KB')).toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: /Kanji frequency and lists/ })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: /Common words, all media/ })).not.toBeChecked();
  const button = screen.getByRole('button', { name: `Download ${gz.length} B` });
  expect(fetch.mock.calls.some(([url]) => url.endsWith('.gz'))).toBe(false);

  await user.click(button);

  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(fetch).toHaveBeenCalledWith('/data/packs/kanji.20261003.json.gz', expect.anything());
  expect(fetch.mock.calls.some(([url]) => url.includes('words-global'))).toBe(false);
  expect(await packsDb.packs.get('kanji')).toMatchObject({ version: '20261003' });
});
