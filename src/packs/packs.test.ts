import { gzipSync } from 'fflate';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { PackRow } from '../db/schema';
import { downloadPack, formatBytes, hasUpdate, packsDb } from './packs';
import type { PackEntry, WordsPack } from './types';

const pack: WordsPack = { words: ['事', 'こと'], readings: ['こと', ''], rank: [860, -844] };
const json = new TextEncoder().encode(JSON.stringify(pack));
const gz = gzipSync(json, { level: 9 });

async function sha256(bytes: Uint8Array<ArrayBuffer>) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function entry(overrides: Partial<PackEntry> = {}): Promise<PackEntry> {
  return {
    id: 'words-global',
    label: 'Common words, all media',
    description: '',
    version: '20261003',
    file: 'words-global.20261003.json.gz',
    bytes: gz.length,
    uncompressedBytes: json.length,
    sha256: await sha256(json),
    records: 2,
    sources: [],
    ...overrides,
  };
}

/** Serves `bytes` in 8-byte chunks, as a network stream would. */
function serve(bytes: Uint8Array) {
  const fetch = vi.fn(async () => {
    let offset = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset >= bytes.length) return controller.close();
        controller.enqueue(bytes.slice(offset, (offset += 8)));
      },
    });
    return new Response(body);
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

beforeEach(() => packsDb.packs.clear());
afterEach(() => vi.unstubAllGlobals());

test('reports byte progress, then stores the decoded pack', async () => {
  const fetch = serve(gz);
  const progress: number[] = [];
  const e = await entry();

  await downloadPack(e, (loaded, total) => {
    expect(total).toBe(gz.length);
    progress.push(loaded);
  });

  expect(fetch).toHaveBeenCalledWith('/data/packs/words-global.20261003.json.gz', {
    signal: undefined,
  });
  expect(progress.length).toBeGreaterThan(2);
  expect(progress).toEqual([...progress].sort((a, b) => a - b));
  expect(progress.at(-1)).toBe(gz.length);
  const row = await packsDb.packs.get('words-global');
  expect(row).toMatchObject({ id: 'words-global', version: '20261003', bytes: gz.length });
  expect(row?.data).toEqual(pack);
});

test('rejects a checksum mismatch and stores nothing', async () => {
  serve(gz);
  await expect(downloadPack(await entry({ sha256: '0'.repeat(64) }))).rejects.toThrow(
    /integrity check/,
  );
  expect(await packsDb.packs.count()).toBe(0);
});

test('still installs where crypto.subtle is missing (plain http on a LAN)', async () => {
  serve(gz);
  const e = await entry();
  vi.stubGlobal('crypto', {});
  await downloadPack(e);
  expect(await packsDb.packs.count()).toBe(1);
});

test('parses bytes a host already decompressed as JSON', async () => {
  serve(json);
  await downloadPack(await entry());
  expect((await packsDb.packs.get('words-global'))?.data).toEqual(pack);
});

test('falls back to fflate without DecompressionStream', async () => {
  vi.stubGlobal('DecompressionStream', undefined);
  serve(gz);
  await downloadPack(await entry());
  expect((await packsDb.packs.get('words-global'))?.data).toEqual(pack);
});

test('says what to do when the network fails', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
  await expect(downloadPack(await entry())).rejects.toThrow(/Check your connection/);
});

test('detects a newer manifest version of an installed pack', async () => {
  const e = await entry({ version: '20261101' });
  const row = (version: string): PackRow => ({
    id: e.id,
    version,
    data: pack,
    bytes: 1,
    installedAt: '',
  });
  expect(hasUpdate(e, row('20261003'))).toBe(true);
  expect(hasUpdate(e, row('20261101'))).toBe(false);
  expect(hasUpdate(e, undefined)).toBe(false);
});

test('formats sizes the way the sheet shows them', () => {
  expect(formatBytes(48_123)).toBe('48 KB');
  expect(formatBytes(260_400)).toBe('260 KB');
  expect(formatBytes(1_234_567)).toBe('1.2 MB');
});
